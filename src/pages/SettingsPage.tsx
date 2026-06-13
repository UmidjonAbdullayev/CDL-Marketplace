import { CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { PageHeader } from "../lib/badges";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { showToast } = useApp();
  return (
    <div className="page active">
      <PageHeader title="Settings" desc="Manage your account, notifications, and platform preferences." />
      <div className="grid-2">
        <div className="card"><div className="card-header"><h3>Account</h3></div><div className="card-body" style={{ fontSize: 13 }}>
          <div className="form-group"><label>Company Name</label><input defaultValue="RapidHaul Recruiting" /></div>
          <div className="form-group"><label>Email</label><input defaultValue="recruiting@rapidhaul.com" /></div>
          <div className="form-group"><label>Phone</label><input defaultValue="(800) 555-0192" /></div>
          <button className="btn btn-primary" onClick={() => showToast("Settings saved", "success")}>Save Changes</button>
        </div></div>
        <div className="card"><div className="card-header"><h3>Notifications</h3></div><div className="card-body" style={{ fontSize: 13 }}>
          <label className="filter-check"><input type="checkbox" defaultChecked /> New lead matches</label>
          <label className="filter-check"><input type="checkbox" defaultChecked /> Deal status updates</label>
          <label className="filter-check"><input type="checkbox" defaultChecked /> Message notifications</label>
          <label className="filter-check"><input type="checkbox" /> Marketing emails</label>
          <hr style={{ border: "none", borderTop: "1px solid var(--gray-200)", margin: "16px 0" }} />
          <button className="btn btn-secondary" onClick={() => navigate("/admin")}>Open Admin Panel</button>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: "var(--s2)" }} onClick={() => showToast("CDL Score CRM connected", "success")}><CheckCircle2 className="icon-sm" /> CDL Score CRM</button>
        </div></div>
      </div>
    </div>
  );
}
