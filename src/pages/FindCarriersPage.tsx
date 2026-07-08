import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ChevronDown, SearchX, SlidersHorizontal } from "lucide-react";
import { CarrierMarketplaceCard } from "../components/marketplace/CarrierMarketplaceCard";
import { CarrierProfileModal } from "../components/marketplace/CarrierProfileModal";
import { Pagination } from "../components/ui/Pagination";
import { useApp } from "../context/AppContext";
import { isSellerNav } from "../lib/account-capabilities";
import {
  activeCarrierFilterCount,
  CARRIER_EQUIPMENT_OPTIONS,
  CARRIER_FLEET_SIZE_OPTIONS,
  CARRIER_HOME_TIME_OPTIONS,
  CARRIER_MIN_RATING_OPTIONS,
  initialCarrierFilters
} from "../lib/carrier-filters";
import { PageHeader } from "../lib/badges";
import { CARRIER_PLANS } from "../lib/carrier-plans";
import { US_STATES } from "../lib/us-states";
import { DEFAULT_PAGE_SIZE } from "../services/marketplace";
import {
  fetchCarrierDirectory,
  fetchCarrierDirectoryRegions,
  fetchCarrierDirectoryStates
} from "../services/carriers";
import type { CarrierCard, CarrierDirectoryFilters } from "../types/carriers";
import type { CarrierPlanId } from "../types/registration";

function CarrierFiltersPanel({
  filters,
  states,
  regions,
  filterCount,
  onChange,
  onReset
}: {
  filters: CarrierDirectoryFilters;
  states: string[];
  regions: string[];
  filterCount: number;
  onChange: (next: CarrierDirectoryFilters) => void;
  onReset: () => void;
}) {
  const update = (patch: Partial<CarrierDirectoryFilters>) => onChange({ ...filters, ...patch });

  return (
    <>
      <div className="form-group">
        <label>Search carriers</label>
        <input
          type="search"
          placeholder="Company, MC, lanes..."
          value={filters.search ?? ""}
          onChange={(e) => update({ search: e.target.value })}
        />
      </div>

      <div className="form-group">
        <label>Equipment type</label>
        <select value={filters.equipment ?? ""} onChange={(e) => update({ equipment: e.target.value })}>
          <option value="">All equipment</option>
          {CARRIER_EQUIPMENT_OPTIONS.map((eq) => (
            <option key={eq} value={eq}>{eq}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Home time</label>
        <select value={filters.homeTime ?? ""} onChange={(e) => update({ homeTime: e.target.value })}>
          {CARRIER_HOME_TIME_OPTIONS.map((opt) => (
            <option key={opt.value || "any"} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Region / lanes</label>
        <select value={filters.region ?? ""} onChange={(e) => update({ region: e.target.value })}>
          <option value="">All regions</option>
          {regions.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>State</label>
        <select value={filters.state ?? ""} onChange={(e) => update({ state: e.target.value })}>
          <option value="">All states</option>
          {(states.length ? states : US_STATES.map((s) => s.code)).map((code) => (
            <option key={code} value={code}>{code}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Fleet size</label>
        <select value={filters.fleetSize ?? ""} onChange={(e) => update({ fleetSize: e.target.value })}>
          {CARRIER_FLEET_SIZE_OPTIONS.map((opt) => (
            <option key={opt.value || "any"} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Minimum rating</label>
        <select
          value={String(filters.minRating ?? 0)}
          onChange={(e) => update({ minRating: Number(e.target.value) })}
        >
          {CARRIER_MIN_RATING_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Plan tier</label>
        <select
          value={filters.plan ?? ""}
          onChange={(e) => update({ plan: e.target.value as CarrierPlanId | "" })}
        >
          <option value="">All plans</option>
          {CARRIER_PLANS.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <label className="filters-check">
        <input
          type="checkbox"
          checked={Boolean(filters.hasPayRange)}
          onChange={(e) => update({ hasPayRange: e.target.checked })}
        />
        Pay range listed
      </label>

      <label className="filters-check">
        <input
          type="checkbox"
          checked={Boolean(filters.verifiedOnly)}
          onChange={(e) => update({ verifiedOnly: e.target.checked })}
        />
        Verified MC &amp; profile only
      </label>

      {filterCount > 0 ? (
        <button type="button" className="btn btn-secondary btn-sm btn-block" onClick={onReset}>
          Reset filters
        </button>
      ) : null}
    </>
  );
}

export default function FindCarriersPage() {
  const location = useLocation();
  const preselectedListingId = (location.state as { listingId?: number } | null)?.listingId;
  const { sessionUser, showToast } = useApp();
  const [filters, setFilters] = useState<CarrierDirectoryFilters>(initialCarrierFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [carriers, setCarriers] = useState<CarrierCard[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [states, setStates] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [selectedCarrier, setSelectedCarrier] = useState<CarrierCard | null>(null);
  const [carrierModalTab, setCarrierModalTab] = useState<"overview" | "send">("overview");

  const isRecruiter = isSellerNav(sessionUser);
  const filterCount = activeCarrierFilterCount(filters);

  useEffect(() => {
    void Promise.all([fetchCarrierDirectoryStates(), fetchCarrierDirectoryRegions()])
      .then(([s, r]) => {
        setStates(s);
        setRegions(r);
      })
      .catch(() => {
        setStates([]);
        setRegions([]);
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    void fetchCarrierDirectory(filters, { page, pageSize: DEFAULT_PAGE_SIZE })
      .then((result) => {
        setCarriers(result.items);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      })
      .catch(() => {
        setCarriers([]);
        setTotal(0);
        setTotalPages(1);
      })
      .finally(() => setLoading(false));
  }, [filters, page]);

  const applyFilters = (next: CarrierDirectoryFilters) => {
    setFilters(next);
    setPage(1);
  };

  const resetFilters = () => {
    setFilters(initialCarrierFilters);
    setPage(1);
  };

  return (
    <div className="page active marketplace-page find-carriers-page">
      <PageHeader
        title="Find Carriers"
        desc={
          isRecruiter
            ? "Browse hiring companies that fit your available drivers — compare pay, home time, lanes, and send drivers directly."
            : "Browse carrier companies on the platform — compare pay ranges, home time, lanes, and hiring activity."
        }
      />

      <div className="marketplace-grid">
        <aside className="filter-sidebar-cdlone find-carriers-filters-desktop">
          <div className="filter-sidebar-header">
            <h3>Filters</h3>
            {filterCount > 0 ? (
              <button type="button" className="filter-clear" onClick={resetFilters}>Clear all</button>
            ) : null}
          </div>
          <div className="filter-sidebar-body">
            <CarrierFiltersPanel
              filters={filters}
              states={states}
              regions={regions}
              filterCount={filterCount}
              onChange={applyFilters}
              onReset={resetFilters}
            />
          </div>
        </aside>

        <div className={`find-carriers-filters-mobile filters-panel filters-panel--collapsible ${filtersOpen ? "is-open" : ""}`}>
          <button
            type="button"
            className="filters-panel-toggle"
            onClick={() => setFiltersOpen((o) => !o)}
            aria-expanded={filtersOpen}
          >
            <div className="filters-panel-toggle-left">
              <SlidersHorizontal className="icon-md" />
              <span>Filters</span>
              {filterCount > 0 ? <span className="filters-active-count">{filterCount} active</span> : null}
            </div>
            <ChevronDown className={`icon-md filters-chevron ${filtersOpen ? "is-open" : ""}`} />
          </button>
          <div className="filters-panel-body">
            <div className="find-carriers-filters-body">
              <CarrierFiltersPanel
                filters={filters}
                states={states}
                regions={regions}
                filterCount={filterCount}
                onChange={applyFilters}
                onReset={resetFilters}
              />
            </div>
          </div>
        </div>

        <div className="marketplace-results find-carriers-results">
          <div className="marketplace-results-head">
            <div className="marketplace-results-count">
              {loading ? (
                <span className="loading-inline">Loading carriers...</span>
              ) : (
                <><strong>{total}</strong> carriers found</>
              )}
            </div>
          </div>

          {loading && carriers.length === 0 ? (
            <div className="marketplace-loader card">
              <div className="marketplace-loader-spinner" aria-hidden />
              <p className="t-body">Loading carrier directory...</p>
              <p className="t-caption t-secondary">Finding hiring companies for your drivers</p>
            </div>
          ) : !loading && carriers.length === 0 ? (
            <div className="marketplace-empty card">
              <SearchX className="marketplace-empty-icon" />
              <h3>No carriers found</h3>
              <p className="t-secondary">Try adjusting filters or search terms.</p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={resetFilters}>
                Reset filters
              </button>
            </div>
          ) : (
            <div className={`carrier-cards-list ${loading ? "is-loading" : ""}`}>
              {carriers.map((carrier) => (
                <CarrierMarketplaceCard
                  key={carrier.id}
                  carrier={carrier}
                  isRecruiter={isRecruiter}
                  onOpen={() => {
                    setCarrierModalTab("overview");
                    setSelectedCarrier(carrier);
                  }}
                  onSendDriver={() => {
                    setCarrierModalTab("send");
                    setSelectedCarrier(carrier);
                  }}
                />
              ))}
            </div>
          )}

          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={DEFAULT_PAGE_SIZE}
            loading={loading}
            onPageChange={setPage}
          />
        </div>
      </div>

      {selectedCarrier && sessionUser?.companyId ? (
        <CarrierProfileModal
          carrier={selectedCarrier}
          recruiterCompanyId={sessionUser.companyId}
          isRecruiter={isRecruiter}
          initialTab={carrierModalTab}
          preselectedListingId={preselectedListingId}
          onClose={() => setSelectedCarrier(null)}
          onSent={() => setSelectedCarrier(null)}
          showToast={showToast}
        />
      ) : null}
    </div>
  );
}
