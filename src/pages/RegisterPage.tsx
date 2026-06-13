import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, ShieldCheck, Truck } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ToastContainer } from "../components/layout/ToastContainer";
import { AccountTypeSelector } from "../components/registration/AccountTypeSelector";
import { AgencyRegistrationForm } from "../components/registration/AgencyRegistrationForm";
import { CarrierPlanSelector } from "../components/registration/CarrierPlanSelector";
import { CarrierRegistrationForm } from "../components/registration/CarrierRegistrationForm";
import { PolicyAgreementCheckbox } from "../components/registration/PolicyAgreementCheckbox";
import { RegistrationProgress } from "../components/registration/RegistrationProgress";
import { SoloRecruiterRegistrationForm } from "../components/registration/SoloRecruiterRegistrationForm";
import { useApp } from "../context/AppContext";
import { POLICY_VERSION } from "../lib/policies";
import { validateProfileStep, type FieldErrors } from "../lib/registration-validation";
import { submitRegistration } from "../services/registration";
import type {
  AccountType,
  AgencyProfile,
  CarrierPlanId,
  CarrierProfile,
  SoloRecruiterProfile
} from "../types/registration";

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

  const [step, setStep] = useState(1);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [carrierProfile, setCarrierProfile] = useState<CarrierProfile>(EMPTY_CARRIER);
  const [agencyProfile, setAgencyProfile] = useState<AgencyProfile>(EMPTY_AGENCY);
  const [soloProfile, setSoloProfile] = useState<SoloRecruiterProfile>(EMPTY_SOLO);
  const [selectedPlan, setSelectedPlan] = useState<CarrierPlanId>("growth");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

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
          email: accountType === "solo_recruiter" ? soloProfile.email : accountType === "carrier" ? carrierProfile.companyEmail : agencyProfile.companyEmail,
          password,
          profile,
          policyAccepted,
          policyVersion: POLICY_VERSION
        },
        { userAgent: navigator.userAgent }
      );
      navigate("/register/success", {
        state: { accountType, status: result.status, plan: accountType === "carrier" ? selectedPlan : null }
      });
    } catch {
      setSubmitError("Registration failed. Please try again.");
      showToast("Registration failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const signedOut = Boolean((location.state as { signedOut?: boolean } | null)?.signedOut);

  const handleSignIn = () => {
    signIn();
    showToast("Signed in successfully", "success");
    navigate("/dashboard");
  };

  if (isSignedIn) {
    return (
      <div className="register-page">
        <div className="register-main" style={{ width: "100%", alignItems: "center", justifyContent: "center" }}>
          <div className="register-card card" style={{ maxWidth: 420, textAlign: "center" }}>
            <h2 className="t-page">You are signed in</h2>
            <p className="t-secondary" style={{ margin: "12px 0 20px" }}>Continue to your dashboard or sign out from the profile menu.</p>
            <button type="button" className="btn btn-primary" onClick={() => navigate("/dashboard")}>Go to dashboard</button>
          </div>
        </div>
        <ToastContainer />
      </div>
    );
  }

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
          <button type="button" className="register-brand-link" onClick={handleSignIn}>Already have an account? Sign in</button>
        </div>
      </div>

      <div className="register-main scroll-y">
        <div className="register-card card">
          <div className="register-card-head">
            <h2 className="t-page">Create your account</h2>
            <p className="t-secondary">Join CDL Exchange as a carrier, agency, or solo recruiter</p>
            {signedOut ? (
              <p className="reg-signed-out-notice">You have been signed out. Sign in again or create a new account.</p>
            ) : null}
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
            <section>
              <h3 className="t-card" style={{ marginBottom: 8 }}>Select your plan</h3>
              <p className="t-secondary" style={{ marginBottom: 16 }}>Choose how you want to access the marketplace and CRM tools.</p>
              <CarrierPlanSelector value={selectedPlan} onChange={setSelectedPlan} />
            </section>
          ) : null}

          {step === 3 && accountType === "agency" ? (
            <section className="permissions-info card" style={{ padding: 16, background: "var(--bg)" }}>
              <h3 className="t-card" style={{ marginBottom: 8 }}>Agency permissions</h3>
              <p className="t-secondary">After admin review, approved agencies can list consent-verified driver leads, manage reservations, and participate in hiring workspaces. Listing fees and commission terms apply per completed placements.</p>
            </section>
          ) : null}

          {step === 3 && accountType === "solo_recruiter" ? (
            <section className="permissions-info card" style={{ padding: 16, background: "var(--bg)" }}>
              <h3 className="t-card" style={{ marginBottom: 8 }}>Solo recruiter permissions</h3>
              <p className="t-secondary">After review, solo recruiters can list individual driver leads and collaborate with carriers through platform contracts, messaging, and document exchange.</p>
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
              <h3 className="t-card" style={{ marginBottom: 12 }}>Review &amp; submit</h3>
              <div className="reg-review-summary">
                <div><span className="t-secondary">Account type</span><strong>{accountType?.replace("_", " ")}</strong></div>
                {accountType === "carrier" ? <div><span className="t-secondary">Plan</span><strong>{selectedPlan}</strong></div> : null}
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
              <Link to="/dashboard" className="btn btn-ghost"><ArrowLeft className="icon-sm" /> Home</Link>
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
      </div>
      <ToastContainer />
    </div>
  );
}
