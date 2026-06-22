import { CreditCard, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { carrierPlanLabel, getWhopCheckoutUrl } from "../../lib/carrier-plans";
import type { CarrierPlanId } from "../../types/registration";

type Props = {
  plan: CarrierPlanId | null;
  status: string;
};

export function PaymentProcessingBanner({ plan, status }: Props) {
  if (status !== "pending_payment" || !plan || plan === "free") return null;

  const checkoutUrl = getWhopCheckoutUrl(plan);

  return (
    <div className="payment-processing-banner card">
      <div className="payment-processing-banner-body">
        <Loader2 className="icon-md spin payment-processing-icon" />
        <div>
          <strong>Payment processing — {carrierPlanLabel(plan)} plan</strong>
          <p className="t-secondary t-caption">
            Complete checkout on Whop if you have not already. A platform manager will verify your payment and
            activate your plan. Until then you are limited to one hire (active or completed).
          </p>
        </div>
      </div>
      <div className="payment-processing-actions">
        {checkoutUrl ? (
          <a href={checkoutUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
            <CreditCard className="icon-sm" /> Open Whop checkout
          </a>
        ) : null}
        <Link to="/pricing" className="btn btn-secondary btn-sm">View plan details</Link>
      </div>
    </div>
  );
}
