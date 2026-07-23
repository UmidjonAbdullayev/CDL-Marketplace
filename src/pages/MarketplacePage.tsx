import { useEffect, useState } from "react";
import {
  ChevronDown,
  Flame,
  LayoutGrid,
  LayoutList,
  SearchX,
  SlidersHorizontal
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  DriverMarketplaceCard,
  type MarketplaceCardLayout
} from "../components/marketplace/DriverMarketplaceCard";
import { DriverProfileModal } from "../components/marketplace/DriverProfileModal";
import { Pagination } from "../components/ui/Pagination";
import { useApp } from "../context/AppContext";
import { useExchangeData } from "../context/ExchangeDataContext";
import { DRIVER_TYPES, POSTED_WITHIN_OPTIONS } from "../lib/driver-types";
import { PageHeader } from "../lib/badges";
import {
  isCarrierMarketplaceVerified,
  isOwnRecruiterListing,
  isRecruiterAccount,
  marketplacePriceDisplay
} from "../lib/marketplace-display";
import { registerReturnPath } from "../lib/public-routes";
import { US_STATES } from "../lib/us-states";
import { DEFAULT_PAGE_SIZE } from "../services/marketplace";
import type { DriverCard } from "../types";

const LAYOUT_STORAGE_KEY = "marketplace-card-layout";

function readStoredLayout(): MarketplaceCardLayout {
  try {
    const v = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (v === "grid" || v === "list") return v;
  } catch {
    /* ignore */
  }
  return "list";
}

function activeFilterCount(
  filters: ReturnType<typeof useExchangeData>["marketplaceFilters"],
  sessionUser: ReturnType<typeof useApp>["sessionUser"]
): number {
  let n = 0;
  if (filters.state) n++;
  if (filters.cdl) n++;
  if (filters.exp > 0) n++;
  if (filters.equip) n++;
  if (filters.score) n++;
  if (!isRecruiterAccount(sessionUser) && (filters.priceMin > 0 || filters.priceMax < 99999)) n++;
  if (filters.verified) n++;
  if (filters.driverType) n++;
  if (filters.postedWithin) n++;
  return n;
}

export default function MarketplacePage() {
  const navigate = useNavigate();
  const { sessionUser, isSignedIn, showToast } = useApp();
  const {
    marketplaceFilters: filters,
    setMarketplaceFilters: setFilters,
    marketplacePage: page,
    setMarketplacePage: setPage,
    resetMarketplaceFilters,
    marketplaceDrivers: drivers,
    marketplaceTotal: total,
    marketplaceTotalPages: totalPages,
    marketplaceLoading: loading,
    marketplaceRefreshing: refreshing,
    marketplaceHasLoaded: hasLoaded,
    marketplaceHotOnly: hotOnly,
    setMarketplaceHotOnly: setHotOnly
  } = useExchangeData();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [profileDriver, setProfileDriver] = useState<DriverCard | null>(null);
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [cardLayout, setCardLayout] = useState<MarketplaceCardLayout>(readStoredLayout);

  useEffect(() => {
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, cardLayout);
    } catch {
      /* ignore */
    }
  }, [cardLayout]);

  const filterCount = activeFilterCount(filters, sessionUser);
  const showLoader = (!hasLoaded && loading) || ((loading || refreshing) && drivers.length === 0);
  const showEmpty = hasLoaded && !loading && !refreshing && drivers.length === 0;
  const carrierNeedsVerification =
    sessionUser?.accountType === "carrier" && !isCarrierMarketplaceVerified(sessionUser);

  const toggleSave = (id: number) => {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startHiring = (driver: DriverCard) => {
    setProfileDriver(null);
    if (!sessionUser) {
      navigate(`/register?intent=hire&returnTo=${encodeURIComponent(registerReturnPath("/marketplace"))}`);
      return;
    }
    navigate(`/hiring/contract/${driver.id}`);
  };

  return (
    <div className="page active marketplace-page">
      {!isSignedIn ? (
        <div className="marketplace-guest-banner card">
          <strong>Browse drivers free — register to hire</strong>
          <p className="t-caption t-secondary">
            Explore the full marketplace without an account. When you are ready to start hiring, create a carrier account.
          </p>
          <Link to="/register?intent=hire" className="btn btn-primary btn-sm">Register to Hire</Link>
        </div>
      ) : null}
      {carrierNeedsVerification ? (
        <div className="marketplace-verify-banner card">
          <strong>Verification required to view recruiting fees</strong>
          <p className="t-caption t-secondary">
            You can browse driver listings now. Once an admin verifies your MC number and company profile,
            pricing and hiring will unlock.
          </p>
        </div>
      ) : null}
      <PageHeader
        title={hotOnly ? "Trending Listings" : "Marketplace"}
        desc={
          hotOnly
            ? "Hot listings right now — high demand drivers trending among buyers."
            : "Browse and purchase verified CDL driver leads from trusted sellers."
        }
      />
      {hotOnly ? (
        <div className="marketplace-hot-banner">
          <Flame className="icon-md" />
          <span>Showing trending listings with hot scores 80+</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setHotOnly(false)}>
            View all listings
          </button>
        </div>
      ) : null}

      <div className="marketplace-layout">
        <div className={`filters-panel filters-panel--collapsible ${filtersOpen ? "is-open" : ""}`} id="filtersPanel">
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
            <div className="filters-panel-grid">
              <div className="filter-group">
                <label>State</label>
                <select value={filters.state} onChange={(e) => setFilters((f) => ({ ...f, state: e.target.value }))}>
                  <option value="">All States</option>
                  {US_STATES.map((s) => (
                    <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <label>Driver Type</label>
                <select
                  value={filters.driverType}
                  onChange={(e) => setFilters((f) => ({ ...f, driverType: e.target.value }))}
                >
                  <option value="">All Types</option>
                  {DRIVER_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <label>Posted</label>
                <select
                  value={filters.postedWithin}
                  onChange={(e) => setFilters((f) => ({ ...f, postedWithin: e.target.value }))}
                >
                  {POSTED_WITHIN_OPTIONS.map((o) => (
                    <option key={o.value || "any"} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <label>CDL Class</label>
                <select value={filters.cdl} onChange={(e) => setFilters((f) => ({ ...f, cdl: e.target.value }))}>
                  <option value="">All Classes</option>
                  <option>Class A</option>
                  <option>Class B</option>
                </select>
              </div>
              <div className="filter-group filter-group--sm">
                <label>Min Exp (yrs)</label>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={filters.exp === 0 ? "" : filters.exp}
                  onChange={(e) => setFilters((f) => ({ ...f, exp: Number(e.target.value || 0) }))}
                />
              </div>
              <div className="filter-group">
                <label>Equipment</label>
                <select value={filters.equip} onChange={(e) => setFilters((f) => ({ ...f, equip: e.target.value }))}>
                  <option value="">All Equipment</option>
                  <option>Dry Van</option>
                  <option>Reefer</option>
                  <option>Flatbed</option>
                  <option>Tanker</option>
                  <option>Intermodal</option>
                  <option>Box Truck</option>
                </select>
              </div>
              <div className="filter-group">
                <label>CDL Score</label>
                <select value={filters.score} onChange={(e) => setFilters((f) => ({ ...f, score: e.target.value }))}>
                  <option value="">All</option>
                  <option value="green">Green</option>
                  <option value="yellow">Yellow</option>
                  <option value="red">Red</option>
                </select>
              </div>
              {isRecruiterAccount(sessionUser) ? null : (
              <div className="filter-group filter-group--price">
                <label>Price Range</label>
                <div className="filter-price-row">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.priceMin === 0 ? "" : filters.priceMin}
                    onChange={(e) => setFilters((f) => ({ ...f, priceMin: Number(e.target.value || 0) }))}
                  />
                  <span className="filter-price-sep">–</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.priceMax === 99999 ? "" : filters.priceMax}
                    onChange={(e) => setFilters((f) => ({ ...f, priceMax: Number(e.target.value || 99999) }))}
                  />
                </div>
              </div>
              )}
              <label className="filter-check filter-check--inline">
                <input
                  type="checkbox"
                  checked={filters.verified}
                  onChange={(e) => setFilters((f) => ({ ...f, verified: e.target.checked }))}
                />
                Verified only
              </label>
              <div className="filter-actions">
                <button className="btn btn-secondary btn-sm" onClick={resetMarketplaceFilters}>Reset</button>
              </div>
            </div>
          </div>
        </div>

        <div className="marketplace-results">
          <div className="marketplace-results-head">
            <div className="marketplace-results-count">
              {refreshing ? (
                <span className="loading-inline">Updating...</span>
              ) : (
                <><strong>{total}</strong> drivers found</>
              )}
            </div>
            <div className="marketplace-view-toggle" role="group" aria-label="Card layout">
              <button
                type="button"
                className={`marketplace-view-btn ${cardLayout === "list" ? "active" : ""}`}
                aria-pressed={cardLayout === "list"}
                title="List view"
                onClick={() => setCardLayout("list")}
              >
                <LayoutList size={16} />
              </button>
              <button
                type="button"
                className={`marketplace-view-btn ${cardLayout === "grid" ? "active" : ""}`}
                aria-pressed={cardLayout === "grid"}
                title="Grid view"
                onClick={() => setCardLayout("grid")}
              >
                <LayoutGrid size={16} />
              </button>
            </div>
          </div>

          {showLoader ? (
            <div className="marketplace-loader card">
              <div className="marketplace-loader-spinner" aria-hidden />
              <p className="t-body">{hasLoaded ? "Searching listings..." : "Loading marketplace listings..."}</p>
              <p className="t-caption t-secondary">Finding the best driver leads for you</p>
            </div>
          ) : showEmpty ? (
            <div className="marketplace-empty card">
              <SearchX className="marketplace-empty-icon" />
              <h3>No drivers found</h3>
              <p className="t-secondary">
                No listings match your current search and filters. Try broadening your criteria or resetting filters.
              </p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={resetMarketplaceFilters}>
                Reset filters
              </button>
            </div>
          ) : (
            <div
              className={`${cardLayout === "grid" ? "marketplace-cards-grid" : "marketplace-cards-list"} ${refreshing ? "is-loading" : ""}`}
              id="driverGrid"
            >
              {drivers.map((d) => (
                <DriverMarketplaceCard
                  key={d.id}
                  driver={d}
                  layout={cardLayout}
                  priceDisplay={marketplacePriceDisplay(sessionUser, d)}
                  sessionUser={sessionUser}
                  saved={saved.has(d.id)}
                  ownListing={isOwnRecruiterListing(sessionUser, d)}
                  onOpen={() => setProfileDriver(d)}
                  onSave={() => toggleSave(d.id)}
                  onStartHiring={() => startHiring(d)}
                  onInvoice={() => {
                    setProfileDriver(d);
                    showToast("Invoice details are available in the hiring workspace.", "success");
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
            loading={loading || refreshing}
            onPageChange={setPage}
          />
        </div>
      </div>

      {profileDriver ? (
        <DriverProfileModal
          driver={profileDriver}
          saved={saved.has(profileDriver.id)}
          sessionUser={sessionUser}
          onClose={() => setProfileDriver(null)}
          onSave={() => toggleSave(profileDriver.id)}
        />
      ) : null}
    </div>
  );
}
