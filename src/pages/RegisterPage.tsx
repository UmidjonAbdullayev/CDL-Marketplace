import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, LogIn, ShieldCheck, Truck } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { ToastContainer } from "../components/layout/ToastContainer";
import { AccountTypeSelector } from "../components/registration/AccountTypeSelector";
import { AgencyRegistrationForm } from "../components/registration/AgencyRegistrationForm";
import { CarrierPlanSelector } from "../components/registration/CarrierPlanSelector";
import { CarrierRegistrationForm } from "../components/registration/CarrierRegistrationForm";
import { PolicyAgreementCheckbox } from "../components/registration/PolicyAgreementCheckbox";
import { RegistrationProgress } from "../components/registration/RegistrationProgress";
import { SoloRecruiterRegistrationForm } from "../components/registration/SoloRecruiterRegistrationForm";
import { useApp } from "../context/AppContext";
import { CARRIER_PLANS, getWhopCheckoutUrl } from "../lib/carrier-plans";
import { POLICY_VERSION } from "../lib/policies";
import { validateEmail, validateProfileStep, type FieldErrors } from "../lib/registration-validation";
import { sessionFromAccount } from "../lib/session";
import { AuthError, formatRegistrationError, sendPasswordResetEmail, signInWithEmailPassword } from "../services/auth";
import { submitRegistration } from "../services/registration";
import { useRegisterFlowScroll } from "../hooks/useRegisterFlowScroll";
import { linkRegistrationToCdlScore, ensureCdlScoreAccountOnLogin } from "../services/cdlScoreLink";
import { fetchCompanyById } from "../services/company";
import type {
  AccountType,
  AgencyProfile,
  CarrierPlanId,
  CarrierProfile,
  RegistrationAccount,
  SoloRecruiterProfile
} from "../types/registration";

async function sessionForAccount(account: RegistrationAccount) {
  const company = account.company_id ? await fetchCompanyById(account.company_id) : null;
  return sessionFromAccount(account, company);
}

type PageMode = "register" | "login";

const EMPTY_CARRIER: CarrierProfile = {
  companyName: "",
  mcNumber: "",
  companyEmail: "",
  phone: "",
  website: "",
  contactPersonName: "",
  contactPersonRole: "",
  specialization: "",
  serviceArea: "",
  fleetSize: "",
  address: "",
  city: "",
  state: "",
  zip: ""
};

const EMPTY_AGENCY: AgencyProfile = {
  agencyName: "",
  companyEmail: "",
  phone: "",
  website: "",
  contactPersonName: "",
  contactPersonRole: "",
  specialization: "",
  serviceArea: "",
  yearsInBusiness: "",
  address: "",
  city: "",
  state: "",
  zip: ""
};

const EMPTY_SOLO: SoloRecruiterProfile = {
  fullName: "",
  email: "",
  phone: "",
  yearsExperience: "",
  primaryDriverTypes: "",
  serviceArea: "",
  currentRole: ""
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast, signIn, isSignedIn } = useApp();
  useRegisterFlowScroll();

  const [mode, setMode] = useState<PageMode>("register");
  const [step, setStep] = useState(1);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [carrierProfile, setCarrierProfile] = useState<CarrierProfile>(EMPTY_CARRIER);
  const [agencyProfile, setAgencyProfile] = useState<AgencyProfile>(EMPTY_AGENCY);
  const [soloProfile, setSoloProfile] = useState<SoloRecruiterProfile>(EMPTY_SOLO);
  const [selectedPlan, setSelectedPlan] = useState<CarrierPlanId>("free");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  const signedOut = Boolean((location.state as { signedOut?: boolean } | null)?.signedOut);

  useEffect(() => {
    if (isSignedIn) {
      navigate("/dashboard", { replace: true });
    }
  }, [isSignedIn, navigate]);

  useEffect(() => {
    if (signedOut) setMode("login");
  }, [signedOut]);

  const profile = useMemo(() => {
    if (accountType === "carrier") return carrierProfile;
    if (accountType === "agency") return agencyProfile;
    return soloProfile;
  }, [accountType, carrierProfile, agencyProfile, soloProfile]);

  const canContinueStep1 = accountType !== null;

  const goNext = () => {
    if (step === 1 && !canContinueStep1) {
      showToast("Select an account type to continue", "error");
      return;
    }
    if (step === 2 && accountType) {
      const fieldErrors = validateProfileStep(accountType, profile, password, confirmPassword);
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        showToast("Please fix the highlighted fields", "error");
        return;
      }
      setErrors({});
    }
    if (step === 4 && !policyAccepted) {
      showToast("You must accept platform policies", "error");
      return;
    }
    setStep((s) => Math.min(5, s + 1));
  };

  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const handleSubmit = async () => {
    if (!accountType || !policyAccepted) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const result = await submitRegistration(
        {
          accountType,
          selectedPlan: accountType === "carrier" ? selectedPlan : undefined,
          email:
            accountType === "solo_recruiter"
              ? soloProfile.email
              : accountType === "carrier"
                ? carrierProfile.companyEmail
                : agencyProfile.companyEmail,
          password,
          profile,
          policyAccepted,
          policyVersion: POLICY_VERSION
        },
        { userAgent: navigator.userAgent }
      );
      signIn(await sessionForAccount(result.account));
      void linkRegistrationToCdlScore(result.account, password).catch(() => {
        showToast("Account created — CDL Score sync will retry on next sign-in", "error");
      });
      const checkoutUrl =
        accountType === "carrier" && selectedPlan !== "free" ? getWhopCheckoutUrl(selectedPlan) : null;
      if (checkoutUrl) {
        window.open(checkoutUrl, "_blank", "noopener,noreferrer");
      }
      navigate("/register/success", {
        state: {
          accountType,
          status: result.status,
          plan: accountType === "carrier" ? selectedPlan : null,
          checkoutUrl
        }
      });
    } catch (err) {
      const message = formatRegistrationError(err);
      setSubmitError(message);
      showToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = async () => {
    const emailErr = validateEmail(loginEmail);
    if (emailErr) {
      setLoginError(emailErr);
      return;
    }
    if (!loginPassword) {
      setLoginError("Password is required");
      return;
    }
    setSubmitting(true);
    setLoginError("");
    try {
      const account = await signInWithEmailPassword(loginEmail, loginPassword);
      const sync = await ensureCdlScoreAccountOnLogin(account, loginPassword).catch(() => null);
      const user = await sessionForAccount(account);
      const nextUser = sync?.success && sync.credits !== undefined
        ? { ...user, cdlScoreLinked: true, cdlScoreCredits: sync.credits }
        : user;
      signIn(nextUser);
      showToast(`Welcome back, ${nextUser.name}`, "success");
      navigate("/dashboard");
    } catch (err) {
      const msg = err instanceof AuthError ? err.message : err instanceof Error ? err.message : "Sign in failed";
      setLoginError(msg);
      showToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-brand">
        <div className="register-brand-inner">
          <div className="register-brand-logo">
            <div className="brand-icon"><Truck /></div>
            <div>
              <h1>CDL Exchange</h1>
              <p>Driver recruiting marketplace</p>
            </div>
          </div>
          <h2 className="register-brand-headline">Hire CDL drivers with confidence</h2>
          <p className="register-brand-copy">
            Consent-verified listings, CDL Score integration, escrow-protected recruiting fees,
            and CRM-ready hiring workflows — built for carriers, agencies, and solo recruiters.
          </p>
          <ul className="register-brand-list">
            <li><ShieldCheck className="icon-sm" /> Policy-backed marketplace safety</li>
            <li><ShieldCheck className="icon-sm" /> Anti-circumvention enforcement</li>
            <li><ShieldCheck className="icon-sm" /> Verified recruiting agreements</li>
          </ul>
          <button
            type="button"
            className="register-brand-link"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "Need an account? Create one" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>

      <div className="register-main">
        <div className="register-card card">
          <div className="register-mobile-brand">
            <div className="brand-icon"><Truck /></div>
            <div>
              <strong>CDL Exchange</strong>
              <p className="t-caption t-secondary">Driver recruiting marketplace</p>
            </div>
          </div>
          <div className="register-mode-tabs">
            <button
              type="button"
              className={`register-mode-tab ${mode === "login" ? "active" : ""}`}
              onClick={() => setMode("login")}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`register-mode-tab ${mode === "register" ? "active" : ""}`}
              onClick={() => setMode("register")}
            >
              Create account
            </button>
          </div>

          {mode === "login" ? (
            <div className="login-form-panel">
              <div className="register-card-head">
                <h2 className="t-page">Sign in to your account</h2>
                <p className="t-secondary">Use the email and password from your registration</p>
                {signedOut ? (
                  <p className="reg-signed-out-notice">You have been signed out. Sign in to continue.</p>
                ) : null}
              </div>
              <div className={`form-group ${loginError && !loginEmail ? "has-error" : ""}`}>
                <label htmlFor="loginEmail">Email</label>
                <input
                  id="loginEmail"
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                />
              </div>
              <div className={`form-group ${loginError && !loginPassword ? "has-error" : ""}`}>
                <label htmlFor="loginPassword">Password</label>
                <input
                  id="loginPassword"
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  autoComplete="current-password"
                  onKeyDown={(e) => e.key === "Enter" && void handleLogin()}
                />
              </div>
              {loginError ? <p className="field-error" style={{ marginBottom: 12 }}>{loginError}</p> : null}
              {resetSent ? (
                <p className="t-caption" style={{ marginBottom: 12, color: "var(--success)" }}>
                  Password reset email sent. Check your inbox.
                </p>
              ) : null}
              <button
                type="button"
                className="btn btn-primary btn-block"
                disabled={submitting}
                onClick={() => void handleLogin()}
              >
                {submitting ? <><Loader2 className="icon-sm spin" /> Signing in...</> : <><LogIn className="icon-sm" /> Sign in</>}
              </button>
              <p className="t-caption t-secondary" style={{ marginTop: 10, textAlign: "center" }}>
                <button
                  type="button"
                  className="policy-link"
                  disabled={submitting}
                  onClick={() => void (async () => {
                    const emailErr = validateEmail(loginEmail);
                    if (emailErr) {
                      setLoginError(emailErr);
                      return;
                    }
                    setSubmitting(true);
                    setLoginError("");
                    try {
                      await sendPasswordResetEmail(loginEmail);
                      setResetSent(true);
                      showToast("Password reset email sent", "success");
                    } catch (err) {
                      const msg = err instanceof AuthError ? err.message : "Could not send reset email";
                      setLoginError(msg);
                      showToast(msg, "error");
                    } finally {
                      setSubmitting(false);
                    }
                  })()}
                >
                  Forgot password?
                </button>
              </p>
              <p className="t-caption t-secondary" style={{ marginTop: 16, textAlign: "center" }}>
                New to CDL Exchange?{" "}
                <button type="button" className="policy-link" onClick={() => setMode("register")}>Create an account</button>
              </p>
            </div>
          ) : (
            <div className="register-form-panel">
              <div className="register-card-head">
                <h2 className="t-page">Create your account</h2>
                <p className="t-secondary">Join CDL Exchange as a carrier, agency, or solo recruiter</p>
              </div>

              <RegistrationProgress current={step} />

              {step === 1 ? (
                <section>
                  <h3 className="t-card" style={{ marginBottom: 12 }}>Choose account type</h3>
                  <AccountTypeSelector value={accountType} onChange={setAccountType} />
                </section>
              ) : null}

              {step === 2 && accountType === "carrier" ? (
                <section>
                  <h3 className="t-card" style={{ marginBottom: 12 }}>Carrier profile</h3>
                  <CarrierRegistrationForm
                    value={carrierProfile}
                    errors={errors}
                    password={password}
                    confirmPassword={confirmPassword}
                    onChange={(p) => setCarrierProfile((v) => ({ ...v, ...p }))}
                    onPasswordChange={setPassword}
                    onConfirmChange={setConfirmPassword}
                  />
                </section>
              ) : null}

              {step === 2 && accountType === "agency" ? (
                <section>
                  <h3 className="t-card" style={{ marginBottom: 12 }}>Agency profile</h3>
                  <AgencyRegistrationForm
                    value={agencyProfile}
                    errors={errors}
                    password={password}
                    confirmPassword={confirmPassword}
                    onChange={(p) => setAgencyProfile((v) => ({ ...v, ...p }))}
                    onPasswordChange={setPassword}
                    onConfirmChange={setConfirmPassword}
                  />
                </section>
              ) : null}

              {step === 2 && accountType === "solo_recruiter" ? (
                <section>
                  <h3 className="t-card" style={{ marginBottom: 12 }}>Solo recruiter profile</h3>
                  <SoloRecruiterRegistrationForm
                    value={soloProfile}
                    errors={errors}
                    password={password}
                    confirmPassword={confirmPassword}
                    onChange={(p) => setSoloProfile((v) => ({ ...v, ...p }))}
                    onPasswordChange={setPassword}
                    onConfirmChange={setConfirmPassword}
                  />
                </section>
              ) : null}

              {step === 3 && accountType === "carrier" ? (
                <section className="permissions-info card" style={{ padding: 16, background: "var(--bg)" }}>
                  <h3 className="t-card" style={{ marginBottom: 8 }}>Carrier marketplace access</h3>
                  <p className="t-secondary">
                    After registration you will choose a plan. Paid plans require Whop checkout; a platform manager
                    verifies payment before your full hire limits unlock.
                  </p>
                </section>
              ) : null}

              {step === 3 && accountType === "agency" ? (
                <section className="permissions-info card" style={{ padding: 16, background: "var(--bg)" }}>
                  <h3 className="t-card" style={{ marginBottom: 8 }}>Agency permissions</h3>
                  <p className="t-secondary">After admin review, approved agencies can list consent-verified driver leads, manage reservations, and participate in hiring workspaces.</p>
                </section>
              ) : null}

              {step === 3 && accountType === "solo_recruiter" ? (
                <section className="permissions-info card" style={{ padding: 16, background: "var(--bg)" }}>
                  <h3 className="t-card" style={{ marginBottom: 8 }}>Solo recruiter permissions</h3>
                  <p className="t-secondary">After review, solo recruiters can list individual driver leads and collaborate with carriers through platform contracts.</p>
                </section>
              ) : null}

              {step === 4 ? (
                <section>
                  <h3 className="t-card" style={{ marginBottom: 12 }}>Platform policies</h3>
                  <p className="t-secondary" style={{ marginBottom: 16 }}>
                    CDL Exchange requires all users to accept marketplace safety policies before registration.
                  </p>
                  <PolicyAgreementCheckbox checked={policyAccepted} onChange={setPolicyAccepted} />
                </section>
              ) : null}

              {step === 5 ? (
                <section>
                  {accountType === "carrier" ? (
                    <>
                      <h3 className="t-card" style={{ marginBottom: 8 }}>Choose your plan</h3>
                      <p className="t-secondary" style={{ marginBottom: 16 }}>
                        Select a plan to finish registration. Paid plans open Whop checkout in a new tab after your
                        account is created.
                      </p>
                      <CarrierPlanSelector value={selectedPlan} onChange={setSelectedPlan} />
                    </>
                  ) : null}
                  <h3 className="t-card" style={{ marginBottom: 12, marginTop: accountType === "carrier" ? 24 : 0 }}>Review &amp; submit</h3>
                  <div className="reg-review-summary">
                    <div><span className="t-secondary">Account type</span><strong>{accountType?.replace("_", " ")}</strong></div>
                    {accountType === "carrier" ? (
                      <div>
                        <span className="t-secondary">Plan</span>
                        <strong>{CARRIER_PLANS.find((p) => p.id === selectedPlan)?.name ?? selectedPlan}</strong>
                      </div>
                    ) : null}
                    <div><span className="t-secondary">Policy version</span><strong>{POLICY_VERSION}</strong></div>
                    <div><span className="t-secondary">Policies accepted</span><strong>{policyAccepted ? "Yes" : "No"}</strong></div>
                  </div>
                  {submitError ? <p className="field-error" style={{ marginTop: 12 }}>{submitError}</p> : null}
                </section>
              ) : null}

              <div className="register-actions">
                {step > 1 ? (
                  <button type="button" className="btn btn-secondary" onClick={goBack}>
                    <ArrowLeft className="icon-sm" /> Back
                  </button>
                ) : (
                  <span />
                )}
                {step < 5 ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={goNext}
                    disabled={(step === 1 && !canContinueStep1) || (step === 4 && !policyAccepted)}
                  >
                    Continue <ArrowRight className="icon-sm" />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!policyAccepted || submitting}
                    onClick={() => void handleSubmit()}
                  >
                    {submitting ? <><Loader2 className="icon-sm spin" /> Creating account...</> : "Create account"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <ToastContainer />
    </div>
  );
}
