import { useCallback, useEffect, useState } from "react";
import { useApp } from "../../context/AppContext";
import { isPlatformManager } from "../../lib/account-capabilities";
import {
  fetchCompaniesForLimitManagement,
  STARTER_LIMITS,
  TRUSTED_LIMITS,
  updateCompanyLimits,
  type CompanyLimitRow
} from "../../services/platformLimits";

export function CompanyLimitsPanel() {
  const { sessionUser, showToast, openModal, closeModal } = useApp();
  const [rows, setRows] = useState<CompanyLimitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const isManager = isPlatformManager(sessionUser);

  const load = useCallback(async () => {
    if (!isManager) return;
    setLoading(true);
    try {
      setRows(await fetchCompaniesForLimitManagement());
    } catch {
      showToast("Failed to load company limits", "error");
    } finally {
      setLoading(false);
    }
  }, [isManager, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const openEdit = (row: CompanyLimitRow) => {
    let hireCap = row.max_active_hires != null ? String(row.max_active_hires) : "";
    let listingCap = row.max_active_listings != null ? String(row.max_active_listings) : "";

    const save = async () => {
      setSavingId(row.id);
      try {
        await updateCompanyLimits(row.id, {
          maxActiveHires: hireCap.trim() === "" ? null : Math.max(0, Number(hireCap) || 0),
          maxActiveListings: listingCap.trim() === "" ? null : Math.max(0, Number(listingCap) || 0)
        });
        closeModal();
        showToast(`Limits updated for ${row.name}`, "success");
        await load();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to save limits";
        showToast(msg, "error");
      } finally {
        setSavingId(null);
      }
    };

    openModal(
      `Trust limits — ${row.name}`,
      <div className="company-limits-edit-form">
        <p className="t-caption t-secondary" style={{ marginBottom: 16 }}>
          Tier defaults for this company: carriers{" "}
          {row.completed_as_buyer >= 1 ? TRUSTED_LIMITS.carrierActiveHires : STARTER_LIMITS.carrierActiveHires} hires ·
          sellers{" "}
          {row.completed_as_seller >= 1 ? TRUSTED_LIMITS.recruiterActiveListings : STARTER_LIMITS.recruiterActiveListings}{" "}
          listings. Leave a field blank to use the tier default.
        </p>
        <div className="form-group">
          <label htmlFor={`hire-cap-${row.id}`}>Max active hires (carriers)</label>
          <input
            id={`hire-cap-${row.id}`}
            type="number"
            min={0}
            placeholder="Tier default"
            defaultValue={hireCap}
            onChange={(e) => { hireCap = e.target.value; }}
          />
        </div>
        <div className="form-group">
          <label htmlFor={`listing-cap-${row.id}`}>Max active listings (recruiters)</label>
          <input
            id={`listing-cap-${row.id}`}
            type="number"
            min={0}
            placeholder="Tier default"
            defaultValue={listingCap}
            onChange={(e) => { listingCap = e.target.value; }}
          />
        </div>
        <p className="t-caption t-secondary">
          Currently: {row.active_hires} active hire{row.active_hires === 1 ? "" : "s"} · {row.active_listings} active listing{row.active_listings === 1 ? "" : "s"}
        </p>
      </div>,
      <>
        <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={savingId === row.id}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={savingId === row.id}
          onClick={() => void save()}
        >
          {savingId === row.id ? "Saving…" : "Save limits"}
        </button>
      </>
    );
  };

  if (!isManager) {
    return (
      <div className="card">
        <div className="card-body t-secondary">
          Only platform managers can adjust carrier hire and recruiter listing limits.
        </div>
      </div>
    );
  }

  const filtered = rows.filter((r) => {
    if (!filter.trim()) return true;
    const q = filter.trim().toLowerCase();
    return r.name.toLowerCase().includes(q) || r.company_type.includes(q);
  });

  return (
    <div className="company-limits-panel">
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ fontSize: 13, lineHeight: 1.7 }}>
          <p><strong>Default trust tiers</strong> (automatic after first completed deal):</p>
          <ul className="limits-default-list">
            <li><strong>Carriers:</strong> {STARTER_LIMITS.carrierActiveHires} active hire while building trust → {TRUSTED_LIMITS.carrierActiveHires} after first completed deal</li>
            <li><strong>Recruiters / agencies:</strong> {STARTER_LIMITS.recruiterActiveListings} active listings → {TRUSTED_LIMITS.recruiterActiveListings} after first completed sale</li>
          </ul>
          <p className="t-caption t-secondary">Leave override fields blank to use tier defaults. Set a number to cap a specific company regardless of trust tier.</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Company limits</h3>
          <input
            type="search"
            placeholder="Search companies…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ maxWidth: 220, fontSize: 13 }}
          />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Type</th>
                <th>Active hires</th>
                <th>Completed (buyer)</th>
                <th>Active listings</th>
                <th>Completed (seller)</th>
                <th>Hire cap</th>
                <th>Listing cap</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="t-secondary">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="t-secondary">No companies found</td></tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td><span className="badge badge-gray">{r.company_type}</span></td>
                    <td>{r.active_hires}</td>
                    <td>{r.completed_as_buyer}</td>
                    <td>{r.active_listings}</td>
                    <td>{r.completed_as_seller}</td>
                    <td>{r.max_active_hires ?? "Tier default"}</td>
                    <td>{r.max_active_listings ?? "Tier default"}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={savingId === r.id}
                        onClick={() => openEdit(r)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
