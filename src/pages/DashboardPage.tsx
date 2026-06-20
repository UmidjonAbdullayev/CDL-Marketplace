import { useEffect, useRef, useState } from "react";
import Chart from "chart.js/auto";
import {
  Handshake,
  LineChart,
  Plus,
  Search,
  ShieldAlert,
  Users,
  Wallet,
  Zap
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SPARK_DATA } from "../data/dashboard";
import { useApp } from "../context/AppContext";
import { useExchangeData } from "../context/ExchangeDataContext";
import { fmtPrice, stripPricesFromText } from "../lib/format";
import {
  ActionListItem,
  ActivityFeedItem,
  CategoryRow,
  HotListingRow,
  QuickActionBtn,
  SellerListItem,
  SnapshotMetric
} from "../lib/dashboard-widgets";
import { CdlScoreVerifyModal } from "../components/CdlScoreVerifyModal";
const SNAPSHOT_PURPLE = "#7C3AED";

function createSnapshotChart(el: HTMLCanvasElement, data: number[]) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const pad = Math.max((max - min) * 0.25, 2);
  return new Chart(el, {
    type: "line",
    data: {
      labels: data.map((_, i) => i),
      datasets: [{
        data,
        borderColor: SNAPSHOT_PURPLE,
        backgroundColor: (ctx) => {
          const { chart } = ctx;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return `${SNAPSHOT_PURPLE}18`;
          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          g.addColorStop(0, `${SNAPSHOT_PURPLE}40`);
          g.addColorStop(1, `${SNAPSHOT_PURPLE}04`);
          return g;
        },
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        tension: 0.45,
        cubicInterpolationMode: "monotone"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: { x: { display: false }, y: { display: false, min: min - pad, max: max + pad } },
      animation: { duration: 900, easing: "easeOutQuart" }
    }
  });
}

function parseExp(value: string): number {
  if (value.includes("10")) return 10;
  if (value.includes("5")) return 5;
  if (value.includes("3")) return 3;
  return 0;
}

function parseScore(value: string): number {
  if (value.includes("90")) return 90;
  if (value.includes("85")) return 85;
  if (value.includes("80")) return 80;
  return 0;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))} minutes ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} hour${Math.floor(diff / 3600000) > 1 ? "s" : ""} ago`;
  return `${Math.floor(diff / 86400000)} day${Math.floor(diff / 86400000) > 1 ? "s" : ""} ago`;
}

function sellerInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { showToast, sessionUser } = useApp();
  const {
    dashboard,
    dashboardLoading,
    applyFindDriversFilters,
    cdlScoreVerified,
    refreshCdlScoreStatus
  } = useExchangeData();
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [dashState, setDashState] = useState("");
  const [dashExp, setDashExp] = useState("Experience: Any");
  const [dashClass, setDashClass] = useState("CDL Class: All");
  const [dashEquip, setDashEquip] = useState("Equipment: All");
  const [dashRoute, setDashRoute] = useState("Route: All");
  const [dashScore, setDashScore] = useState("Min CDL Score: Any");
  const snapshotCanvas = useRef<HTMLCanvasElement | null>(null);

  const {
    hotListings,
    dashStats,
    dealStats,
    activities,
    categories,
    upcomingActions,
    sellers
  } = dashboard;

  const runFindDrivers = () => {
    applyFindDriversFilters({
      state: dashState,
      exp: parseExp(dashExp),
      cdl: dashClass.includes("Class A") ? "Class A" : dashClass.includes("Class B") ? "Class B" : "",
      equip: dashEquip.replace("Equipment: ", "").replace("All", "").trim(),
      route: dashRoute.replace("Route: ", "").replace("All", "").trim(),
      minHotScore: parseScore(dashScore)
    });
    navigate("/marketplace");
  };

  useEffect(() => {
    const canvas = snapshotCanvas.current;
    if (!canvas) return;
    const chart = createSnapshotChart(canvas, SPARK_DATA[0]);
    return () => chart.destroy();
  }, []);

  if (dashboardLoading && dashboard.loadedAt === 0) {
    return (
      <div className="page active dashboard-page">
        <p className="t-secondary">Loading dashboard...</p>
      </div>
    );
  }

  const activeDeals = dealStats.activeOngoing;

  return (
    <div className="page active dashboard-page">
      <div className="dash-head">
        <h2>Welcome back, {sessionUser?.name ?? "there"}! 👋</h2>
        <p>Here's what's happening in your marketplace today.</p>
      </div>

      <div className="dash-hero-row dashboard-section">
        <div className="card dash-snapshot-card">
          <div className="dash-snapshot-header">
            <div className="dash-card-title-icon purple"><LineChart /></div>
            <h3>Marketplace Snapshot</h3>
          </div>
          <div className="dash-snapshot-metrics">
            <SnapshotMetric
              iconCls="purple"
              icon={<Users />}
              label="Done Deals"
              value={String(dealStats.completed)}
              subtext="Completed engagements"
              subCls="up"
            />
            <SnapshotMetric
              iconCls="blue"
              icon={<Handshake />}
              label="Active Deals"
              value={String(activeDeals)}
              subtext={`${dealStats.pendingPayment} pending payment`}
              subCls="neutral"
            />
            <SnapshotMetric
              iconCls="orange"
              icon={<Wallet />}
              label="Escrow Balance"
              value={fmtPrice(dealStats.inEscrow)}
              subtext="↑ 8% vs last month"
              subCls="up"
            />
          </div>
          <div className="dash-snapshot-chart">
            <canvas ref={snapshotCanvas} />
          </div>
        </div>

        <div className="card dash-quick-actions-card">
          <div className="dash-quick-header">
            <div className="dash-card-title-icon purple"><Zap /></div>
            <h3>Quick Actions</h3>
          </div>
          <div className="quick-actions-grid">
            <QuickActionBtn
              iconCls="purple"
              icon={<Plus />}
              label="List a Driver"
              onClick={() => navigate("/sell")}
            />
            <QuickActionBtn
              iconCls="blue"
              icon={<Search />}
              label="Search Marketplace"
              onClick={() => navigate("/marketplace")}
            />
            <QuickActionBtn
              iconCls="green"
              icon={<Users />}
              label="View Active Deals"
              onClick={() => navigate("/deals")}
            />
            <QuickActionBtn
              iconCls="orange"
              icon={<Wallet />}
              label="Deposit Funds"
              onClick={() => showToast("Deposit flow coming soon", "success")}
            />
          </div>
        </div>
      </div>

      <div className="dashboard-row-2">
        <div className="card dash-card">
          <div className="card-header">
            <h3>Find Drivers</h3>
            <span className="find-drivers-hint"><Zap /> {dashStats.available} leads match your Pro filters</span>
          </div>
          <div className="card-body">
            <div className="find-drivers-enriched">
              <div className="find-drivers-stats">
                <div className="find-stat"><span className="find-stat-num">{dashStats.available}</span><span className="find-stat-lbl">Available now</span></div>
                <div className="find-stat"><span className="find-stat-num">{dashStats.classAOtr}</span><span className="find-stat-lbl">OTR · Class A</span></div>
                <div className="find-stat"><span className="find-stat-num">{dashStats.verifiedPct}%</span><span className="find-stat-lbl">CDL verified</span></div>
                <div className="find-stat"><span className="find-stat-num">{fmtPrice(dashStats.avgPrice)}</span><span className="find-stat-lbl">Avg lead price</span></div>
              </div>
              <div className="find-drivers-row">
                <select value={dashState} onChange={(e) => setDashState(e.target.value)}>
                  <option value="">Location: All States</option>
                  <option value="TX">TX</option><option value="CA">CA</option><option value="FL">FL</option>
                  <option value="OH">OH</option><option value="GA">GA</option><option value="IN">IN</option>
                </select>
                <select value={dashExp} onChange={(e) => setDashExp(e.target.value)}>
                  <option>Experience: Any</option><option>3+ years</option><option>5+ years</option><option>10+ years</option>
                </select>
                <select value={dashClass} onChange={(e) => setDashClass(e.target.value)}>
                  <option>CDL Class: All</option><option>Class A</option><option>Class B</option>
                </select>
                <select value={dashEquip} onChange={(e) => setDashEquip(e.target.value)}>
                  <option>Equipment: All</option><option>Dry Van</option><option>Reefer</option><option>Flatbed</option><option>Tanker</option>
                </select>
                <button type="button" className="btn btn-primary" onClick={runFindDrivers}>Search Drivers</button>
              </div>
              <div className="find-drivers-row secondary">
                <select value={dashRoute} onChange={(e) => setDashRoute(e.target.value)}>
                  <option>Route: All</option><option>OTR</option><option>Regional</option><option>Local</option>
                </select>
                <select value={dashScore} onChange={(e) => setDashScore(e.target.value)}>
                  <option>Min CDL Score: Any</option><option>80+</option><option>85+</option><option>90+</option>
                </select>
              </div>
              <div className="popular-searches">
                <span className="popular-label">Popular:</span>
                <button type="button" className="search-pill" onClick={() => navigate("/marketplace")}>Class A OTR <span className="pill-count">186</span></button>
                <button type="button" className="search-pill" onClick={() => navigate("/marketplace")}>Tanker TX <span className="pill-count">42</span></button>
                <button type="button" className="search-pill" onClick={() => navigate("/marketplace")}>Reefer CA <span className="pill-count">67</span></button>
                <button type="button" className="search-pill" onClick={() => navigate("/marketplace")}>Local Class B <span className="pill-count">28</span></button>
                <button type="button" className="search-pill" onClick={() => navigate("/marketplace")}>Hazmat <span className="pill-count">19</span></button>
              </div>
              <div className="find-trending">
                <span className="popular-label">Trending in your region:</span>
                <div className="find-trending-chips">
                  <button type="button" className="trend-chip" onClick={() => navigate("/marketplace")}><strong>TX · Dry Van</strong><span>48 new · 5+ yrs · $340–$520</span></button>
                  <button type="button" className="trend-chip" onClick={() => navigate("/marketplace")}><strong>CA · Reefer OTR</strong><span>31 new · CDL 85+ · $380–$610</span></button>
                  <button type="button" className="trend-chip" onClick={() => navigate("/marketplace")}><strong>FL · Tanker</strong><span>22 new · Hazmat · $550–$890</span></button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card dash-card">
          <div className="card-header">
            <h3>Hot Listings Right Now</h3>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate("/marketplace?hot=1")}>View All</button>
          </div>
          <div className="card-body card-body--flush" style={{ padding: "10px 14px 12px" }}>
            <div className="hot-listings">
              <div className="hot-listings-head">
                <span>Driver</span><span>Exp</span><span>ST</span><span>Route</span><span>Trailer</span><span>Score</span><span>Price</span>
              </div>
              {hotListings.map((item) => (
                <HotListingRow key={item.id} item={item} onClick={() => navigate(`/driver/${item.id}`)} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid-3">
        <div className="card dash-card dash-card--trio">
          <div className="card-header">
            <h3>Recent Marketplace Activity</h3>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate("/marketplace")}>View All</button>
          </div>
          <div className="card-body card-body--flush dash-card-trio-body">
            <div className="dash-card-trio-scroll dash-card-trio-scroll--activity">
              <div className="activity-feed">
                {activities.slice(0, 6).map((a) => (
                  <ActivityFeedItem
                    key={a.id}
                    type={a.activity_type as "sale" | "list" | "deal" | "user"}
                    title={a.title}
                    desc={stripPricesFromText(a.description)}
                    time={timeAgo(a.created_at)}
                    status={a.status_label}
                    statusCls={a.status_class}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="card dash-card dash-card--trio">
          <div className="card-header"><h3>Top Categories</h3></div>
          <div className="card-body card-body--flush dash-card-trio-body">
            <div className="dash-card-trio-scroll">
              <div className="category-list">
                <div className="category-head"><span>Category</span><span>Volume</span><span>Share</span></div>
                {categories.length === 0 ? (
                  <p className="t-secondary" style={{ padding: "16px 14px" }}>No active listings yet — stats reflect live marketplace data.</p>
                ) : (
                  categories.map((c) => (
                    <CategoryRow key={c.id} name={c.name} listings={String(c.listings_count)} pct={c.sell_rate} cls={c.rate_class as "high" | "mid" | "low"} />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="card dash-card dash-card--trio">
          <div className="card-header"><h3>My Upcoming Actions</h3></div>
          <div className="card-body card-body--flush dash-card-trio-body">
            <div className="dash-card-trio-scroll">
              <div className="dash-list">
                {upcomingActions.map((a) => (
                  <ActionListItem
                    key={a.id}
                    initials={a.initials}
                    color={a.color}
                    name={a.title}
                    detail={a.detail}
                    time={a.timeLabel}
                    urgency={a.urgency}
                    onOpen={() => navigate(a.href)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-split">
        <div className="card dash-card">
          <div className="card-header"><h3>Top Sellers This Month</h3></div>
          <div className="card-body card-body--flush">
            <div className="dash-list">
              {sellers.length === 0 ? (
                <p className="t-secondary" style={{ padding: 16 }}>No completed deals this month yet.</p>
              ) : (
                sellers.map((s) => {
                  const company = Array.isArray(s.companies) ? s.companies[0] : s.companies;
                  const companyId = s.company_id ?? s.id;
                  return (
                    <SellerListItem
                      key={s.id}
                      rank={String(s.rank_position)}
                      rankCls={s.rank_class || undefined}
                      initials={sellerInitials(company?.name ?? "")}
                      name={company?.name ?? "—"}
                      rating={String(company?.rating ?? 4)}
                      sold={String(s.sold_count)}
                      rate={`${s.success_rate}%`}
                      onViewReviews={() => navigate(`/company/${companyId}/reviews`)}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {!cdlScoreVerified ? (
        <div className="verify-promo-banner" id="verifyBanner">
          <div className="verify-promo-icon"><ShieldAlert /></div>
          <div className="verify-promo-text">
            <strong>Verify Your CDL Score Account</strong>
            <span>Connect CDL Score to unlock full driver safety data on purchased leads.</span>
          </div>
          <div className="verify-promo-actions">
            <button type="button" className="btn-verify" onClick={() => setVerifyOpen(true)}>Verify Now</button>
            <button type="button" className="btn-verify-ghost" onClick={() => document.getElementById("verifyBanner")?.classList.add("hidden")}>Not now</button>
          </div>
        </div>
      ) : null}

      <CdlScoreVerifyModal
        open={verifyOpen}
        onClose={() => setVerifyOpen(false)}
        onVerified={() => void refreshCdlScoreStatus()}
      />
    </div>
  );
}
