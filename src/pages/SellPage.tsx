import { ArrowLeft, ArrowRight, UploadCloud } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { PageHeader } from "../lib/badges";
import { fmtPrice } from "../lib/format";
import { DRIVER_TYPES } from "../lib/driver-types";
import { invalidateDataViews } from "../lib/dataInvalidation";
import { createListing } from "../services/marketplace";
import type { ScoreFlag } from "../types";

const steps = ["Basic Info", "Qualifications", "Availability", "Documents", "Consent", "Pricing", "Review"];

export default function SellPage() {
  const navigate = useNavigate();
  const { showToast } = useApp();
  const [step, setStep] = useState(1);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [first, setFirst] = useState("Marcus");
  const [last, setLast] = useState("Johnson");
  const [state, setState] = useState("TX");
  const [phone, setPhone] = useState("(555) 555-0100");
  const [email, setEmail] = useState("driver@email.com");
  const [cdlClass, setCdlClass] = useState("Class A");
  const [cdlNumber, setCdlNumber] = useState("TX-0000000");
  const [yearsExp, setYearsExp] = useState(5);
  const [scoreFlag, setScoreFlag] = useState<ScoreFlag>("green");
  const [endorsements, setEndorsements] = useState("Hazmat, Tanker");
  const [availDate, setAvailDate] = useState("2026-06-20");
  const [equipment, setEquipment] = useState("Dry Van");
  const [routePref, setRoutePref] = useState("OTR");
  const [driverType, setDriverType] = useState("Owner Operator");
  const [notes, setNotes] = useState("");
  const [price, setPrice] = useState(350);
  const payout = useMemo(() => fmtPrice(price * 0.85), [price]);

  const publish = async () => {
    setSubmitting(true);
    try {
      await createListing({
        firstName: first,
        lastName: last,
        state,
        phone,
        email,
        cdlClass,
        cdlNumber,
        yearsExp,
        scoreFlag,
        endorsements: endorsements.split(",").map((e) => e.trim()).filter(Boolean),
        availableDate: availDate,
        equipment,
        routePref,
        notes,
        price,
        driverType
      });
      invalidateDataViews(["my-listings", "admin", "dashboard", "marketplace"]);
      showToast("Listing published successfully!", "success");
      navigate("/my-listings");
    } catch {
      showToast("Failed to publish listing", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => {
    if (step === 5 && !consent) {
      showToast("Consent confirmation is required", "error");
      return;
    }
    if (step < 7) {
      setStep((s) => s + 1);
    } else {
      void publish();
    }
  };

  return (
    <div className="page active">
      <PageHeader title="Sell / List Driver" desc="List a CDL driver lead on the marketplace. All listings require driver consent." />
      <div className="card"><div className="card-body">
        <div className="form-steps" id="formSteps">
          {steps.map((s, i) => <div key={s} className={`step-indicator ${i + 1 === step ? "active" : ""} ${i + 1 < step ? "done" : ""}`}>{i + 1}. {s}</div>)}
        </div>
        <div className={`form-step ${step === 1 ? "active" : ""}`}>
          <h3 style={{ marginBottom: 16 }}>Step 1: Driver Basic Info</h3>
          <div className="form-row">
            <div className="form-group"><label>First Name *</label><input value={first} onChange={(e) => setFirst(e.target.value)} /></div>
            <div className="form-group"><label>Last Name *</label><input value={last} onChange={(e) => setLast(e.target.value)} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>State *</label>
              <select value={state} onChange={(e) => setState(e.target.value)}>
                {["TX", "CA", "FL", "OH", "GA", "IN", "IL", "PA", "NC", "WA", "AZ", "TN"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Phone *</label><input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          </div>
          <div className="form-group"><label>Email *</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        </div>
        <div className={`form-step ${step === 2 ? "active" : ""}`}>
          <h3 style={{ marginBottom: 16 }}>Step 2: Qualification Details</h3>
          <div className="form-row">
            <div className="form-group"><label>CDL Class *</label>
              <select value={cdlClass} onChange={(e) => setCdlClass(e.target.value)}><option>Class A</option><option>Class B</option><option>Class C</option></select>
            </div>
            <div className="form-group"><label>CDL Number *</label><input value={cdlNumber} onChange={(e) => setCdlNumber(e.target.value)} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Years Experience *</label><input type="number" min={0} value={yearsExp} onChange={(e) => setYearsExp(Number(e.target.value))} /></div>
            <div className="form-group"><label>CDL Score Status</label>
              <select value={scoreFlag} onChange={(e) => setScoreFlag(e.target.value as ScoreFlag)}>
                <option value="green">Green — Clean Record</option>
                <option value="yellow">Yellow — Review Needed</option>
                <option value="red">Red — Flagged</option>
              </select>
            </div>
          </div>
          <div className="form-group"><label>Endorsements</label><input value={endorsements} onChange={(e) => setEndorsements(e.target.value)} placeholder="Hazmat, Tanker, Doubles/Triples" /></div>
        </div>
        <div className={`form-step ${step === 3 ? "active" : ""}`}>
          <h3 style={{ marginBottom: 16 }}>Step 3: Availability & Preferences</h3>
          <div className="form-row">
            <div className="form-group"><label>Available Date *</label><input type="date" value={availDate} onChange={(e) => setAvailDate(e.target.value)} /></div>
            <div className="form-group"><label>Equipment Preference *</label>
              <select value={equipment} onChange={(e) => setEquipment(e.target.value)}><option>Dry Van</option><option>Reefer</option><option>Flatbed</option><option>Tanker</option></select>
            </div>
          </div>
          <div className="form-group"><label>Route Preference</label>
            <select value={routePref} onChange={(e) => setRoutePref(e.target.value)}><option>OTR</option><option>Regional</option><option>Local</option><option>Dedicated</option></select>
          </div>
          <div className="form-group"><label>Driver Type *</label>
            <select value={driverType} onChange={(e) => setDriverType(e.target.value)}>
              {DRIVER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Additional Notes for Buyers</label><textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Driver preferences, restrictions, special qualifications..." /></div>
        </div>
        <div className={`form-step ${step === 4 ? "active" : ""}`}>
          <h3 style={{ marginBottom: 16 }}>Step 4: Upload Documents</h3>
          <div className="upload-zone" onClick={() => showToast("Document upload simulated", "success")}>
            <UploadCloud />
            <div className="t-body">Drag & drop files here or click to browse</div>
            <div className="t-caption" style={{ marginTop: "var(--s2)" }}>CDL Copy, Medical Certificate, MVR Report, Employment History</div>
          </div>
          <div style={{ marginTop: 16, fontSize: 13, color: "var(--gray-500)" }}>Uploaded: <span className="badge badge-gray">CDL Copy (demo)</span></div>
        </div>
        <div className={`form-step ${step === 5 ? "active" : ""}`}>
          <h3 style={{ marginBottom: 16 }}>Step 5: Consent Confirmation</h3>
          <div className="consent-box">
            <label>
              <input checked={consent} onChange={(e) => setConsent(e.target.checked)} type="checkbox" />
              <span><strong>Required:</strong> Driver has agreed that their information may be shared with potential employers or recruiting partners. I confirm this driver has provided written or verbal consent to be listed on CDL Exchange.</span>
            </label>
          </div>
        </div>
        <div className={`form-step ${step === 6 ? "active" : ""}`}>
          <h3 style={{ marginBottom: 16 }}>Step 6: Pricing</h3>
          <div className="form-row">
            <div className="form-group"><label>Listing Price *</label><input type="number" value={price} min={50} onChange={(e) => setPrice(Number(e.target.value || 0))} /></div>
            <div className="form-group"><label>Listing Duration</label><select><option>30 days</option><option>60 days</option><option>90 days</option></select></div>
          </div>
          <div style={{ marginTop: 12, padding: 12, background: "var(--gray-50)", borderRadius: 8, fontSize: 13 }}>
            Platform fee: 15% commission on completed sale. You receive <strong id="sellerPayout">{payout}</strong> after sale.
          </div>
        </div>
        <div className={`form-step ${step === 7 ? "active" : ""}`}>
          <h3 style={{ marginBottom: 16 }}>Step 7: Review & Publish</h3>
          <div style={{ fontSize: 13, lineHeight: 2, background: "var(--gray-50)", padding: 20, borderRadius: 8 }}>
            <strong>Driver:</strong> {first} {last}<br />
            <strong>Driver Type:</strong> {driverType}<br />
            <strong>Price:</strong> {fmtPrice(price)}<br />
            <strong>Your Payout:</strong> {fmtPrice(price * 0.85)} (after 15% fee)<br />
            <strong>Consent:</strong> Confirmed<br />
            <strong>Status:</strong> Pending admin approval
          </div>
        </div>
        <div className="form-nav">
          <button className="btn btn-secondary" style={{ visibility: step === 1 ? "hidden" : "visible" }} onClick={() => setStep((s) => Math.max(1, s - 1))}><ArrowLeft className="icon-sm" /> Previous</button>
          <button className="btn btn-primary" onClick={next} disabled={submitting}>
            {step === 7 ? (submitting ? "Publishing..." : "Publish Listing") : <>Next <ArrowRight className="icon-sm" /></>}
          </button>
        </div>
      </div></div>
    </div>
  );
}
