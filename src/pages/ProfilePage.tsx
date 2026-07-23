import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Award, Save, ShieldCheck, Star } from "lucide-react";
import { useApp } from "../context/AppContext";
import { accountTypeLabel, canActAsCarrier, isPlatformStaff } from "../lib/account-capabilities";
import { PageHeader, VerifiedBadge } from "../lib/badges";
import { AvatarUploadButton } from "../components/ui/AvatarUploadButton";
import { CarrierOffersForm } from "../components/carriers/CarrierOffersForm";
import { CarrierOffersBanner } from "../components/carriers/CarrierOffersBanner";
import { CarrierOffersSummary, CarrierRequirementsSummary } from "../components/carriers/CarrierOffersSummary";
import { carrierOffersCompletion, emptyCarrierOffers, parseCarrierOffers } from "../lib/carrier-offers";
import { fetchCompanyById } from "../services/company";
import { fetchRegistrationById } from "../services/registration";
import { saveCarrierOffersRequirements } from "../services/carrierProfile";
import { avatarUrlFromProfileData, uploadAdminAvatar } from "../services/adminProfiles";
import type { AgencyProfile, CarrierProfile, SoloRecruiterProfile } from "../types/registration";
import type { CarrierOffersRequirements } from "../types/carrier-offers";

type ProfileTab = "details" | "offers";

export default function ProfilePage() {
  const { sessionUser, showToast } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileVerified, setProfileVerified] = useState(false);
  const [companyStats, setCompanyStats] = useState({
    rating: 0,
    leadsSold: 0,
    refundRate: 0,
    memberSince: ""
  });
  const [details, setDetails] = useState<Record<string, string>>({});
  const [offers, setOffers] = useState<CarrierOffersRequirements>(emptyCarrierOffers());
  const [accountType, setAccountType] = useState<string>("");

  const tab: ProfileTab = searchParams.get("tab") === "offers" ? "offers" : "details";
  const setTab = (t: ProfileTab) => setSearchParams(t === "details" ? {} : { tab: t });

  const actsAsCarrier = canActAsCarrier(sessionUser) && accountType === "carrier";
  const offersStatus = useMemo(() => carrierOffersCompletion(offers), [offers]);

  useEffect(() => {
    if (!sessionUser?.id) {
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const account = await fetchRegistrationById(sessionUser.id);
        if (!account) return;
        setAccountType(account.account_type);
        setProfileVerified(Boolean(account.profile_verified));
        setAvatarUrl(avatarUrlFromProfileData(account.profile_data));

        if (account.company_id) {
          const company = await fetchCompanyById(account.company_id);
          if (company) {
            setCompanyStats({
              rating: Number(company.rating),
              leadsSold: company.leads_sold,
              refundRate: Number(company.refund_rate),
              memberSince: new Date(company.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })
            });
          }
        }

        const p = account.profile_data;
        if (account.account_type === "carrier") {
          const c = p as CarrierProfile;
          setOffers(parseCarrierOffers(c.offersRequirements));
          setDetails({
            Company: c.companyName,
            "MC#": c.mcNumber,
            DOT: c.dotNumber ?? "—",
            Specialization: c.specialization,
            "Service Area": c.serviceArea,
            "Fleet Size": c.fleetSize,
            Contact: c.companyEmail,
            Website: c.website || "—",
            Location: `${c.city}, ${c.state}`,
            About: c.about ?? ""
          });
        } else if (account.account_type === "agency") {
          const a = p as AgencyProfile;
          setDetails({
            Company: a.agencyName,
            Specialization: a.specialization,
            "Service Area": a.serviceArea,
            Contact: a.companyEmail,
            Website: a.website || "—",
            Location: `${a.city}, ${a.state}`,
            About: a.about ?? ""
          });
        } else {
          const s = p as SoloRecruiterProfile;
          setDetails({
            Name: s.fullName,
            Email: s.email,
            Phone: s.phone,
            Experience: `${s.yearsExperience} years`,
            "Driver Types": s.primaryDriverTypes,
            "Service Area": s.serviceArea,
            Role: s.currentRole
          });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionUser?.id]);

  const saveOffers = async () => {
    if (!sessionUser?.id) return;
    setSaving(true);
    try {
      await saveCarrierOffersRequirements(sessionUser.id, offers);
      showToast("Offers & requirements saved", "success");
      window.dispatchEvent(new Event("carrier-offers-updated"));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  const displayName = sessionUser?.name ?? "Your Company";
  const initials = sessionUser?.initials ?? "—";
  const staff = isPlatformStaff(sessionUser);
  const profileTitle = staff
    ? sessionUser?.adminRole === "manager" ? "Platform Manager Profile" : "Platform Admin Profile"
    : actsAsCarrier ? "Company Profile" : "Recruiter Profile";
  const profileDesc = staff
    ? "Platform operations account with full marketplace and admin access."
    : actsAsCarrier
      ? "Your company profile, offers, and hiring requirements for recruiters."
      : "Your public seller profile and recruiting details.";

  if (loading) {
    return (
      <div className="page active">
        <p className="t-secondary">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="page active profile-page">
      <PageHeader title={profileTitle} desc={profileDesc} />

      {actsAsCarrier && !offersStatus.isComplete ? (
        <div style={{ marginBottom: 16 }}>
          <CarrierOffersBanner offers={offers} />
        </div>
      ) : null}

      <div className="card">
        <div className="profile-header">
          {staff ? (
            <AvatarUploadButton
              name={displayName}
              initials={initials}
              avatarUrl={avatarUrl}
              onUpload={async (file) => {
                if (!sessionUser?.id) return;
                const url = await uploadAdminAvatar(sessionUser.id, file);
                setAvatarUrl(url);
                showToast("Profile photo updated", "success");
              }}
            />
          ) : (
            <div className="profile-avatar">{initials}</div>
          )}
          <div style={{ flex: 1 }}>
            <h3 className="t-section">{displayName}</h3>
            <div style={{ display: "flex", gap: "var(--s2)", margin: "var(--s2) 0", flexWrap: "wrap" }}>
              {!staff && profileVerified ? <VerifiedBadge text="Verified Account" /> : null}
              {actsAsCarrier && offersStatus.isComplete ? (
                <span className="badge badge-green"><ShieldCheck className="icon-sm" /> Offers complete</span>
              ) : actsAsCarrier ? (
                <span className="badge badge-yellow">Offers {offersStatus.percent}% complete</span>
              ) : null}
              {staff ? (
                <span className="badge badge-purple"><ShieldCheck className="icon-sm" /> {accountTypeLabel(sessionUser)}</span>
              ) : actsAsCarrier ? (
                <span className="badge badge-blue"><ShieldCheck className="icon-sm" /> Carrier</span>
              ) : (
                <span className="badge badge-navy"><Award className="icon-sm" /> Seller</span>
              )}
            </div>
            <div className="t-secondary">
              {details.Location ?? "—"}
              {companyStats.memberSince ? ` · Member since ${companyStats.memberSince}` : ""}
            </div>
          </div>
        </div>
        <div className="profile-stats" style={{ padding: "0 24px 24px" }}>
          <div className="profile-stat"><div className="num">{companyStats.rating.toFixed(1)}</div><div className="lbl" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><Star className="icon-sm" style={{ color: "var(--warning)" }} /> Rating</div></div>
          <div className="profile-stat"><div className="num">{companyStats.leadsSold}</div><div className="lbl">Leads Sold</div></div>
          <div className="profile-stat"><div className="num">{companyStats.refundRate}%</div><div className="lbl">Refund Rate</div></div>
          <div className="profile-stat"><div className="num">{actsAsCarrier ? `${offersStatus.percent}%` : "—"}</div><div className="lbl">Offers profile</div></div>
        </div>
      </div>

      {actsAsCarrier ? (
        <>
          <div className="tabs" style={{ marginTop: 20 }}>
            <button type="button" className={`tab ${tab === "details" ? "active" : ""}`} onClick={() => setTab("details")}>Company details</button>
            <button type="button" className={`tab ${tab === "offers" ? "active" : ""}`} onClick={() => setTab("offers")}>
              Offers &amp; requirements
              {!offersStatus.isComplete ? <span className="tab-alert-dot" /> : null}
            </button>
          </div>

          {tab === "details" ? (
            <div className="grid-2" style={{ marginTop: 16 }}>
              <div className="card">
                <div className="card-header"><h3>Company Details</h3></div>
                <div className="card-body" style={{ fontSize: 13, lineHeight: 2 }}>
                  {Object.entries(details).map(([key, value]) => (
                    <div key={key}><strong>{key}:</strong> {value || "—"}</div>
                  ))}
                </div>
              </div>
              <div className="card">
                <div className="card-header"><h3>Preview — what recruiters see</h3></div>
                <div className="card-body">
                  <CarrierOffersSummary offers={offers} showIncompleteNote={false} />
                  <h4 className="t-body" style={{ marginTop: 16 }}>Requirements</h4>
                  <CarrierRequirementsSummary offers={offers} />
                </div>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 16 }}>
              <div className="carrier-offers-save-bar card">
                <div>
                  <strong>Offers &amp; Requirements application</strong>
                  <p className="t-caption t-secondary">Recruiters use this to match and send drivers. Required fields must be completed.</p>
                </div>
                <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void saveOffers()}>
                  <Save className="icon-sm" /> {saving ? "Saving..." : "Save application"}
                </button>
              </div>
              <CarrierOffersForm value={offers} onChange={setOffers} disabled={saving} />
              <div className="carrier-offers-save-bar card" style={{ marginTop: 12 }}>
                <button type="button" className="btn btn-primary btn-block" disabled={saving} onClick={() => void saveOffers()}>
                  {saving ? "Saving..." : "Save offers & requirements"}
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="grid-2" style={{ marginTop: 20 }}>
          <div className="card"><div className="card-header"><h3>Reviews</h3></div><div className="card-body">
            {companyStats.leadsSold === 0 ? (
              <p className="t-secondary">No reviews yet. Complete deals to build your reputation on the marketplace.</p>
            ) : (
              <p className="t-secondary">Reviews from completed deals will appear here.</p>
            )}
          </div></div>
          <div className="card"><div className="card-header"><h3>Profile Details</h3></div><div className="card-body" style={{ fontSize: 13, lineHeight: 2 }}>
            {Object.entries(details).map(([key, value]) => (
              <div key={key}><strong>{key}:</strong> {value || "—"}</div>
            ))}
          </div></div>
        </div>
      )}
    </div>
  );
}
