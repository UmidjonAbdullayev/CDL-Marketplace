import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Search, User } from "lucide-react";
import { Pagination } from "../ui/Pagination";
import { CompanyLeadDetailModal } from "./CompanyLeadDetailModal";
import {
  COMPANY_LEAD_STAGES,
  LEAD_DRIVER_TYPES,
  LEAD_PIPELINE_BUCKETS,
  leadMaskName,
  leadStageBadge,
  leadStageLabel
} from "../../lib/company-leads";
import { fmtDate } from "../../lib/format";
import { US_STATES } from "../../lib/us-states";
import {
  fetchCompanyLeadCounts,
  fetchCompanyLeadsPage,
  LEADS_PAGE_SIZE
} from "../../services/companyLeads";
import type { CompanyLead, CompanyLeadFilters } from "../../types/company-leads";

const initialFilters: CompanyLeadFilters = {
  bucket: "all",
  search: "",
  stage: "",
  driverType: "",
  state: "",
  source: "",
  dateFrom: "",
  dateTo: ""
};

export function CompanyLeadsPanel() {
  const [filters, setFilters] = useState<CompanyLeadFilters>(initialFilters);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<CompanyLead[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<CompanyLead | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [result, c] = await Promise.all([
        fetchCompanyLeadsPage(filters, { page, pageSize: LEADS_PAGE_SIZE }),
        fetchCompanyLeadCounts()
      ]);
      setRows(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setCounts(c);
    } catch {
      setRows([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchFilters = (patch: Partial<CompanyLeadFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const bucketCount = (key: string) => {
    if (key === "all") return counts.all ?? 0;
    const bucket = LEAD_PIPELINE_BUCKETS.find((b) => b.key === key);
    if (!bucket?.stages) return 0;
    return bucket.stages.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
  };

  return (
    <div className="company-leads-panel">
      <div className="tabs lead-bucket-tabs">
        {LEAD_PIPELINE_BUCKETS.map((b) => (
          <button
            key={b.key}
            type="button"
            className={`tab ${filters.bucket === b.key ? "active" : ""}`}
            onClick={() => patchFilters({ bucket: b.key, stage: "" })}
          >
            {b.label}
            <span className="lead-bucket-count">{bucketCount(b.key)}</span>
          </button>
        ))}
      </div>

      <div className="lead-filters-bar card">
        <div className="lead-filters-grid">
          <div className="form-group lead-search-group">
            <label>Search</label>
            <div className="lead-search-input">
              <Search className="icon-sm" />
              <input
                type="search"
                placeholder="Name, phone, email, state..."
                value={filters.search ?? ""}
                onChange={(e) => patchFilters({ search: e.target.value })}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Stage</label>
            <select
              value={filters.stage ?? ""}
              onChange={(e) => patchFilters({ stage: e.target.value, bucket: e.target.value ? "all" : filters.bucket })}
            >
              <option value="">All stages</option>
              {COMPANY_LEAD_STAGES.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Driver type</label>
            <select
              value={filters.driverType ?? ""}
              onChange={(e) => patchFilters({ driverType: e.target.value })}
            >
              <option value="">All types</option>
              {LEAD_DRIVER_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>State</label>
            <select value={filters.state ?? ""} onChange={(e) => patchFilters({ state: e.target.value })}>
              <option value="">All states</option>
              {US_STATES.map((s) => (
                <option key={s.code} value={s.code}>{s.code}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>From</label>
            <input type="date" value={filters.dateFrom ?? ""} onChange={(e) => patchFilters({ dateFrom: e.target.value })} />
          </div>
          <div className="form-group">
            <label>To</label>
            <input type="date" value={filters.dateTo ?? ""} onChange={(e) => patchFilters({ dateTo: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="lead-cards-list">
        {loading && rows.length === 0 ? (
          <p className="t-secondary">Loading leads...</p>
        ) : rows.length === 0 ? (
          <div className="card marketplace-empty">
            <p className="t-body">No leads yet</p>
            <p className="t-caption t-secondary">
              When platform admins assign driver leads to your company, they will appear here as horizontal cards.
            </p>
          </div>
        ) : (
          rows.map((lead) => (
            <button
              key={lead.id}
              type="button"
              className="lead-card-row card"
              onClick={() => setSelected(lead)}
            >
              <div className="lead-card-avatar"><User className="icon-md" /></div>
              <div className="lead-card-main">
                <div className="lead-card-title">
                  <strong>{leadMaskName(lead)}</strong>
                  <span className={`badge ${leadStageBadge(lead.stage)}`}>{leadStageLabel(lead.stage)}</span>
                </div>
                <div className="t-caption t-secondary">
                  {lead.cdl_class || "Class A"}
                  {lead.state ? ` · ${lead.state}` : ""}
                  {lead.driver_type ? ` · ${lead.driver_type}` : ""}
                  {lead.years_experience != null ? ` · ${lead.years_experience} yrs` : ""}
                </div>
                <div className="t-caption t-secondary">
                  {lead.phone || lead.email || "No contact on file"}
                  {lead.notes_preview ? ` · ${lead.notes_preview.slice(0, 80)}${lead.notes_preview.length > 80 ? "…" : ""}` : ""}
                </div>
              </div>
              <div className="lead-card-side">
                <span className="t-caption t-secondary">{fmtDate(lead.assigned_at)}</span>
                <ChevronRight className="icon-md" />
              </div>
            </button>
          ))
        )}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={LEADS_PAGE_SIZE}
        loading={loading}
        onPageChange={setPage}
      />

      {selected ? (
        <CompanyLeadDetailModal
          lead={selected}
          onClose={() => setSelected(null)}
          onUpdated={(next) => {
            setSelected(next);
            setRows((prev) => prev.map((r) => (r.id === next.id ? next : r)));
            void fetchCompanyLeadCounts().then(setCounts).catch(() => undefined);
          }}
        />
      ) : null}
    </div>
  );
}
