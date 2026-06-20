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
  const { sessionUser, showToast } = useApp();
  const [rows, setRows] = useState<CompanyLimitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<CompanyLimitRow | null>(null);
  const [hireCap, setHireCap] = useState<string>("");
  const [listingCap, setListingCap] = useState<string>("");
  const [busy, setBusy] = useState(false);

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

  const openEdit = (row: CompanyLimitRow) => {
    setEditing(row);
    setHireCap(row.max_active_hires != null ? String(row.max_active_hires) : "");
    setListingCap(row.max_active_listings != null ? String(row.max_active_listings) : "");
  };

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await updateCompanyLimits(editing.id, {
        maxActiveHires: hireCap.trim() === "" ? null : Math.max(0, Number(hireCap) || 0),
        maxActiveListings: listingCap.trim() === "" ? null : Math.max(0, Number(listingCap) || 0)
      });
      showToast(`Limits updated for ${editing.name}`, "success");
      setEditing(null);
      await load();
    } catch {
      showToast("Failed to save limits", "error");
    } finally {
      setBusy(false);
    }
  };

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
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>Edit</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="card" style={{ maxWidth: 420, width: "100%" }}>
            <div className="card-header"><h3>Limits — {editing.name}</h3></div>
            <div className="card-body">
              <p className="t-caption t-secondary" style={{ marginBottom: 12 }}>
                Tier defaults: carriers {editing.completed_as_buyer >= 1 ? TRUSTED_LIMITS.carrierActiveHires : STARTER_LIMITS.carrierActiveHires} hires ·
                sellers {editing.completed_as_seller >= 1 ? TRUSTED_LIMITS.recruiterActiveListings : STARTER_LIMITS.recruiterActiveListings} listings
              </p>
              <div className="form-group">
                <label>Max active hires (carriers)</label>
                <input
                  type="number"
                  min={0}
                  placeholder="Tier default"
                  value={hireCap}
                  onChange={(e) => setHireCap(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Max active listings (recruiters)</label>
                <input
                  type="number"
                  min={0}
                  placeholder="Tier default"
                  value={listingCap}
                  onChange={(e) => setListingCap(e.target.value)}
                />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => void save()} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
