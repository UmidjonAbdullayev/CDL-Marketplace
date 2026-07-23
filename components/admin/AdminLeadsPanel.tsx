import { useCallback, useEffect, useState } from "react";
import { FileUp, Plus, Trash2, Upload } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { LEAD_DRIVER_TYPES } from "../../lib/company-leads";
import { parseLeadFile } from "../../lib/lead-file-parser";
import { fmtDate } from "../../lib/format";
import { US_STATES } from "../../lib/us-states";
import {
  assignLeadsToCompany,
  fetchAssignableCompanies,
  fetchRecentLeadBatches
} from "../../services/companyLeads";
import type { CompanyLeadInput } from "../../types/company-leads";

type Mode = "upload" | "manual";

const emptyRow = (): CompanyLeadInput => ({
  first_name: "",
  last_name: "",
  phone: "",
  email: "",
  cdl_class: "Class A",
  state: "",
  years_experience: null,
  driver_type: "",
  notes_preview: ""
});

export function AdminLeadsPanel() {
  const { sessionUser, showToast } = useApp();
  const [companies, setCompanies] = useState<{ id: string; name: string; company_type: string }[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [mode, setMode] = useState<Mode>("upload");
  const [preview, setPreview] = useState<CompanyLeadInput[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [manualRows, setManualRows] = useState<CompanyLeadInput[]>([emptyRow(), emptyRow()]);
  const [sending, setSending] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [batches, setBatches] = useState<Awaited<ReturnType<typeof fetchRecentLeadBatches>>>([]);

  const loadBatches = useCallback(async () => {
    try {
      setBatches(await fetchRecentLeadBatches(15));
    } catch {
      setBatches([]);
    }
  }, []);

  useEffect(() => {
    void fetchAssignableCompanies()
      .then((rows) => setCompanies(rows))
      .catch(() => setCompanies([]));
    void loadBatches();
  }, [loadBatches]);

  const onFile = async (file: File | null) => {
    if (!file) return;
    setParsing(true);
    try {
      const leads = await parseLeadFile(file);
      setPreview(leads);
      setFileName(file.name);
      if (!leads.length) showToast("No driver rows found in that file", "error");
      else showToast(`Parsed ${leads.length} lead(s) — review before sending`, "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to parse file", "error");
      setPreview([]);
      setFileName(null);
    } finally {
      setParsing(false);
    }
  };

  const updatePreview = (idx: number, patch: Partial<CompanyLeadInput>) => {
    setPreview((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const removePreview = (idx: number) => {
    setPreview((rows) => rows.filter((_, i) => i !== idx));
  };

  const updateManual = (idx: number, patch: Partial<CompanyLeadInput>) => {
    setManualRows((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const sendBatch = async () => {
    if (!companyId) {
      showToast("Select a company first", "error");
      return;
    }
    const leads = mode === "upload"
      ? preview.filter((l) => l.first_name.trim() || l.last_name.trim())
      : manualRows.filter((l) => l.first_name.trim() || l.last_name.trim());

    if (!leads.length) {
      showToast("Add at least one driver lead", "error");
      return;
    }

    setSending(true);
    try {
      const result = await assignLeadsToCompany({
        companyId,
        leads,
        source: mode === "upload" ? "imported" : "manual",
        fileName: mode === "upload" ? fileName ?? undefined : undefined,
        createdByAccountId: sessionUser?.id ?? null
      });
      showToast(`Assigned ${result.count} lead(s) to company`, "success");
      setPreview([]);
      setFileName(null);
      setManualRows([emptyRow(), emptyRow()]);
      await loadBatches();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to assign leads", "error");
    } finally {
      setSending(false);
    }
  };

  const companyName = companies.find((c) => c.id === companyId)?.name;

  return (
    <div className="admin-leads-panel">
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <h3 style={{ marginTop: 0 }}>Assign driver leads</h3>
          <p className="t-caption t-secondary" style={{ marginBottom: 16 }}>
            Choose a company, then upload an Excel/CSV lead file (review &amp; edit rows) or enter drivers manually and send the batch.
          </p>

          <div className="form-group">
            <label>Company *</label>
            <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              <option value="">Select company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.company_type})
                </option>
              ))}
            </select>
          </div>

          <div className="tabs" style={{ margin: "12px 0" }}>
            <button type="button" className={`tab ${mode === "upload" ? "active" : ""}`} onClick={() => setMode("upload")}>
              <Upload className="icon-sm" /> Upload file
            </button>
            <button type="button" className={`tab ${mode === "manual" ? "active" : ""}`} onClick={() => setMode("manual")}>
              <Plus className="icon-sm" /> Manual entry
            </button>
          </div>

          {mode === "upload" ? (
            <div className="admin-leads-upload">
              <label className="admin-leads-dropzone">
                <FileUp className="icon-md" />
                <span>{parsing ? "Parsing..." : "Drop Excel / CSV or click to browse"}</span>
                <span className="t-caption t-secondary">Columns: first name, last name, phone, email, CDL, state, experience, driver type, notes</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.tsv"
                  hidden
                  disabled={parsing}
                  onChange={(e) => {
                    void onFile(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
              </label>
              {fileName ? <p className="t-caption">File: <strong>{fileName}</strong> · {preview.length} row(s)</p> : null}

              {preview.length > 0 ? (
                <div className="admin-leads-preview table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>First</th><th>Last</th><th>Phone</th><th>Email</th><th>CDL</th><th>State</th><th>Type</th><th />
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, idx) => (
                        <tr key={idx}>
                          <td><input value={row.first_name} onChange={(e) => updatePreview(idx, { first_name: e.target.value })} /></td>
                          <td><input value={row.last_name} onChange={(e) => updatePreview(idx, { last_name: e.target.value })} /></td>
                          <td><input value={row.phone ?? ""} onChange={(e) => updatePreview(idx, { phone: e.target.value })} /></td>
                          <td><input value={row.email ?? ""} onChange={(e) => updatePreview(idx, { email: e.target.value })} /></td>
                          <td>
                            <select value={row.cdl_class ?? "Class A"} onChange={(e) => updatePreview(idx, { cdl_class: e.target.value })}>
                              <option>Class A</option><option>Class B</option><option>Class C</option>
                            </select>
                          </td>
                          <td>
                            <select value={row.state ?? ""} onChange={(e) => updatePreview(idx, { state: e.target.value })}>
                              <option value="">—</option>
                              {US_STATES.map((s) => <option key={s.code} value={s.code}>{s.code}</option>)}
                            </select>
                          </td>
                          <td>
                            <select value={row.driver_type ?? ""} onChange={(e) => updatePreview(idx, { driver_type: e.target.value })}>
                              <option value="">—</option>
                              {LEAD_DRIVER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </td>
                          <td>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => removePreview(idx)}>
                              <Trash2 className="icon-sm" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="admin-leads-manual">
              {manualRows.map((row, idx) => (
                <div key={idx} className="admin-leads-manual-row">
                  <div className="form-row">
                    <div className="form-group"><label>First *</label><input value={row.first_name} onChange={(e) => updateManual(idx, { first_name: e.target.value })} /></div>
                    <div className="form-group"><label>Last *</label><input value={row.last_name} onChange={(e) => updateManual(idx, { last_name: e.target.value })} /></div>
                    <div className="form-group"><label>Phone</label><input value={row.phone ?? ""} onChange={(e) => updateManual(idx, { phone: e.target.value })} /></div>
                    <div className="form-group"><label>Email</label><input value={row.email ?? ""} onChange={(e) => updateManual(idx, { email: e.target.value })} /></div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>CDL</label>
                      <select value={row.cdl_class ?? "Class A"} onChange={(e) => updateManual(idx, { cdl_class: e.target.value })}>
                        <option>Class A</option><option>Class B</option><option>Class C</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>State</label>
                      <select value={row.state ?? ""} onChange={(e) => updateManual(idx, { state: e.target.value })}>
                        <option value="">—</option>
                        {US_STATES.map((s) => <option key={s.code} value={s.code}>{s.code}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Driver type</label>
                      <select value={row.driver_type ?? ""} onChange={(e) => updateManual(idx, { driver_type: e.target.value })}>
                        <option value="">—</option>
                        {LEAD_DRIVER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="form-group"><label>Years exp</label>
                      <input
                        type="number"
                        min={0}
                        value={row.years_experience ?? ""}
                        onChange={(e) => updateManual(idx, { years_experience: e.target.value === "" ? null : Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Notes</label>
                    <input value={row.notes_preview ?? ""} onChange={(e) => updateManual(idx, { notes_preview: e.target.value })} />
                  </div>
                  {manualRows.length > 1 ? (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setManualRows((r) => r.filter((_, i) => i !== idx))}>
                      <Trash2 className="icon-sm" /> Remove
                    </button>
                  ) : null}
                </div>
              ))}
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setManualRows((r) => [...r, emptyRow()])}>
                <Plus className="icon-sm" /> Add another driver
              </button>
            </div>
          )}

          <div style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary" disabled={sending || !companyId} onClick={() => void sendBatch()}>
              {sending ? "Sending..." : `Send batch${companyName ? ` to ${companyName}` : ""}`}
            </button>
            <span className="t-caption t-secondary">
              {mode === "upload" ? `${preview.length} ready` : `${manualRows.filter((r) => r.first_name || r.last_name).length} ready`}
            </span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3>Recent lead batches</h3></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Company</th><th>Source</th><th>File</th><th>Count</th><th>Sent</th></tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr><td colSpan={5} className="t-secondary">No batches yet.</td></tr>
              ) : (
                batches.map((b) => (
                  <tr key={b.id}>
                    <td>{b.company_name ?? b.company_id}</td>
                    <td>{b.source}</td>
                    <td>{b.file_name ?? "—"}</td>
                    <td>{b.lead_count}</td>
                    <td>{fmtDate(b.created_at)}</td>
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
