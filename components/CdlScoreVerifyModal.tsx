import { useState } from "react";
import { CDL_SCORE_REGISTER_URL, verifyCdlScoreLogin } from "../services/notifications";
import { useApp } from "../context/AppContext";

type Step = "ask" | "login" | "register";

export function CdlScoreVerifyModal({
  open,
  onClose,
  onVerified
}: {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
}) {
  const { showToast } = useApp();
  const [step, setStep] = useState<Step>("ask");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const reset = () => {
    setStep("ask");
    setEmail("");
    setPassword("");
    setLoading(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submitLogin = () => {
    setLoading(true);
    void verifyCdlScoreLogin(email, password)
      .then((ok) => {
        if (!ok) {
          showToast("Invalid CDL Score credentials", "error");
          return;
        }
        localStorage.setItem("cdl_score_verified", "1");
        showToast("CDL Score Partner status activated", "success");
        onVerified();
        close();
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className="modal-overlay open" onClick={close}>
      <div className="modal cdl-verify-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>CDL Score Verification</h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={close}>✕</button>
        </div>
        <div className="modal-body">
          {step === "ask" ? (
            <>
              <p className="t-body">Are you a verified CDL Score user?</p>
              <p className="t-caption t-secondary">Connect your account to unlock full driver safety data on purchased leads and earn CDL Score Partner status.</p>
              <div className="cdl-verify-actions">
                <button type="button" className="btn btn-primary" onClick={() => setStep("login")}>Yes — Sign in</button>
                <button type="button" className="btn btn-secondary" onClick={() => setStep("register")}>No — Register</button>
              </div>
            </>
          ) : null}
          {step === "login" ? (
            <>
              <p className="t-caption t-secondary" style={{ marginBottom: 12 }}>Enter your CDL Score login credentials.</p>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <p className="t-caption t-secondary">Demo: recruiter@rapidhaul.com / demo123</p>
              <div className="cdl-verify-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setStep("ask")}>Back</button>
                <button type="button" className="btn btn-primary" disabled={loading || !email || !password} onClick={submitLogin}>
                  {loading ? "Verifying..." : "Verify Account"}
                </button>
              </div>
            </>
          ) : null}
          {step === "register" ? (
            <>
              <p className="t-body">Create a CDL Score account to verify drivers and unlock partner benefits.</p>
              <p className="t-caption t-secondary">You&apos;ll be redirected to CDL Score registration. Return here after signing up to link your account.</p>
              <div className="cdl-verify-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setStep("ask")}>Back</button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    window.open(CDL_SCORE_REGISTER_URL, "_blank", "noopener,noreferrer");
                    showToast("Complete registration on CDL Score, then sign in here", "success");
                    setStep("login");
                  }}
                >
                  Go to Registration
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
