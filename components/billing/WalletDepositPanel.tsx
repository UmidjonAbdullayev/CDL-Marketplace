import { useCallback, useEffect, useState } from "react";
import { WalletDepositForm } from "./WalletDepositForm";
import { fetchCompanyPendingDeposit, fetchCompanyLatestRejectedDeposit, type WalletDepositRow } from "../../services/wallet";

type Props = {
  onDepositStarted?: () => void;
};

export function WalletDepositPanel({ onDepositStarted }: Props) {
  const [pending, setPending] = useState<WalletDepositRow | null>(null);
  const [rejected, setRejected] = useState<WalletDepositRow | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, r] = await Promise.all([
        fetchCompanyPendingDeposit(),
        fetchCompanyLatestRejectedDeposit()
      ]);
      setPending(p);
      setRejected(p ? null : r);
    } catch {
      setPending(null);
      setRejected(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleStarted = () => {
    void load();
    onDepositStarted?.();
  };

  if (loading) {
    return <p className="t-secondary">Loading deposit options…</p>;
  }

  return (
    <>
      {rejected ? (
        <div className="wallet-deposit-rejected card" style={{ marginBottom: 14, padding: 12 }}>
          <strong>Previous deposit rejected</strong>
          <p className="t-caption t-secondary" style={{ marginTop: 6 }}>
            {rejected.rejection_reason ?? "No reason provided."}
          </p>
        </div>
      ) : null}
      <WalletDepositForm pendingAmount={pending?.amount ?? null} onDepositStarted={handleStarted} />
    </>
  );
}
