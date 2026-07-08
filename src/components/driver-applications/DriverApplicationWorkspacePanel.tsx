import { useCallback, useEffect, useState } from "react";
import { ClipboardCopy, FileText, Link2, PlusCircle } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { driverApplicationStatusBadge, driverApplicationStatusLabel } from "../../lib/driver-application-form";
import {
  createDriverApplicationInvite,
  driverApplicationInviteUrl,
  fetchDriverApplicationsForContext,
  type DriverApplicationRow
} from "../../services/driverApplications";
import type { DriverApplicationDocument } from "../../types/driver-application-form";
import { DriverApplicationReadOnlySummary } from "./DriverApplicationForm";

type Props = {
  dealId?: string;
  submissionId?: string;
  listingId?: number;
  carrierCompanyId?: string;
  canManage?: boolean;
  compact?: boolean;
};

function parseDocuments(raw: unknown): DriverApplicationDocument[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((d) => d && typeof d === "object") as DriverApplicationDocument[];
}

export function DriverApplicationWorkspacePanel({
  dealId,
  submissionId,
  listingId,
  carrierCompanyId,
  canManage = true,
  compact
}: Props) {
  const { showToast } = useApp();
  const [rows, setRows] = useState<DriverApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const items = await fetchDriverApplicationsForContext({ dealId, submissionId, listingId });
      setRows(items);
      setSelectedId((prev) => {
        if (prev && items.some((i) => i.id === prev)) return prev;
        return items[0]?.id ?? null;
      });
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [dealId, submissionId, listingId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = rows.find((r) => r.id === selectedId) ?? rows[0] ?? null;
  const documents = parseDocuments(selected?.documents);

  const createInvite = async () => {
    if (!canManage || creating) return;
    setCreating(true);
    try {
      const { id, inviteToken } = await createDriverApplicationInvite({
        dealId,
        submissionId,
        listingId,
        carrierCompanyId
      });
      showToast("Application link created", "success");
      await load();
      setSelectedId(id);
      const url = driverApplicationInviteUrl(inviteToken);
      try {
        await navigator.clipboard.writeText(url);
        showToast("Invite link copied to clipboard", "success");
      } catch {
        /* clipboard optional */
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to create application", "error");
    } finally {
      setCreating(false);
    }
  };

  const copyLink = async (token: string) => {
    const url = driverApplicationInviteUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied", "success");
    } catch {
      showToast(url, "");
    }
  };

  if (loading) {
    return <p className="t-caption t-secondary">Loading driver applications...</p>;
  }

  return (
    <div className={`driver-app-workspace-panel ${compact ? "driver-app-workspace-panel--compact" : ""}`}>
      <div className="driver-app-workspace-intro card">
        <div className="driver-app-workspace-intro-icon">
          <FileText className="icon-md" />
        </div>
        <div>
          <strong>Driver employment application</strong>
          <p className="t-caption t-secondary">
            Send a TenStreet-style application link to the driver. Once submitted, both parties can review responses and uploaded documents here.
          </p>
        </div>
        {canManage ? (
          <button type="button" className="btn btn-primary btn-sm" disabled={creating} onClick={() => void createInvite()}>
            <PlusCircle className="icon-sm" /> {creating ? "Creating..." : "New application link"}
          </button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <div className="card marketplace-empty">
          <p className="t-body">No driver applications yet.</p>
          <p className="t-caption t-secondary">
            {canManage
              ? "Create an invite link and send it to the driver. They can complete the form without a platform account."
              : "The hiring party has not requested an application yet."}
          </p>
        </div>
      ) : (
        <>
          {rows.length > 1 ? (
            <div className="tabs driver-app-tabs">
              {rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className={`tab ${selected?.id === row.id ? "active" : ""}`}
                  onClick={() => setSelectedId(row.id)}
                >
                  {row.driver_first_name ? `${row.driver_first_name} ${(row.driver_last_name ?? "").charAt(0)}.` : row.id}
                </button>
              ))}
            </div>
          ) : null}

          {selected ? (
            <div className="driver-app-workspace-detail">
              <div className="driver-app-workspace-meta">
                <span className={`badge ${driverApplicationStatusBadge(selected.status)}`}>
                  {driverApplicationStatusLabel(selected.status)}
                </span>
                <span className="t-caption t-secondary">{selected.completion_pct}% filled</span>
                {selected.submitted_at ? (
                  <span className="t-caption t-secondary">Submitted {new Date(selected.submitted_at).toLocaleDateString()}</span>
                ) : null}
              </div>

              {canManage && selected.status !== "submitted" ? (
                <div className="driver-app-invite-row card">
                  <Link2 className="icon-sm" />
                  <code className="driver-app-invite-url">{driverApplicationInviteUrl(selected.invite_token)}</code>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => void copyLink(selected.invite_token)}>
                    <ClipboardCopy className="icon-sm" /> Copy
                  </button>
                </div>
              ) : null}

              {selected.status === "submitted" || selected.status === "reviewed" ? (
                <DriverApplicationReadOnlySummary
                  formData={selected.form_data}
                  documents={documents}
                  firstName={selected.driver_first_name ?? ""}
                  lastName={selected.driver_last_name ?? ""}
                  email={selected.driver_email ?? ""}
                  phone={selected.driver_phone ?? ""}
                />
              ) : (
                <div className="card">
                  <div className="card-body">
                    <p className="t-secondary">
                      {selected.driver_first_name
                        ? `${selected.driver_first_name} has started the application (${selected.completion_pct}% complete).`
                        : "Waiting for the driver to open the invite link and begin."}
                    </p>
                    {selected.completion_pct > 0 ? (
                      <DriverApplicationReadOnlySummary
                        formData={selected.form_data}
                        documents={documents}
                        firstName={selected.driver_first_name ?? ""}
                        lastName={selected.driver_last_name ?? ""}
                        email={selected.driver_email ?? ""}
                        phone={selected.driver_phone ?? ""}
                      />
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
