import { useEffect, useState } from "react";
import { useApp } from "../../context/AppContext";
import {
  createPlatformAdmin,
  fetchPlatformAdmins,
  type PlatformAdmin
} from "../../services/platformAdmin";

export function AdminTeamPanel() {
  const { showToast } = useApp();
  const [admins, setAdmins] = useState<PlatformAdmin[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setAdmins(await fetchPlatformAdmins());
  };

  useEffect(() => {
    void load();
  }, []);

  const add = async () => {
    if (!email.trim() || !password.trim() || !name.trim()) return;
    setBusy(true);
    try {
      await createPlatformAdmin(email, password, name);
      setEmail("");
      setPassword("");
      setName("");
      showToast("Platform admin created", "success");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to create admin", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header"><h3>Platform admin team</h3></div>
      <div className="card-body">
        <p className="t-secondary" style={{ marginBottom: 16 }}>
          Managers can add platform admins. New admins receive assigned listing cases automatically (round-robin).
        </p>
        <div className="form-row">
          <div className="form-group"><label>Full name</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="form-group"><label>Work email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="form-group"><label>Temporary password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        </div>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void add()}>Add platform admin</button>
        <div className="table-wrap" style={{ marginTop: 20 }}>
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.email}</td>
                  <td><span className={`badge ${a.admin_role === "manager" ? "badge-purple" : "badge-blue"}`}>{a.admin_role}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
