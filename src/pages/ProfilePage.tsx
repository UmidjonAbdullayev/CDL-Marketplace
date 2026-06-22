import { useEffect, useState } from "react";
import { Award, ShieldCheck, Star } from "lucide-react";
import { useApp } from "../context/AppContext";
import { accountTypeLabel, canActAsCarrier, isPlatformStaff } from "../lib/account-capabilities";
import { PageHeader, VerifiedBadge } from "../lib/badges";
import { AvatarUploadButton } from "../components/ui/AvatarUploadButton";
import { fetchCompanyById } from "../services/company";
import { fetchRegistrationById } from "../services/registration";
import { avatarUrlFromProfileData, uploadAdminAvatar } from "../services/adminProfiles";
import type { AgencyProfile, CarrierProfile, SoloRecruiterProfile } from "../types/registration";

export default function ProfilePage() {
  const { sessionUser, showToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileVerified, setProfileVerified] = useState(false);
  const [companyStats, setCompanyStats] = useState({
    rating: 0,
    leadsSold: 0,
    refundRate: 0,
    memberSince: ""
  });
  const [details, setDetails] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!sessionUser?.id) {
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const account = await fetchRegistrationById(sessionUser.id);
        if (!account) return;
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
          setDetails({
            Company: c.companyName,
            "MC#": c.mcNumber,
            DOT: c.dotNumber ?? "—",
            Specialization: c.specialization,
            "Service Area": c.serviceArea,
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

  const displayName = sessionUser?.name ?? "Your Company";
  const initials = sessionUser?.initials ?? "—";
  const staff = isPlatformStaff(sessionUser);
  const actsAsCarrier = canActAsCarrier(sessionUser);
  const profileTitle = staff
    ? sessionUser?.adminRole === "manager" ? "Platform Manager Profile" : "Platform Admin Profile"
    : actsAsCarrier ? "Company Profile" : "Recruiter Profile";
  const profileDesc = staff
    ? "Platform operations account with full marketplace and admin access."
    : actsAsCarrier
      ? "Your company profile and recruiting details."
      : "Your public seller profile and recruiting details.";

  if (loading) {
    return (
      <div className="page active">
        <p className="t-secondary">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="page active">
      <PageHeader title={profileTitle} desc={profileDesc} />
      <div className="card"><div className="profile-header">
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
        <div style={{ flex: 1 }}><h3 className="t-section">{displayName}</h3>
          <div style={{ display: "flex", gap: "var(--s2)", margin: "var(--s2) 0", flexWrap: "wrap" }}>
            {!staff && profileVerified ? <VerifiedBadge text="Verified Account" /> : null}
            {staff ? (
              <span className="badge badge-purple"><ShieldCheck className="icon-sm" /> {accountTypeLabel(sessionUser)}</span>
            ) : actsAsCarrier ? (
              <span className="badge badge-blue"><ShieldCheck className="icon-sm" /> Buyer / Recruiter</span>
            ) : (
              <span className="badge badge-navy"><Award className="icon-sm" /> Seller</span>
            )}
          </div>
          <div className="t-secondary">
            {details.Location ?? "—"}
            {companyStats.memberSince ? ` · Member since ${companyStats.memberSince}` : ""}
          </div>
        </div>
        <button className="btn btn-secondary" type="button">Edit Profile</button>
      </div>
      <div className="profile-stats" style={{ padding: "0 24px 24px" }}>
        <div className="profile-stat"><div className="num">{companyStats.rating.toFixed(1)}</div><div className="lbl" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><Star className="icon-sm" style={{ color: "var(--warning)" }} /> Rating</div></div>
        <div className="profile-stat"><div className="num">{companyStats.leadsSold}</div><div className="lbl">Leads Sold</div></div>
        <div className="profile-stat"><div className="num">{companyStats.refundRate}%</div><div className="lbl">Refund Rate</div></div>
        <div className="profile-stat"><div className="num">—</div><div className="lbl">Avg Response</div></div>
      </div></div>
      <div className="grid-2" style={{ marginTop: 20 }}>
        <div className="card"><div className="card-header"><h3>Reviews</h3></div><div className="card-body">
          {companyStats.leadsSold === 0 ? (
            <p className="t-secondary">No reviews yet. Complete deals to build your reputation on the marketplace.</p>
          ) : (
            <p className="t-secondary">Reviews from completed deals will appear here.</p>
          )}
        </div></div>
        <div className="card"><div className="card-header"><h3>Company Details</h3></div><div className="card-body" style={{ fontSize: 13, lineHeight: 2 }}>
          {Object.entries(details).map(([key, value]) => (
            <div key={key}><strong>{key}:</strong> {value || "—"}</div>
          ))}
        </div></div>
      </div>
    </div>
  );
}
