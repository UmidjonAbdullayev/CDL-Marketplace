import { CreditCard, ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";
import { fmtPrice } from "../../lib/format";
import { WALLET_DEPOSIT_OPTIONS, type WalletDepositTierId } from "../../lib/wallet-deposits";
import { createPendingWalletDeposit } from "../../services/wallet";

type Props = {
  pendingAmount?: number | null;
  onDepositStarted?: () => void;
};

export function WalletDepositForm({ pendingAmount, onDepositStarted }: Props) {
  const [busy, setBusy] = useState<WalletDepositTierId | null>(null);
  const [error, setError] = useState("");

  const startDeposit = async (tierId: WalletDepositTierId) => {
    const option = WALLET_DEPOSIT_OPTIONS.find((o) => o.id === tierId);
    if (!option) return;
    setBusy(tierId);
    setError("");
    try {
      await createPendingWalletDeposit(tierId);
      window.open(option.checkoutUrl, "_blank", "noopener,noreferrer");
      onDepositStarted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start deposit");
    } finally {
      setBusy(null);
    }
  };

  if (pendingAmount) {
    return (
      <div className="wallet-deposit-pending">
        <Loader2 className="icon-md spin" />
        <div>
          <strong>Deposit payment processing — {fmtPrice(pendingAmount)}</strong>
          <p className="t-caption t-secondary">
            Complete checkout on Whop if you have not already. A platform manager will verify your payment and credit
            your wallet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="wallet-deposit-form">
      <p className="t-secondary" style={{ fontSize: 13, marginBottom: 16 }}>
        Choose a deposit amount. You will complete payment on Whop, then your request stays pending until a platform
        manager approves it and credits your wallet balance.
      </p>
      <div className="wallet-deposit-options">
        {WALLET_DEPOSIT_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className="wallet-deposit-option card"
            disabled={busy !== null}
            onClick={() => void startDeposit(option.id)}
          >
            <div className="wallet-deposit-option-amount">{fmtPrice(option.amount)}</div>
            <div className="t-caption t-secondary">Wallet top-up via Whop</div>
            <span className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
              {busy === option.id ? (
                <>Processing…</>
              ) : (
                <>
                  <ExternalLink className="icon-sm" /> Checkout on Whop
                </>
              )}
            </span>
          </button>
        ))}
      </div>
      {error ? <p className="field-error" style={{ marginTop: 12 }}>{error}</p> : null}
      <p className="t-caption t-secondary" style={{ marginTop: 14 }}>
        <CreditCard className="icon-sm" style={{ verticalAlign: "middle", marginRight: 4 }} />
        Funds are used for recruiting fees held in escrow when you start a deal.
      </p>
    </div>
  );
}
