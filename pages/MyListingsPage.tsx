import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, PlusCircle, User } from "lucide-react";
import { Pagination } from "../components/ui/Pagination";
import { SentDriverCard } from "../components/drivers/SentDriverCard";
import { PageHeader } from "../lib/badges";
import { useApp } from "../context/AppContext";
import { useExchangeData } from "../context/ExchangeDataContext";
import { canActAsCarrier, isSellerNav } from "../lib/account-capabilities";
import { DRIVER_TYPES } from "../lib/driver-types";
import { US_STATES } from "../lib/us-states";
import {
  DEFAULT_PAGE_SIZE,
  expireListing,
  fetchSellerListingDetail,
  updateListing,
  publishDraftListing,
  updateListingStatus,
  type SellerListingRow
} from "../services/marketplace";
import { fetchCarrierMarketplaceDrivers, type CarrierMarketplaceDriverRow } from "../services/hiring";
import { fetchCarrierSubmissionsPage, fetchRecruiterSubmissionsPage, type DriverSubmissionListItem } from "../services/driverSubmissions";
import { maxRecruiterPrice, validateRecruiterListPrice } from "../lib/listing-pricing";
import { formatListingPublishError } from "../lib/listing-validation";
import { fmtDate, fmtRecruitingFee, fmtPrice } from "../lib/format";
import { statusBadgeClass } from "../lib/hiring";
import { invalidateDataViews } from "../lib/dataInvalidation";
import { DriverExperienceFields } from "../components/listing/DriverExperienceFields";
import { DriverPreferencesFields } from "../components/listing/DriverPreferencesFields";
import { DriverIntakeApplicationsPanel } from "../components/driver-applications/DriverIntakeApplicationsPanel";
import { validateDriverPreferences } from "../lib/driver-preferences";
import type { ScoreFlag } from "../types";

function maskDriver(first: string, last: string) {
  return `${first} ${last.charAt(0)}.`;
}

type RecruiterSection = "listed" | "applications" | "sent";
type CarrierSection = "marketplace" | "applications" | "sent";
type ApplicationSubTab = "drafts" | "intake";

export default function MyListingsPage() {
  const navigate = useNavigate();
  const { openModal, closeModal, showToast, sessionUser } = useApp();
  const isRecruiter = isSellerNav(sessionUser);
  const isCarrier = canActAsCarrier(sessionUser) && !isRecruiter;
  const {
    listingsTab: tab,
    setListingsTab: setTab,
    listingsPage: page,
    setListingsPage: setPage,
    listingRows: rows,
    listingCounts: counts,
    listingsTotal: total,
    listingsTotalPages: totalPages,
    listingsLoading: loading,
    listingsRefreshing: refreshing,
    refreshMyListings
  } = useExchangeData();

  const [recruiterSection, setRecruiterSection] = useState<RecruiterSection>("listed");
  const [carrierSection, setCarrierSection] = useState<CarrierSection>("marketplace");
  const [applicationSubTab, setApplicationSubTab] = useState<ApplicationSubTab>("drafts");
  const [sentPage, setSentPage] = useState(1);
  const [sentRows, setSentRows] = useState<DriverSubmissionListItem[]>([]);
  const [sentTotal, setSentTotal] = useState(0);
  const [sentTotalPages, setSentTotalPages] = useState(1);
  const [sentLoading, setSentLoading] = useState(false);

  const [marketplacePage, setMarketplacePage] = useState(1);
  const [marketplaceRows, setMarketplaceRows] = useState<CarrierMarketplaceDriverRow[]>([]);
  const [marketplaceTotal, setMarketplaceTotal] = useState(0);
  const [marketplaceTotalPages, setMarketplaceTotalPages] = useState(1);
  const [marketplaceLoading, setMarketplaceLoading] = useState(false);

  const topSection = isRecruiter ? recruiterSection : carrierSection;
  const setTopSection = (section: string) => {
    if (isRecruiter) setRecruiterSection(section as RecruiterSection);
    else setCarrierSection(section as CarrierSection);
  };

  const [editLoading, setEditLoading] = useState(false);

  function statusBadge(status: string) {
    const map: Record<string, string> = {
      draft: "badge-gray",
      active: "badge-green",
      pending: "badge-yellow",
      paused: "badge-gray",
      hiring: "badge-purple",
      reserved: "badge-yellow",
      sold: "badge-blue",
      expired: "badge-red"
    };
    const label = status === "hiring" ? "Hiring in progress" : status.charAt(0).toUpperCase() + status.slice(1);
    return <span className={`badge ${map[status] ?? "badge-gray"}`}>{label}</span>;
  }

  useEffect(() => {
    if (topSection !== "sent") return;
    setSentLoading(true);
    const fetcher = isRecruiter ? fetchRecruiterSubmissionsPage : fetchCarrierSubmissionsPage;
    void fetcher({ page: sentPage, pageSize: DEFAULT_PAGE_SIZE })
      .then((result) => {
        setSentRows(result.items);
        setSentTotal(result.total);
        setSentTotalPages(result.totalPages);
      })
      .catch(() => {
        setSentRows([]);
        setSentTotal(0);
        setSentTotalPages(1);
      })
      .finally(() => setSentLoading(false));
  }, [topSection, sentPage, isRecruiter]);

  useEffect(() => {
    if (!isCarrier || topSection !== "marketplace") return;
    setMarketplaceLoading(true);
    void fetchCarrierMarketplaceDrivers({ page: marketplacePage, pageSize: DEFAULT_PAGE_SIZE })
      .then((result) => {
        setMarketplaceRows(result.items);
        setMarketplaceTotal(result.total);
        setMarketplaceTotalPages(result.totalPages);
      })
      .catch(() => {
        setMarketplaceRows([]);
        setMarketplaceTotal(0);
        setMarketplaceTotalPages(1);
      })
      .finally(() => setMarketplaceLoading(false));
  }, [isCarrier, topSection, marketplacePage]);

  useEffect(() => {
    if (isRecruiter && recruiterSection === "applications" && applicationSubTab === "drafts") {
      setTab("draft");
      setPage(1);
    }
  }, [isRecruiter, recruiterSection, applicationSubTab, setTab, setPage]);

  const sendToCarrier = (listingId: number) => {
    navigate("/find-carriers", { state: { listingId } });
  };

  const postToMarketplace = (row: SellerListingRow) => {
    void publishDraftListing(row.id)
      .then(() => {
        showToast("Application submitted for marketplace approval", "success");
        invalidateDataViews(["my-listings", "marketplace", "admin", "dashboard"]);
        refreshMyListings(true);
      })
      .catch((e) => showToast(e instanceof Error ? e.message : "Failed to publish", "error"));
  };

  const editListing = (row: SellerListingRow) => {
    setEditLoading(true);
    void fetchSellerListingDetail(row.id)
      .then((detail) => {
        if (!detail) {
          showToast("Listing not found", "error");
          return;
        }
        const cap = maxRecruiterPrice(detail.driver_type ?? "Owner Operator");
        let form = {
          firstName: detail.first_name,
          lastName: detail.last_name,
          state: detail.state,
          phone: detail.phone,
          email: detail.email ?? "",
          cdlClass: detail.cdl_class,
          cdlNumber: detail.cdl_number ?? "",
          yearsExp: detail.years_exp,
          monthsExp: detail.months_exp ?? 0,
          scoreFlag: (detail.score_flag ?? "green") as ScoreFlag,
          endorsements: (detail.endorsements ?? []).join(", "),
          availDate: detail.available_date?.slice(0, 10) ?? "",
          equipment: detail.equipment,
          routePref: detail.route_pref,
          driverType: detail.driver_type,
          desiredWeeklyPay: detail.desired_weekly_pay ?? "",
          weeksOutPreference: detail.weeks_out_preference ?? "",
          maxDispatchFeePct: detail.max_dispatch_fee_pct ?? ("" as const),
          companyExpectations: detail.company_expectations ?? "",
          notes: detail.notes ?? "",
          price: detail.price,
          listingDurationDays: Math.min(7, Math.max(1, detail.listing_duration_days ?? 7))
        };

        openModal(
          `Edit Listing${detail.status === "active" ? " (live)" : ""}`,
          <div className="listing-edit-form scroll-y" style={{ maxHeight: "60vh" }}>
            <div className="form-row">
              <div className="form-group"><label>First Name *</label><input defaultValue={form.firstName} onChange={(e) => { form.firstName = e.target.value; }} /></div>
              <div className="form-group"><label>Last Name *</label><input defaultValue={form.lastName} onChange={(e) => { form.lastName = e.target.value; }} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>State *</label>
                <select defaultValue={form.state} onChange={(e) => { form.state = e.target.value; }}>
                  <option value="">Select state</option>
                  {US_STATES.map((s) => <option key={s.code} value={s.code}>{s.code}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Phone *</label><input defaultValue={form.phone} onChange={(e) => { form.phone = e.target.value; }} /></div>
            </div>
            <div className="form-group"><label>Email (optional)</label><input defaultValue={form.email} onChange={(e) => { form.email = e.target.value; }} /></div>
            <div className="form-row">
              <div className="form-group"><label>CDL Class *</label>
                <select defaultValue={form.cdlClass} onChange={(e) => { form.cdlClass = e.target.value; }}>
                  <option>Class A</option><option>Class B</option><option>Class C</option>
                </select>
              </div>
              <div className="form-group"><label>CDL Number (optional)</label>
                <input defaultValue={form.cdlNumber} onChange={(e) => { form.cdlNumber = e.target.value; }} placeholder="Leave blank if unknown" />
              </div>
            </div>
            <div className="experience-fields-row">
              <DriverExperienceFields
                years={form.yearsExp}
                months={form.monthsExp}
                onYearsChange={(v) => { form.yearsExp = v === "" ? 0 : v; }}
                onMonthsChange={(v) => { form.monthsExp = v === "" ? 0 : v; }}
                showPreview={false}
              />
            </div>
            <div className="form-row">
              <div className="form-group"><label>CDL Score Status</label>
                <select defaultValue={form.scoreFlag} onChange={(e) => { form.scoreFlag = e.target.value as ScoreFlag; }}>
                  <option value="green">Green</option>
                  <option value="yellow">Yellow</option>
                  <option value="red">Red</option>
                </select>
              </div>
            </div>
            <div className="form-group"><label>Endorsements (optional)</label>
              <input defaultValue={form.endorsements} onChange={(e) => { form.endorsements = e.target.value; }} />
            </div>
            <div className="form-row">
              <div className="form-group"><label>Available Date *</label>
                <input type="date" defaultValue={form.availDate} onChange={(e) => { form.availDate = e.target.value; }} />
              </div>
              <div className="form-group"><label>Equipment *</label>
                <select defaultValue={form.equipment} onChange={(e) => { form.equipment = e.target.value; }}>
                  <option>Dry Van</option><option>Reefer</option><option>Flatbed</option><option>Tanker</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Route Preference *</label>
                <select defaultValue={form.routePref} onChange={(e) => { form.routePref = e.target.value; }}>
                  <option>OTR</option><option>Regional</option><option>Local</option><option>Dedicated</option>
                </select>
              </div>
              <div className="form-group"><label>Driver Type *</label>
                <select defaultValue={form.driverType} onChange={(e) => { form.driverType = e.target.value; }}>
                  {DRIVER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Listing Price (USD) *</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={cap}
                  step={1}
                  defaultValue={form.price}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") return;
                    const n = Number(raw);
                    if (Number.isFinite(n)) form.price = n;
                  }}
                />
                <span className="t-caption t-secondary">Enter $50 up to {fmtPrice(cap)}</span>
              </div>
              <div className="form-group"><label>Duration (days) *</label>
                <select defaultValue={form.listingDurationDays} onChange={(e) => { form.listingDurationDays = Number(e.target.value); }}>
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>{d} day{d === 1 ? "" : "s"}</option>)}
                </select>
              </div>
            </div>
            <div className="listing-edit-prefs">
              <h4 className="t-body" style={{ marginBottom: 8 }}>Driver preferences</h4>
              <DriverPreferencesFields
                driverType={form.driverType}
                values={{
                  desiredWeeklyPay: form.desiredWeeklyPay,
                  weeksOutPreference: form.weeksOutPreference,
                  maxDispatchFeePct: form.maxDispatchFeePct,
                  companyExpectations: form.companyExpectations
                }}
                onChange={(patch) => {
                  if (patch.desiredWeeklyPay !== undefined) form.desiredWeeklyPay = patch.desiredWeeklyPay;
                  if (patch.weeksOutPreference !== undefined) form.weeksOutPreference = patch.weeksOutPreference;
                  if (patch.maxDispatchFeePct !== undefined) form.maxDispatchFeePct = patch.maxDispatchFeePct;
                  if (patch.companyExpectations !== undefined) form.companyExpectations = patch.companyExpectations;
                }}
              />
            </div>
            <div className="form-group"><label>Internal notes (optional)</label>
              <textarea rows={2} defaultValue={form.notes} onChange={(e) => { form.notes = e.target.value; }} />
            </div>
            <p className="t-caption t-secondary">
              {detail.status === "active" || detail.status === "paused"
                ? "Active listings stay live after edits. Changing the price sends the listing back for admin re-approval."
                : "Changes require admin re-approval before the listing goes live."}
            </p>
          </div>,
          <>
            <button className="btn btn-secondary" type="button" onClick={closeModal}>Cancel</button>
            <button className="btn btn-primary" type="button" onClick={() => {
              if (!form.firstName.trim() || !form.lastName.trim() || !form.state || !form.phone.trim() || !form.availDate) {
                showToast("Complete all required fields", "error");
                return;
              }
              const prefErrs = validateDriverPreferences(
                {
                  desiredWeeklyPay: form.desiredWeeklyPay,
                  weeksOutPreference: form.weeksOutPreference,
                  maxDispatchFeePct: form.maxDispatchFeePct === "" ? null : form.maxDispatchFeePct,
                  companyExpectations: form.companyExpectations
                },
                form.driverType
              );
              if (prefErrs.length) {
                showToast(prefErrs[0], "error");
                return;
              }
              const err = validateRecruiterListPrice(form.price, form.driverType);
              if (err) {
                showToast(err, "error");
                return;
              }
              void updateListing(
                row.id,
                {
                  firstName: form.firstName.trim(),
                  lastName: form.lastName.trim(),
                  state: form.state,
                  phone: form.phone.trim(),
                  email: form.email.trim() || undefined,
                  cdlClass: form.cdlClass,
                  cdlNumber: form.cdlNumber.trim() || undefined,
                  yearsExp: form.yearsExp,
                  monthsExp: form.monthsExp,
                  scoreFlag: form.scoreFlag,
                  endorsements: form.endorsements.split(",").map((e) => e.trim()).filter(Boolean),
                  availableDate: form.availDate,
                  equipment: form.equipment,
                  routePref: form.routePref,
                  notes: form.notes.trim(),
                  desiredWeeklyPay: form.desiredWeeklyPay.trim(),
                  weeksOutPreference: form.weeksOutPreference.trim(),
                  maxDispatchFeePct: form.maxDispatchFeePct === "" ? null : form.maxDispatchFeePct,
                  companyExpectations: form.companyExpectations.trim() || undefined,
                  price: form.price,
                  driverType: form.driverType,
                  listingDurationDays: form.listingDurationDays,
                  documents: detail.documents ?? undefined
                },
                { previousStatus: detail.status, previousPrice: detail.price }
              )
                .then(({ reapprovalRequired }) => {
                  closeModal();
                  showToast(
                    reapprovalRequired
                      ? "Listing updated — pending admin re-approval (price changed)"
                      : "Listing updated successfully",
                    "success"
                  );
                  invalidateDataViews(["my-listings", "marketplace", "dashboard", "admin"]);
                  refreshMyListings(true);
                })
                .catch((e) => {
                  const messages = formatListingPublishError(e);
                  showToast(messages[0] ?? "Failed to update listing", "error");
                });
            }}>Save Changes</button>
          </>
        );
      })
      .catch(() => showToast("Failed to load listing", "error"))
      .finally(() => setEditLoading(false));
  };

  const togglePause = (row: SellerListingRow) => {
    if (row.status === "hiring" || row.status === "sold") {
      showToast("Cannot pause a listing in this status", "error");
      return;
    }
    const target = row.status === "paused" ? "active" : "paused";
    void updateListingStatus(row.id, target)
      .then(() => {
        showToast(target === "paused" ? "Listing paused" : "Listing resumed", "success");
        invalidateDataViews(["my-listings", "marketplace", "dashboard"]);
        refreshMyListings(true);
      })
      .catch(() => showToast("Failed to update listing", "error"));
  };

  const expire = (row: SellerListingRow) => {
    void expireListing(row.id)
      .then(() => {
        showToast("Listing expired", "success");
        invalidateDataViews(["my-listings", "marketplace", "dashboard"]);
        refreshMyListings(true);
      })
      .catch(() => showToast("Failed to expire listing", "error"));
  };

  const renderActions = (row: SellerListingRow) => {
    if (row.status === "draft") {
      return (
        <>
          <button className="btn btn-primary btn-sm" type="button" onClick={() => postToMarketplace(row)}>Post to marketplace</button>
          <button className="btn btn-secondary btn-sm" type="button" disabled={editLoading} onClick={() => editListing(row)}>Edit</button>
          <button className="btn btn-secondary btn-sm" type="button" onClick={() => sendToCarrier(row.id)}>Send to carrier</button>
        </>
      );
    }
    if (tab === "sold" || tab === "expired" || row.status === "hiring") return null;
    const canEdit = ["pending", "active", "paused"].includes(row.status);
    return (
      <>
        {canEdit ? (
          <button className="btn btn-ghost btn-sm" type="button" disabled={editLoading} onClick={() => editListing(row)}>Edit Listing</button>
        ) : null}
        {row.status !== "pending" && row.status !== "sold" && row.status !== "draft" ? (
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => togglePause(row)}>
            {row.status === "paused" ? "Resume" : "Pause"}
          </button>
        ) : null}
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => expire(row)}>Expire</button>
      </>
    );
  };

  const renderTable = (showActions: boolean) => (
    <>
      <div className="card"><div className="table-wrap"><table>
        <thead>
          <tr>
            <th>Driver</th><th>State</th><th>Equipment</th><th>Price</th><th>Views</th><th>Status</th>
            {showActions ? <th>Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {loading && rows.length === 0 ? (
            <tr><td colSpan={showActions ? 7 : 6} className="t-secondary">Loading listings...</td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={showActions ? 7 : 6} className="t-secondary">No listings in this tab</td></tr>
          ) : rows.map((r) => (
            <tr key={r.id}>
              <td>{maskDriver(r.first_name, r.last_name)}</td>
              <td>{r.state}</td>
              <td>{r.equipment}</td>
              <td className="price-cell">{fmtPrice(r.price)}</td>
              <td>{r.views}</td>
              <td>{statusBadge(r.status)}</td>
              {showActions ? <td>{renderActions(r)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table></div></div>
      <Pagination page={page} totalPages={totalPages} total={total} pageSize={DEFAULT_PAGE_SIZE} loading={loading || refreshing} onPageChange={setPage} />
    </>
  );

  return (
    <div className="page active my-drivers-page">
      <PageHeader
        title="My Drivers"
        desc={
          isRecruiter
            ? "Manage your listed drivers and track drivers you've sent to carriers."
            : "Drivers you're hiring from the marketplace and drivers recruiters sent to you."
        }
        row
        actions={
          isRecruiter ? (
            <button type="button" className="btn btn-primary" onClick={() => navigate("/sell")}>
              <PlusCircle className="icon-sm" /> List Driver
            </button>
          ) : null
        }
      />
      {refreshing && isRecruiter && topSection === "listed" ? (
        <div className="t-caption t-secondary" style={{ marginBottom: 8 }}>Updating...</div>
      ) : null}

      <div className="tabs listings-top-tabs">
        {isRecruiter ? (
          <>
            <button type="button" className={`tab ${topSection === "listed" ? "active" : ""}`} onClick={() => setTopSection("listed")}>
              Listed Drivers
            </button>
            <button type="button" className={`tab ${topSection === "applications" ? "active" : ""}`} onClick={() => { setTopSection("applications"); setPage(1); }}>
              Driver Applications
            </button>
            <button type="button" className={`tab ${topSection === "sent" ? "active" : ""}`} onClick={() => { setTopSection("sent"); setSentPage(1); }}>
              Sent Drivers
            </button>
          </>
        ) : (
          <>
            <button type="button" className={`tab ${topSection === "marketplace" ? "active" : ""}`} onClick={() => setTopSection("marketplace")}>
              Marketplace Drivers
            </button>
            <button type="button" className={`tab ${topSection === "applications" ? "active" : ""}`} onClick={() => setTopSection("applications")}>
              Driver Applications
            </button>
            <button type="button" className={`tab ${topSection === "sent" ? "active" : ""}`} onClick={() => { setTopSection("sent"); setSentPage(1); }}>
              Sent Drivers
            </button>
          </>
        )}
      </div>

      {isRecruiter && topSection === "applications" ? (
        <>
          <div className="tabs driver-app-subtabs">
            <button type="button" className={`tab ${applicationSubTab === "drafts" ? "active" : ""}`} onClick={() => setApplicationSubTab("drafts")}>
              Profile drafts ({counts.draft ?? 0})
            </button>
            <button type="button" className={`tab ${applicationSubTab === "intake" ? "active" : ""}`} onClick={() => setApplicationSubTab("intake")}>
              Intake applications
            </button>
          </div>
          {applicationSubTab === "drafts" ? (
            <>
              <p className="t-caption t-secondary" style={{ margin: "12px 0" }}>
                Saved driver profiles are not on the marketplace until you post them. You can also send drafts directly to carriers on Find Carriers.
              </p>
              {renderTable(true)}
            </>
          ) : (
            <DriverIntakeApplicationsPanel role="recruiter" />
          )}
        </>
      ) : null}

      {isRecruiter && topSection === "listed" ? (
        <>
          <div className="tabs" id="listingTabs">
            <button type="button" className={`tab ${tab === "active" ? "active" : ""}`} onClick={() => { setTab("active"); setPage(1); }}>Active ({counts.active})</button>
            <button type="button" className={`tab ${tab === "reserved" ? "active" : ""}`} onClick={() => { setTab("reserved"); setPage(1); }}>In Hiring ({counts.reserved})</button>
            <button type="button" className={`tab ${tab === "sold" ? "active" : ""}`} onClick={() => { setTab("sold"); setPage(1); }}>Sold ({counts.sold})</button>
            <button type="button" className={`tab ${tab === "expired" ? "active" : ""}`} onClick={() => { setTab("expired"); setPage(1); }}>Expired ({counts.expired})</button>
          </div>
          <div className={`tab-panel ${tab === "active" ? "active" : ""}`}>{renderTable(true)}</div>
          <div className={`tab-panel ${tab === "reserved" ? "active" : ""}`}>{renderTable(false)}</div>
          <div className={`tab-panel ${tab === "sold" ? "active" : ""}`}>{renderTable(false)}</div>
          <div className={`tab-panel ${tab === "expired" ? "active" : ""}`}>{renderTable(false)}</div>
        </>
      ) : null}

      {isCarrier && topSection === "applications" ? (
        <DriverIntakeApplicationsPanel role="carrier" />
      ) : null}

      {isCarrier && topSection === "marketplace" ? (
        <>
          {marketplaceLoading && marketplaceRows.length === 0 ? (
            <p className="t-secondary">Loading marketplace drivers...</p>
          ) : marketplaceRows.length === 0 ? (
            <div className="card marketplace-empty">
              <p className="t-body">No marketplace hiring processes yet.</p>
              <p className="t-caption t-secondary">Start hiring from the marketplace to track drivers here.</p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate("/marketplace")}>Browse Marketplace</button>
            </div>
          ) : (
            <div className="marketplace-driver-list">
              {marketplaceRows.map((row) => (
                <button
                  key={row.dealId}
                  type="button"
                  className="marketplace-driver-row card"
                  onClick={() => navigate(`/deals/${row.dealId}`)}
                >
                  <div className="marketplace-driver-row-main">
                    <div className="sent-driver-card-avatar"><User className="icon-md" /></div>
                    <div>
                      <div className="t-body">{row.driverFirstName} {row.driverLastName.charAt(0)}.</div>
                      <div className="t-caption t-secondary">{row.driverState} · {row.driverEquipment}</div>
                      <div className="t-caption t-secondary">Recruiter: {row.recruiterName}</div>
                    </div>
                  </div>
                  <div className="marketplace-driver-row-side">
                    <span className={`badge ${statusBadgeClass(row.status)}`}>{row.status}</span>
                    <div className="t-caption t-secondary">{fmtRecruitingFee(row.amount)}</div>
                    <div className="t-caption t-secondary">Updated {fmtDate(row.updatedAt)}</div>
                  </div>
                  <ChevronRight className="icon-md" />
                </button>
              ))}
            </div>
          )}
          <Pagination page={marketplacePage} totalPages={marketplaceTotalPages} total={marketplaceTotal} pageSize={DEFAULT_PAGE_SIZE} loading={marketplaceLoading} onPageChange={setMarketplacePage} />
        </>
      ) : null}

      {topSection === "sent" ? (
        <>
          {sentLoading && sentRows.length === 0 ? (
            <p className="t-secondary">Loading sent drivers...</p>
          ) : sentRows.length === 0 ? (
            <div className="card marketplace-empty">
              <p className="t-body">No sent drivers yet.</p>
              <p className="t-caption t-secondary">
                {isRecruiter
                  ? "Use Find Carriers to send your listed drivers to hiring companies."
                  : "Recruiters will appear here when they send driver profiles to your company."}
              </p>
              {isRecruiter ? (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate("/find-carriers")}>Find Carriers</button>
              ) : null}
            </div>
          ) : (
            <div className="sent-driver-card-grid">
              {sentRows.map((r) => (
                <SentDriverCard
                  key={r.id}
                  item={r}
                  variant={isRecruiter ? "recruiter" : "carrier"}
                  onClick={() => navigate(`/submissions/${r.id}`)}
                />
              ))}
            </div>
          )}
          <Pagination page={sentPage} totalPages={sentTotalPages} total={sentTotal} pageSize={DEFAULT_PAGE_SIZE} loading={sentLoading} onPageChange={setSentPage} />
        </>
      ) : null}
    </div>
  );
}
