import { CheckCircle2, CreditCard, ExternalLink, Eye, Truck } from "lucide-react";
import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { useRegisterFlowScroll } from "../hooks/useRegisterFlowScroll";
import { carrierPlanLabel, getWhopCheckoutUrl } from "../lib/carrier-plans";
import type { AccountType, CarrierPlanId, RegistrationStatus } from "../types/registration";

type SuccessState = {
  accountType: AccountType;
  status: RegistrationStatus;
  plan: CarrierPlanId | null;
  checkoutUrl?: string | null;
};

export default function RegistrationSuccessPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSignedIn } = useApp();
  const state = location.state as SuccessState | null;
  useRegisterFlowScroll();

  useEffect(() => {
    if (!state && !isSignedIn) {
      navigate("/register", { replace: true });
    }
  }, [state, isSignedIn, navigate]);

  if (!state) {
    return (
      <div className="register-success-page">
        <div className="register-success-card card">
          <p className="t-secondary">No registration data found.</p>
          <Link to="/register" className="btn btn-primary btn-sm">Start registration</Link>
        </div>
      </div>
    );
  }

  const isCarrier = state.accountType === "carrier";
  const isPreview = state.status === "active_preview";
  const isPendingPayment = state.status === "pending_payment";
  const isPendingReview = state.status === "pending_review";
  const checkoutUrl = state.checkoutUrl ?? (state.plan ? getWhopCheckoutUrl(state.plan) : null);

  return (
    <div className="register-success-page">
      <div className="register-success-card card">
        <div className="register-success-icon"><CheckCircle2 className="icon-xl" /></div>
        <h1 className="t-page">Account created</h1>

        {isCarrier ? (
          <>
            <p className="t-secondary" style={{ margin: "12px 0 20px", maxWidth: 520 }}>
              Your carrier account is ready. {isPendingPayment
                ? "Complete Whop checkout, then return here — your dashboard will show payment processing until a manager activates your plan."
                : "You can explore the marketplace on the free preview."}
            </p>
            {isPreview ? (
              <div className="success-status-box">
                <Eye className="icon-md" />
                <div>
                  <strong>Free Preview active</strong>
                  <p className="t-caption t-secondary">Browse the marketplace with one lifetime hire slot. Upgrade anytime from Pricing.</p>
                </div>
              </div>
            ) : null}
            {isPendingPayment ? (
              <div className="success-status-box">
                <CreditCard className="icon-md" />
                <div>
                  <strong>{carrierPlanLabel(state.plan)} — payment processing</strong>
                  <p className="t-caption t-secondary">
                    Finish checkout on Whop if you have not already. Until a platform manager confirms payment, you are
                    limited to one hire (active or completed).
                  </p>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <p className="t-secondary" style={{ margin: "12px 0 20px", maxWidth: 480 }}>
            Your account has been submitted for review. CDL Exchange will verify your profile and policy acceptance before activating marketplace access.
          </p>
        )}

        {isPendingReview ? (
          <div className="success-status-box">
            <Truck className="icon-md" />
            <div>
              <strong>Pending admin review</strong>
              <p className="t-caption t-secondary">You will be notified when your account is approved.</p>
            </div>
          </div>
        ) : null}

        <div className="register-success-actions">
          {isPendingPayment && checkoutUrl ? (
            <a href={checkoutUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              <ExternalLink className="icon-sm" /> Complete payment on Whop
            </a>
          ) : null}
          <button type="button" className="btn btn-primary" onClick={() => navigate("/dashboard")}>
            Go to dashboard
          </button>
          {isCarrier && isPreview ? (
            <button type="button" className="btn btn-secondary" onClick={() => navigate("/pricing")}>View paid plans</button>
          ) : null}
          <button type="button" className="btn btn-ghost" onClick={() => navigate("/marketplace")}>
            {isPreview ? "Explore marketplace preview" : "Go to marketplace"}
          </button>
        </div>
      </div>
    </div>
  );
}
