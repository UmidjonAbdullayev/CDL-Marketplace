import { useEffect, useState } from "react";
import { useApp } from "../../context/AppContext";
import { AvatarUploadButton } from "../ui/AvatarUploadButton";
import { isPlatformManager } from "../../lib/account-capabilities";
import {
  createPlatformAdmin,
  fetchPlatformAdmins,
  type PlatformAdmin
} from "../../services/platformAdmin";
import { avatarUrlFromProfileData, uploadAdminAvatar } from "../../services/adminProfiles";
import { supabase } from "../../lib/supabase";

type AdminRow = PlatformAdmin & { avatarUrl: string | null };

export function AdminTeamPanel() {
  const { showToast, sessionUser } = useApp();
  const isManager = isPlatformManager(sessionUser);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const rows = await fetchPlatformAdmins();
    if (!supabase) {
      setAdmins(rows.map((a) => ({ ...a, avatarUrl: null })));
      return;
    }
    const { data } = await supabase
      .from("registration_accounts")
      .select("id, profile_data")
      .in("id", rows.map((a) => a.id));
    const avatarMap = new Map(
      (data ?? []).map((r) => [r.id, avatarUrlFromProfileData(r.profile_data)])
    );
    setAdmins(rows.map((a) => ({ ...a, avatarUrl: avatarMap.get(a.id) ?? null })));
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

  const uploadForAdmin = async (adminId: string, file: File) => {
    const url = await uploadAdminAvatar(adminId, file);
    setAdmins((prev) => prev.map((a) => (a.id === adminId ? { ...a, avatarUrl: url } : a)));
    showToast("Admin photo updated", "success");
  };

  return (
    <div className="card">
      <div className="card-header"><h3>Platform admin team</h3></div>
      <div className="card-body">
        <p className="t-secondary" style={{ marginBottom: 16 }}>
          Managers can add platform admins and upload profile photos shown in deal chats.
        </p>
        {isManager ? (
          <>
            <div className="form-row">
              <div className="form-group"><label>Full name</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="form-group"><label>Work email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="form-group"><label>Temporary password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            </div>
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void add()}>Add platform admin</button>
          </>
        ) : null}
        <div className="table-wrap" style={{ marginTop: 20 }}>
          <table>
            <thead><tr><th>Admin</th><th>Email</th><th>Role</th>{isManager ? <th>Photo</th> : null}</tr></thead>
            <tbody>
              {admins.map((a) => {
                const initials = a.name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
                const canEditPhoto = isManager || sessionUser?.id === a.id;
                return (
                  <tr key={a.id}>
                    <td>
                      <div className="admin-team-name">
                        {canEditPhoto ? (
                          <>
                            <AvatarUploadButton
                              name={a.name}
                              initials={initials}
                              avatarUrl={a.avatarUrl}
                              size="sm"
                              onUpload={(file) => uploadForAdmin(a.id, file)}
                            />
                            <span>{a.name}</span>
                          </>
                        ) : (
                          <span>{a.name}</span>
                        )}
                      </div>
                    </td>
                    <td>{a.email}</td>
                    <td><span className={`badge ${a.admin_role === "manager" ? "badge-purple" : "badge-blue"}`}>{a.admin_role}</span></td>
                    {isManager ? (
                      <td className="t-caption t-secondary">{canEditPhoto ? "Click avatar to upload" : "—"}</td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
