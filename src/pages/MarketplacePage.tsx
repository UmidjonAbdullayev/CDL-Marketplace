import { useState } from "react";
import {
  Briefcase,
  Calendar,
  ChevronDown,
  Clock,
  Flame,
  SearchX,
  SlidersHorizontal,
  Truck,
  User
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { Pagination } from "../components/ui/Pagination";
import { useApp } from "../context/AppContext";
import { useExchangeData } from "../context/ExchangeDataContext";
import { DriverPreferencesPanel } from "../components/listing/DriverPreferencesPanel";
import { DRIVER_TYPES, POSTED_WITHIN_OPTIONS } from "../lib/driver-types";
import { PageHeader, ScoreBadge, StarRating, VerifiedBadge } from "../lib/badges";
import { driverInitials, fmtDate, fmtPostedAt, fmtRecruitingFee, maskName } from "../lib/format";
import { isCarrierMarketplaceVerified, isOwnRecruiterListing, isRecruiterAccount, marketplacePriceDisplay } from "../lib/marketplace-display";
import { US_STATES } from "../lib/us-states";
import { DEFAULT_PAGE_SIZE } from "../services/marketplace";

function driverTypeBadgeClass(type: string): string {
  switch (type) {
    case "Company Driver": return "badge-blue";
    case "Team": return "badge-purple";
    case "Lease": return "badge-yellow";
    default: return "badge-gray";
  }
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
  const { sessionUser, isSignedIn } = useApp();
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
    setMarketplaceHotOnly: setHotOnly,
    trendingListingIds
  } = useExchangeData();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterCount = activeFilterCount(filters, sessionUser);
  const showLoader = (!hasLoaded && loading) || ((loading || refreshing) && drivers.length === 0);
  const showEmpty = hasLoaded && !loading && !refreshing && drivers.length === 0;
  const carrierNeedsVerification =
    sessionUser?.accountType === "carrier" && !isCarrierMarketplaceVerified(sessionUser);

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
            <div className="t-secondary">
              {refreshing ? (
                <span className="loading-inline">Updating...</span>
              ) : (
                <><span id="resultCount">{total}</span> drivers available</>
              )}
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
            <div className={`driver-grid driver-grid--3 ${refreshing ? "is-loading" : ""}`} id="driverGrid">
              {drivers.map((d) => {
                const ownListing = isOwnRecruiterListing(sessionUser, d);
                const priceDisplay = marketplacePriceDisplay(sessionUser, d);
                const cardClass = [
                  "driver-card",
                  d.featured ? "driver-card--featured" : "",
                  d.isTrending || trendingListingIds.has(d.id) ? "driver-card--trending" : "",
                  ownListing ? "driver-card--own-listing" : ""
                ].filter(Boolean).join(" ");

                const cardContent = (
                  <>
                    <div className="driver-card-badges">
                      <span className={`badge ${driverTypeBadgeClass(d.driverType)} driver-badge`}>
                        <User className="icon-sm" /> {d.driverType}
                      </span>
                    </div>
                    <div className="driver-card-top">
                      <div style={{ display: "flex", gap: "var(--s3)", alignItems: "flex-start", flex: 1, minWidth: 0 }}>
                        <div className="driver-avatar">{driverInitials(d)}</div>
                        <div>
                          <h4>{maskName(d)}</h4>
                          <div className="driver-sub">{d.state} · {d.cdl}</div>
                          <div className="driver-posted"><Clock className="icon-sm" />{fmtPostedAt(d.createdAt)}</div>
                        </div>
                      </div>
                      <ScoreBadge score={d.score} />
                    </div>
                    <div className="driver-meta">
                      <span className={`driver-meta-item driver-meta-exp${d.expYears === 0 && d.expMonths === 0 ? " driver-meta-exp--training" : ""}`}>
                        <Briefcase className="icon-sm" />{d.expLabel}
                      </span>
                      <span className="driver-meta-item"><Truck className="icon-sm" />{d.equip}</span>
                      <span className="driver-meta-item"><Calendar className="icon-sm" />Avail {fmtDate(d.avail)}</span>
                    </div>
                    <DriverPreferencesPanel
                      compact
                      driverType={d.driverType}
                      preferences={{
                        desiredWeeklyPay: d.desiredWeeklyPay,
                        weeksOutPreference: d.weeksOutPreference,
                        maxDispatchFeePct: d.maxDispatchFeePct,
                        companyExpectations: d.companyExpectations
                      }}
                    />
                    <div className={`driver-price-row${priceDisplay === "hidden" ? " driver-price-row--no-price" : ""}`}>
                      <div>
                        {priceDisplay === "show" ? (
                          <>
                            <div className="driver-price">{fmtRecruitingFee(d.price)}</div>
                            <div className="driver-fee-label t-caption t-secondary">{d.priceLabel ?? "Platform recruiting fee"}</div>
                          </>
                        ) : priceDisplay === "blur" ? (
                          <div className="driver-price-blurred">
                            <span className="driver-price-blurred-value">$•••</span>
                            <span className="t-caption t-secondary">Verify account to view fee</span>
                          </div>
                        ) : null}
                        {d.isTrending || trendingListingIds.has(d.id) ? (
                          <span className="badge badge-red trending-badge"><Flame className="icon-sm" /> Trending</span>
                        ) : null}
                        {d.verified ? <VerifiedBadge text="Verified Listing" /> : null}
                      </div>
                      <div className="driver-seller"><StarRating rating={d.sellerRating} /><br />{d.seller}</div>
                    </div>
                  </>
                );

                return (
                  <div
                    key={d.id}
                    className={`${cardClass} driver-card--clickable`}
                    data-id={d.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/driver/${d.id}`)}
                    onKeyDown={(e) => e.key === "Enter" && navigate(`/driver/${d.id}`)}
                  >
                    {ownListing ? <div className="driver-card-own-label">Your listing</div> : null}
                    {d.featured ? <div className="driver-card-featured-label">featured</div> : null}
                    {cardContent}
                  </div>
                );
              })}
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
    </div>
  );
}
