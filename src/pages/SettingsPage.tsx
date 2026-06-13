import { CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { PageHeader } from "../lib/badges";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { showToast, sessionUser } = useApp();
  const profile = sessionUser;

  return (
    <div className="page active">
      <PageHeader title="Settings" desc="Manage your account, notifications, and platform preferences." />
      <div className="grid-2">
        <div className="card"><div className="card-header"><h3>Account</h3></div><div className="card-body" style={{ fontSize: 13 }}>
          <div className="form-group"><label>Company Name</label><input defaultValue={profile?.name ?? ""} readOnly /></div>
          <div className="form-group"><label>Email</label><input defaultValue={profile?.email ?? ""} readOnly /></div>
          <div className="form-group"><label>Account Type</label><input defaultValue={profile?.accountType ?? ""} readOnly /></div>
          <button className="btn btn-primary" type="button" onClick={() => showToast("Settings saved", "success")}>Save Changes</button>
        </div></div>
        <div className="card"><div className="card-header"><h3>Notifications</h3></div><div className="card-body" style={{ fontSize: 13 }}>
          <label className="filter-check"><input type="checkbox" defaultChecked /> New lead matches</label>
          <label className="filter-check"><input type="checkbox" defaultChecked /> Deal status updates</label>
          <label className="filter-check"><input type="checkbox" defaultChecked /> Message notifications</label>
          <label className="filter-check"><input type="checkbox" /> Marketing emails</label>
          <hr style={{ border: "none", borderTop: "1px solid var(--gray-200)", margin: "16px 0" }} />
          {profile?.isAdmin ? (
            <button className="btn btn-secondary" type="button" onClick={() => navigate("/admin")}>Open Admin Panel</button>
          ) : null}
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: profile?.isAdmin ? "var(--s2)" : 0 }} type="button" onClick={() => showToast("CDL Score CRM connected", "success")}><CheckCircle2 className="icon-sm" /> CDL Score CRM</button>
        </div></div>
      </div>
    </div>
  );
}
