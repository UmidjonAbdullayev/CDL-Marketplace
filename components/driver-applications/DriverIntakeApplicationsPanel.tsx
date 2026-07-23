import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardCopy, ExternalLink, PlusCircle } from "lucide-react";
import { Pagination } from "../ui/Pagination";
import { useApp } from "../../context/AppContext";
import { driverApplicationStatusBadge, driverApplicationStatusLabel } from "../../lib/driver-application-form";
import { fmtDate } from "../../lib/format";
import {
  createDriverApplicationInvite,
  driverApplicationInviteUrl,
  fetchMyDriverApplications,
  type DriverApplicationRow
} from "../../services/driverApplications";

const PAGE_SIZE = 10;

type Props = {
  role: "recruiter" | "carrier";
};

export function DriverIntakeApplicationsPanel({ role }: Props) {
  const navigate = useNavigate();
  const { showToast } = useApp();
  const [rows, setRows] = useState<DriverApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchMyDriverApplications(role));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const createLink = async () => {
    setCreating(true);
    try {
      const { inviteToken } = await createDriverApplicationInvite({});
      const url = driverApplicationInviteUrl(inviteToken);
      await navigator.clipboard.writeText(url);
      showToast("New intake application link copied", "success");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to create link", "error");
    } finally {
      setCreating(false);
    }
  };

  const copyLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(driverApplicationInviteUrl(token));
      showToast("Link copied", "success");
    } catch {
      showToast("Could not copy link", "error");
    }
  };

  const openContext = (row: DriverApplicationRow) => {
    if (row.deal_id) navigate(`/deals/${row.deal_id}`);
    else if (row.submission_id) navigate(`/submissions/${row.submission_id}`);
  };

  return (
    <>
      <div className="driver-intake-toolbar">
        <p className="t-caption t-secondary">
          TenStreet-style employment applications sent to drivers. Share invite links with non-platform drivers — submissions appear here with status and completion.
        </p>
        {role === "recruiter" ? (
          <div className="driver-intake-toolbar-actions">
            <button type="button" className="btn btn-secondary btn-sm" disabled={creating} onClick={() => void createLink()}>
              <PlusCircle className="icon-sm" /> {creating ? "Creating..." : "New invite link"}
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate("/sell")}>
              Fill recruiter profile draft
            </button>
          </div>
        ) : null}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Driver</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={5} className="t-secondary">Loading applications...</td></tr>
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={5} className="t-secondary">No intake applications yet.</td></tr>
              ) : (
                pageRows.map((row) => {
                  const name = row.driver_first_name
                    ? `${row.driver_first_name} ${(row.driver_last_name ?? "").charAt(0)}.`
                    : "Awaiting driver";
                  return (
                    <tr key={row.id}>
                      <td>{name}</td>
                      <td><span className={`badge ${driverApplicationStatusBadge(row.status)}`}>{driverApplicationStatusLabel(row.status)}</span></td>
                      <td>{row.completion_pct}%</td>
                      <td>{fmtDate(row.updated_at)}</td>
                      <td className="driver-intake-actions">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void copyLink(row.invite_token)}>
                          <ClipboardCopy className="icon-sm" /> Link
                        </button>
                        {row.deal_id || row.submission_id ? (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => openContext(row)}>
                            <ExternalLink className="icon-sm" /> Open case
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} loading={loading} onPageChange={setPage} />
    </>
  );
}
