import { CheckCircle2, CreditCard, Eye, Truck } from "lucide-react";
import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import type { AccountType, CarrierPlanId, RegistrationStatus } from "../types/registration";

type SuccessState = {
  accountType: AccountType;
  status: RegistrationStatus;
  plan: CarrierPlanId | null;
};

export default function RegistrationSuccessPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSignedIn } = useApp();
  const state = location.state as SuccessState | null;

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

  return (
    <div className="register-success-page">
      <div className="register-success-card card">
        <div className="register-success-icon"><CheckCircle2 className="icon-xl" /></div>
        <h1 className="t-page">Account created</h1>

        {isCarrier ? (
          <>
            <p className="t-secondary" style={{ margin: "12px 0 20px", maxWidth: 480 }}>
              Your carrier account has been created. Choose a plan or continue in Free Preview Mode.
            </p>
            {isPreview ? (
              <div className="success-status-box">
                <Eye className="icon-md" />
                <div>
                  <strong>Free Preview Mode active</strong>
                  <p className="t-caption t-secondary">Browse limited marketplace previews. Upgrade to start hiring processes and unlock CRM tools.</p>
                </div>
              </div>
            ) : null}
            {isPendingPayment ? (
              <div className="success-status-box">
                <CreditCard className="icon-md" />
                <div>
                  <strong>Plan selected — payment pending</strong>
                  <p className="t-caption t-secondary">Your {state.plan} plan will activate after payment is connected.</p>
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
          <button type="button" className="btn btn-primary" onClick={() => navigate("/marketplace")}>
            {isPreview ? "Explore marketplace preview" : "Go to marketplace"}
          </button>
          {isCarrier && isPreview ? (
            <button type="button" className="btn btn-secondary" onClick={() => navigate("/pricing")}>View paid plans</button>
          ) : null}
          <Link to="/dashboard" className="btn btn-ghost">Continue to dashboard</Link>
        </div>
      </div>
    </div>
  );
}
