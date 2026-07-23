import { CreditCard, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../../context/AppContext";
import { fmtPrice } from "../../lib/format";
import { fetchCompanyPendingDeposit, type WalletDepositRow } from "../../services/wallet";

export function WalletDepositPendingBanner() {
  const { openDepositModal, refreshWalletBalance, sessionUser } = useApp();
  const [pending, setPending] = useState<WalletDepositRow | null>(null);
  const hadPendingRef = useRef(false);

  const load = useCallback(async () => {
    if (!sessionUser?.companyId) {
      hadPendingRef.current = false;
      setPending(null);
      return;
    }
    try {
      const row = await fetchCompanyPendingDeposit(sessionUser.companyId);
      if (hadPendingRef.current && !row) {
        void refreshWalletBalance();
      }
      hadPendingRef.current = Boolean(row);
      setPending(row);
    } catch {
      hadPendingRef.current = false;
      setPending(null);
    }
  }, [refreshWalletBalance, sessionUser?.companyId]);

  useEffect(() => {
    void load();
    if (!sessionUser?.companyId) return;
    const id = window.setInterval(() => void load(), 20000);
    return () => clearInterval(id);
  }, [load, sessionUser?.companyId]);

  if (!pending) return null;

  return (
    <div className="wallet-deposit-pending-banner card">
      <div className="wallet-deposit-pending-banner-body">
        <Loader2 className="icon-md spin payment-processing-icon" />
        <div>
          <strong>Deposit payment processing — {fmtPrice(pending.amount)}</strong>
          <p className="t-secondary t-caption">
            Complete checkout on Whop if you have not already. A platform manager will verify your payment and credit
            your wallet balance.
          </p>
        </div>
      </div>
      <div className="payment-processing-actions">
        <a
          href={pending.whop_checkout_url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary btn-sm"
        >
          <CreditCard className="icon-sm" /> Open Whop checkout
        </a>
        <button type="button" className="btn btn-secondary btn-sm" onClick={openDepositModal}>
          View deposit status
        </button>
      </div>
    </div>
  );
}
