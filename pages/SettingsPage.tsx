import { CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { accountTypeLabel, canAccessAdminPanel } from "../lib/account-capabilities";
import { CDL_SCORE_APP_URL } from "../lib/cdl-score-urls";
import { PageHeader } from "../lib/badges";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { showToast, sessionUser, setSearchQuery } = useApp();
  const profile = sessionUser;

  return (
    <div className="page active">
      <PageHeader title="Settings" desc="Manage your account, notifications, and platform preferences." />
      <div className="grid-2">
        <div className="card"><div className="card-header"><h3>Account</h3></div><div className="card-body" style={{ fontSize: 13 }}>
          <div className="form-group"><label>Company Name</label><input defaultValue={profile?.name ?? ""} readOnly /></div>
          <div className="form-group"><label>Email</label><input defaultValue={profile?.email ?? ""} readOnly /></div>
          <div className="form-group"><label>Account Type</label><input defaultValue={accountTypeLabel(profile) || profile?.accountType || ""} readOnly /></div>
          {canAccessAdminPanel(profile) ? (
            <button
              className="btn btn-secondary"
              type="button"
              style={{ marginTop: 12 }}
              onClick={() => {
                setSearchQuery("");
                navigate("/admin");
              }}
            >
              Open Admin Panel
            </button>
          ) : null}
          <button className="btn btn-primary" type="button" onClick={() => showToast("Settings saved", "success")}>Save Changes</button>
        </div></div>
        <div className="card"><div className="card-header"><h3>Notifications</h3></div><div className="card-body" style={{ fontSize: 13 }}>
          <label className="filter-check"><input type="checkbox" defaultChecked /> New lead matches</label>
          <label className="filter-check"><input type="checkbox" defaultChecked /> Deal status updates</label>
          <label className="filter-check"><input type="checkbox" defaultChecked /> Message notifications</label>
          <label className="filter-check"><input type="checkbox" /> Marketing emails</label>
          <hr style={{ border: "none", borderTop: "1px solid var(--gray-200)", margin: "16px 0" }} />
          <a
            className="btn btn-ghost btn-sm"
            href={CDL_SCORE_APP_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <CheckCircle2 className="icon-sm" /> Open CDL Score CRM
          </a>
        </div></div>
      </div>
    </div>
  );
}
