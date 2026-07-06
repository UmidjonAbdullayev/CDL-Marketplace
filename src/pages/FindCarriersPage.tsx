import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  ChevronDown,
  Clock,
  DollarSign,
  MapPin,
  SearchX,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  Users
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CarrierDetailModal } from "../components/carriers/CarrierDetailModal";
import { Pagination } from "../components/ui/Pagination";
import { useApp } from "../context/AppContext";
import { isSellerNav } from "../lib/account-capabilities";
import { PageHeader, StarRating, VerifiedBadge } from "../lib/badges";
import { CARRIER_PLANS } from "../lib/carrier-plans";
import { US_STATES } from "../lib/us-states";
import { DEFAULT_PAGE_SIZE } from "../services/marketplace";
import { fetchCarrierDirectory, fetchCarrierDirectoryStates } from "../services/carriers";
import type { CarrierCard, CarrierDirectoryFilters } from "../types/carriers";
import type { CarrierPlanId } from "../types/registration";

const initialFilters: CarrierDirectoryFilters = {
  plan: "",
  state: "",
  verifiedOnly: false,
  search: ""
};

function planBadgeClass(plan: CarrierPlanId): string {
  switch (plan) {
    case "pro_fleet":
      return "badge-purple";
    case "growth":
      return "badge-blue";
    case "starter":
      return "badge-green";
    default:
      return "badge-gray";
  }
}

function OfferCell({ icon: Icon, label, value }: { icon: typeof DollarSign; label: string; value: string }) {
  return (
    <div className="carrier-row-offer">
      <Icon className="icon-sm carrier-row-offer-icon" />
      <div>
        <div className="carrier-row-offer-label">{label}</div>
        <div className="carrier-row-offer-value">{value || "—"}</div>
      </div>
    </div>
  );
}

export default function FindCarriersPage() {
  const navigate = useNavigate();
  const { sessionUser, showToast } = useApp();
  const [filters, setFilters] = useState<CarrierDirectoryFilters>(initialFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [carriers, setCarriers] = useState<CarrierCard[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [states, setStates] = useState<string[]>([]);
  const [selectedCarrier, setSelectedCarrier] = useState<CarrierCard | null>(null);

  const filterCount = useMemo(() => {
    let n = 0;
    if (filters.plan) n++;
    if (filters.state) n++;
    if (filters.verifiedOnly) n++;
    if (filters.search?.trim()) n++;
    return n;
  }, [filters]);

  useEffect(() => {
    if (sessionUser && !isSellerNav(sessionUser)) {
      navigate("/marketplace", { replace: true });
    }
  }, [sessionUser, navigate]);

  useEffect(() => {
    void fetchCarrierDirectoryStates().then(setStates).catch(() => setStates([]));
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

  const resetFilters = () => {
    setFilters(initialFilters);
    setPage(1);
  };

  return (
    <div className="page active marketplace-page find-carriers-page">
      <PageHeader
        title="Find Carriers"
        desc="Browse hiring companies that fit your available drivers — compare pay, home time, lanes, and send drivers directly."
      />

      <div className="marketplace-layout">
        <div className={`filters-panel filters-panel--collapsible ${filtersOpen ? "is-open" : ""}`}>
          <button
            type="button"
            className="filters-panel-toggle"
            onClick={() => setFiltersOpen((o) => !o)}
            aria-expanded={filtersOpen}
          >
            <div className="filters-panel-toggle-left">
              <SlidersHorizontal className="icon-md" />
              <span>Search &amp; Filters</span>
              {filterCount > 0 ? <span className="filters-active-count">{filterCount} active</span> : null}
            </div>
            <ChevronDown className={`icon-md filters-chevron ${filtersOpen ? "is-open" : ""}`} />
          </button>

          <div className="filters-panel-body">
            <div className="form-group">
              <label>Search carriers</label>
              <input
                type="search"
                placeholder="Company, MC, specialization..."
                value={filters.search ?? ""}
                onChange={(e) => {
                  setFilters((f) => ({ ...f, search: e.target.value }));
                  setPage(1);
                }}
              />
            </div>
            <div className="form-group">
              <label>Plan tier</label>
              <select
                value={filters.plan ?? ""}
                onChange={(e) => {
                  setFilters((f) => ({ ...f, plan: e.target.value as CarrierPlanId | "" }));
                  setPage(1);
                }}
              >
                <option value="">All plans</option>
                {CARRIER_PLANS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>State</label>
              <select
                value={filters.state ?? ""}
                onChange={(e) => {
                  setFilters((f) => ({ ...f, state: e.target.value }));
                  setPage(1);
                }}
              >
                <option value="">All states</option>
                {(states.length ? states : US_STATES.map((s) => s.code)).map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </div>
            <label className="filters-check">
              <input
                type="checkbox"
                checked={Boolean(filters.verifiedOnly)}
                onChange={(e) => {
                  setFilters((f) => ({ ...f, verifiedOnly: e.target.checked }));
                  setPage(1);
                }}
              />
              Verified MC &amp; profile only
            </label>
            {filterCount > 0 ? (
              <button type="button" className="btn btn-secondary btn-sm btn-block" onClick={resetFilters}>
                Reset filters
              </button>
            ) : null}
          </div>
        </div>

        <div className="marketplace-results">
          <div className="marketplace-results-head">
            <div className="t-secondary">
              {loading ? (
                <span className="loading-inline">Loading carriers...</span>
              ) : (
                <><span>{total}</span> carrier companies</>
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
            <div className={`carrier-row-list ${loading ? "is-loading" : ""}`}>
              {carriers.map((c) => {
                const planMeta = CARRIER_PLANS.find((p) => p.id === c.plan);
                return (
                  <button
                    key={c.id}
                    type="button"
                    className="carrier-row-card card"
                    onClick={() => setSelectedCarrier(c)}
                  >
                    <div className="carrier-row-identity">
                      <div className="carrier-row-avatar"><Building2 className="icon-md" /></div>
                      <div className="carrier-row-name-block">
                        <div className="carrier-row-name-row">
                          <h4>{c.name}</h4>
                          <span className={`badge ${planBadgeClass(c.plan)}`}>{c.planLabel}</span>
                          {c.mcVerified && c.profileVerified ? (
                            <VerifiedBadge text="Verified" />
                          ) : (
                            <span className="badge badge-gray"><ShieldCheck className="icon-sm" /> Pending</span>
                          )}
                        </div>
                        <div className="t-caption t-secondary">
                          {c.mcNumber || "Carrier"} {c.state ? `· ${c.state}` : ""}
                          {c.specialization ? ` · ${c.specialization}` : ""}
                        </div>
                        <div className="carrier-row-rating">
                          <StarRating rating={c.rating} />
                          <span className="t-caption t-secondary">
                            {c.leadsPurchased > 0 ? `${c.leadsPurchased} hires` : "New carrier"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="carrier-row-offers">
                      <OfferCell icon={DollarSign} label="Pay range" value={c.driverPayRange || "Contact for rates"} />
                      <OfferCell icon={Clock} label="Home time" value={c.homeTimePolicy || "Not specified"} />
                      <OfferCell icon={MapPin} label="Locations / lanes" value={c.operatingRegions || c.serviceArea} />
                      <OfferCell icon={Truck} label="Fleet" value={c.fleetSize ? `${c.fleetSize} trucks` : "—"} />
                      <OfferCell icon={Users} label="Plan" value={planMeta?.priceLabel ?? "Free"} />
                    </div>

                    <div className="carrier-row-action">
                      <span className="btn btn-primary btn-sm">View &amp; send driver</span>
                    </div>
                  </button>
                );
              })}
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
        <CarrierDetailModal
          carrier={selectedCarrier}
          recruiterCompanyId={sessionUser.companyId}
          onClose={() => setSelectedCarrier(null)}
          onSent={() => setSelectedCarrier(null)}
          showToast={showToast}
        />
      ) : null}
    </div>
  );
}
