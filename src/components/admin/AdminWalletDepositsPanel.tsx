import { useCallback, useEffect, useState } from "react";
import { usePlatformRealtime } from "../../hooks/usePlatformRealtime";
import { useApp } from "../../context/AppContext";
import { isPlatformManager } from "../../lib/account-capabilities";
import { fmtDate, fmtPrice } from "../../lib/format";
import {
  approveWalletDeposit,
  fetchWalletDepositsForAdmin,
  rejectWalletDeposit,
  type WalletDepositRow
} from "../../services/wallet";

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: "badge-yellow",
    approved: "badge-green",
    rejected: "badge-red"
  };
  return map[status] ?? "badge-gray";
}

function RejectDepositModalBody({
  row,
  busy,
  onCancel,
  onReject
}: {
  row: WalletDepositRow;
  busy: boolean;
  onCancel: () => void;
  onReject: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <>
      <p className="t-secondary" style={{ marginBottom: 12 }}>
        Rejecting {fmtPrice(row.amount)} deposit. The carrier will see your reason.
      </p>
      <div className="form-group">
        <label>Rejection reason *</label>
        <textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Payment not found on Whop, wrong amount, duplicate request…"
        />
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-danger btn-sm"
          disabled={busy || !reason.trim()}
          onClick={() => onReject(reason.trim())}
        >
          {busy ? "Rejecting…" : "Reject deposit"}
        </button>
      </div>
    </>
  );
}

export function AdminWalletDepositsPanel() {
  const { sessionUser, showToast, refreshWalletBalance, openModal, closeModal } = useApp();
  const [rows, setRows] = useState<WalletDepositRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [busyId, setBusyId] = useState<string | null>(null);

  const isManager = isPlatformManager(sessionUser);

  const load = useCallback(async () => {
    if (!isManager) return;
    setLoading(true);
    try {
      const data =
        filter === "pending"
          ? await fetchWalletDepositsForAdmin("pending")
          : await fetchWalletDepositsForAdmin();
      setRows(data);
    } catch {
      showToast("Failed to load wallet deposits", "error");
    } finally {
      setLoading(false);
    }
  }, [filter, isManager, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  usePlatformRealtime(
    useCallback((topics) => {
      if (topics.has("admin")) void load();
    }, [load])
  );

  if (!isManager) {
    return (
      <div className="card">
        <div className="card-body t-secondary">Only platform managers can review wallet deposits.</div>
      </div>
    );
  }

  const approve = async (row: WalletDepositRow) => {
    setBusyId(row.id);
    try {
      await approveWalletDeposit(row.id);
      showToast(`Approved ${fmtPrice(row.amount)} for ${row.company_name}`, "success");
      await load();
      await refreshWalletBalance();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Approval failed", "error");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (row: WalletDepositRow, reason: string) => {
    setBusyId(row.id);
    try {
      await rejectWalletDeposit(row.id, reason);
      showToast(`Rejected deposit for ${row.company_name}`, "success");
      closeModal();
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Rejection failed", "error");
    } finally {
      setBusyId(null);
    }
  };

  const openRejectModal = (row: WalletDepositRow) => {
    openModal(
      `Reject deposit — ${row.company_name}`,
      <RejectDepositModalBody
        row={row}
        busy={busyId === row.id}
        onCancel={closeModal}
        onReject={(reason) => void reject(row, reason)}
      />
    );
  };

  const pendingCount = rows.filter((r) => r.status === "pending").length;

  return (
    <div className="admin-wallet-deposits">
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ fontSize: 13, lineHeight: 1.7 }}>
          <p>
            <strong>Wallet deposits via Whop</strong> — users choose $1,000 or $2,000, complete checkout, then appear
            here as pending until you approve. Approved amounts credit their wallet balance.
          </p>
          <p className="t-caption t-secondary">
            When a carrier starts a deal, the recruiting fee is deducted from wallet balance and held in deal escrow.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h3>Wallet deposit queue {filter === "pending" && pendingCount ? `(${pendingCount})` : ""}</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className={`btn btn-sm ${filter === "pending" ? "btn-primary" : "btn-secondary"}`} onClick={() => setFilter("pending")}>
              Pending
            </button>
            <button type="button" className={`btn btn-sm ${filter === "all" ? "btn-primary" : "btn-secondary"}`} onClick={() => setFilter("all")}>
              All
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Notes</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="t-secondary">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="t-secondary">No deposits in this view</td></tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className={row.status === "pending" ? "row-pending-payment" : ""}>
                    <td>{row.company_name}</td>
                    <td>{fmtPrice(row.amount)}</td>
                    <td><span className={`badge ${statusBadge(row.status)}`}>{row.status}</span></td>
                    <td className="t-caption">{fmtDate(row.created_at)}</td>
                    <td className="t-caption t-secondary">
                      {row.status === "rejected" ? row.rejection_reason : "—"}
                    </td>
                    <td>
                      {row.status === "pending" ? (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="btn btn-success btn-sm"
                            disabled={busyId === row.id}
                            onClick={() => void approve(row)}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            disabled={busyId === row.id}
                            onClick={() => openRejectModal(row)}
                          >
                            Reject
                          </button>
                          <a href={row.whop_checkout_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                            Whop
                          </a>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
