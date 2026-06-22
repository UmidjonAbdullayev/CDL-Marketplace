import { ArrowLeft, ArrowRight, Paperclip, UploadCloud } from "lucide-react";
import { useMemo, useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { PageHeader } from "../lib/badges";
import { fmtPrice } from "../lib/format";
import { DRIVER_TYPES } from "../lib/driver-types";
import { US_STATES } from "../lib/us-states";
import { invalidateDataViews } from "../lib/dataInvalidation";
import { maxRecruiterPrice, validateRecruiterListPrice } from "../lib/listing-pricing";
import { createListing } from "../services/marketplace";
import { PlatformLimitError, resolveListingLimit, limitHint } from "../services/platformLimits";
import { uploadChatAttachment } from "../services/chatAttachments";
import type { ScoreFlag } from "../types";

const steps = ["Basic Info", "Qualifications", "Availability", "Documents", "Consent", "Pricing", "Review"];

function stepErrors(
  stepNum: number,
  fields: {
    first: string;
    last: string;
    state: string;
    phone: string;
    cdlClass: string;
    yearsExp: number | "";
    availDate: string;
    equipment: string;
    routePref: string;
    driverType: string;
    documents: string[];
    consent: boolean;
    price: number | "";
  }
): string[] {
  const errs: string[] = [];
  if (stepNum === 1) {
    if (!fields.first.trim()) errs.push("First name is required");
    if (!fields.last.trim()) errs.push("Last name is required");
    if (!fields.state) errs.push("State is required");
    if (!fields.phone.trim()) errs.push("Phone number is required");
  }
  if (stepNum === 2) {
    if (!fields.cdlClass) errs.push("CDL class is required");
    if (fields.yearsExp === "") errs.push("Years of experience is required");
  }
  if (stepNum === 3) {
    if (!fields.availDate) errs.push("Availability date is required");
    if (!fields.equipment) errs.push("Equipment preference is required");
    if (!fields.routePref) errs.push("Route preference is required");
    if (!fields.driverType) errs.push("Driver type is required");
  }
  if (stepNum === 4) {
    if (!fields.documents.length) errs.push("Upload at least one document");
  }
  if (stepNum === 5) {
    if (!fields.consent) errs.push("Driver consent confirmation is required");
  }
  if (stepNum === 6) {
    if (fields.price === "") errs.push("Listing price is required");
  }
  return errs;
}

function stepComplete(stepNum: number, fields: Parameters<typeof stepErrors>[1]): boolean {
  return stepErrors(stepNum, fields).length === 0;
}

export default function SellPage() {
  const navigate = useNavigate();
  const { showToast } = useApp();
  const [step, setStep] = useState(1);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [state, setState] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [cdlClass, setCdlClass] = useState("Class A");
  const [cdlNumber, setCdlNumber] = useState("");
  const [yearsExp, setYearsExp] = useState<number | "">("");
  const [scoreFlag, setScoreFlag] = useState<ScoreFlag>("green");
  const [endorsements, setEndorsements] = useState("");
  const [availDate, setAvailDate] = useState("");
  const [equipment, setEquipment] = useState("Dry Van");
  const [routePref, setRoutePref] = useState("OTR");
  const [driverType, setDriverType] = useState("Owner Operator");
  const [notes, setNotes] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [listingDurationDays, setListingDurationDays] = useState(7);
  const [documents, setDocuments] = useState<string[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);
  const priceCap = useMemo(() => maxRecruiterPrice(driverType), [driverType]);
  const [limitNote, setLimitNote] = useState("");

  const fieldSnapshot = useMemo(
    () => ({
      first,
      last,
      state,
      phone,
      cdlClass,
      yearsExp,
      availDate,
      equipment,
      routePref,
      driverType,
      documents,
      consent,
      price
    }),
    [first, last, state, phone, cdlClass, yearsExp, availDate, equipment, routePref, driverType, documents, consent, price]
  );

  useEffect(() => {
    void resolveListingLimit().then((snap) => setLimitNote(limitHint(snap))).catch(() => {});
  }, []);

  const onDocumentChosen = async (file: File) => {
    setUploadingDoc(true);
    try {
      const uploaded = await uploadChatAttachment(file, "listings");
      setDocuments((prev) => [...prev, uploaded.name]);
      showToast(`Uploaded: ${uploaded.name}`, "success");
    } catch {
      showToast("Failed to upload document", "error");
    } finally {
      setUploadingDoc(false);
    }
  };

  const validateCurrentStep = (): boolean => {
    const errs = stepErrors(step, fieldSnapshot);
    if (errs.length) {
      showToast(errs[0], "error");
      return false;
    }
    if (step === 6 && price !== "") {
      const capError = validateRecruiterListPrice(Number(price), driverType);
      if (capError) {
        showToast(capError, "error");
        return false;
      }
    }
    return true;
  };

  const goToStep = (target: number) => {
    if (target === step) return;
    if (target < step) {
      setStep(target);
      return;
    }
    for (let s = step; s < target; s += 1) {
      const errs = stepErrors(s, fieldSnapshot);
      if (errs.length) {
        showToast(`Complete step ${s} first: ${errs[0]}`, "error");
        setStep(s);
        return;
      }
    }
    setStep(target);
  };

  const publish = async () => {
    for (let s = 1; s <= 6; s += 1) {
      const errs = stepErrors(s, fieldSnapshot);
      if (errs.length) {
        showToast(errs[0], "error");
        setStep(s);
        return;
      }
    }
    if (price === "") {
      showToast("Listing price is required", "error");
      setStep(6);
      return;
    }
    const capError = validateRecruiterListPrice(Number(price), driverType);
    if (capError) {
      showToast(capError, "error");
      setStep(6);
      return;
    }
    setSubmitting(true);
    try {
      await createListing({
        firstName: first.trim(),
        lastName: last.trim(),
        state,
        phone: phone.trim(),
        email: email.trim() || undefined,
        cdlClass,
        cdlNumber: cdlNumber.trim() || undefined,
        yearsExp: Number(yearsExp),
        scoreFlag,
        endorsements: endorsements.split(",").map((e) => e.trim()).filter(Boolean),
        availableDate: availDate,
        equipment,
        routePref,
        notes: notes.trim(),
        price: Number(price),
        driverType,
        listingDurationDays,
        documents
      });
      invalidateDataViews(["my-listings", "admin", "dashboard", "marketplace"]);
      showToast("Listing published successfully!", "success");
      navigate("/my-listings");
    } catch (e) {
      if (e instanceof PlatformLimitError) {
        showToast(e.message, "error");
      } else {
        showToast("Failed to publish listing", "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => {
    if (!validateCurrentStep()) return;
    if (step < 7) {
      setStep((s) => s + 1);
    } else {
      void publish();
    }
  };

  return (
    <div className="page active">
      <PageHeader title="Sell / List Driver" desc="List a CDL driver lead on the marketplace. All listings require driver consent." />
      {limitNote ? (
        <p className="t-caption t-secondary platform-limit-banner">{limitNote}</p>
      ) : null}
      <div className="card"><div className="card-body">
        <div className="form-steps" id="formSteps">
          {steps.map((s, i) => {
            const n = i + 1;
            const complete = n < step || (n !== step && stepComplete(n, fieldSnapshot));
            const invalid = n < step && !stepComplete(n, fieldSnapshot);
            return (
              <button
                key={s}
                type="button"
                className={`step-indicator ${n === step ? "active" : ""} ${complete ? "done" : ""} ${invalid ? "invalid" : ""}`}
                onClick={() => goToStep(n)}
                aria-current={n === step ? "step" : undefined}
              >
                {n}. {s}
              </button>
            );
          })}
        </div>
        <div className={`form-step ${step === 1 ? "active" : ""}`}>
          <h3 style={{ marginBottom: 16 }}>Step 1: Driver Basic Info</h3>
          <div className="form-row">
            <div className="form-group"><label>First Name *</label><input value={first} onChange={(e) => setFirst(e.target.value)} placeholder="First name" required /></div>
            <div className="form-group"><label>Last Name *</label><input value={last} onChange={(e) => setLast(e.target.value)} placeholder="Last name" required /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>State *</label>
              <select value={state} onChange={(e) => setState(e.target.value)} required>
                <option value="">Select state</option>
                {US_STATES.map((s) => <option key={s.code} value={s.code}>{s.code} — {s.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Phone *</label><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" required /></div>
          </div>
          <div className="form-group"><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address (optional)" /></div>
        </div>
        <div className={`form-step ${step === 2 ? "active" : ""}`}>
          <h3 style={{ marginBottom: 16 }}>Step 2: Qualification Details</h3>
          <div className="form-row">
            <div className="form-group"><label>CDL Class *</label>
              <select value={cdlClass} onChange={(e) => setCdlClass(e.target.value)} required><option>Class A</option><option>Class B</option><option>Class C</option></select>
            </div>
            <div className="form-group"><label>CDL Number</label><input value={cdlNumber} onChange={(e) => setCdlNumber(e.target.value)} placeholder="CDL number (optional)" /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Years Experience *</label><input type="number" min={0} value={yearsExp} onChange={(e) => setYearsExp(e.target.value === "" ? "" : Number(e.target.value))} placeholder="Years" required /></div>
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
            <div className="form-group"><label>Available Date *</label><input type="date" value={availDate} onChange={(e) => setAvailDate(e.target.value)} required /></div>
            <div className="form-group"><label>Equipment Preference *</label>
              <select value={equipment} onChange={(e) => setEquipment(e.target.value)} required><option>Dry Van</option><option>Reefer</option><option>Flatbed</option><option>Tanker</option></select>
            </div>
          </div>
          <div className="form-group"><label>Route Preference *</label>
            <select value={routePref} onChange={(e) => setRoutePref(e.target.value)} required><option>OTR</option><option>Regional</option><option>Local</option><option>Dedicated</option></select>
          </div>
          <div className="form-group"><label>Driver Type *</label>
            <select value={driverType} onChange={(e) => setDriverType(e.target.value)} required>
              {DRIVER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Additional Notes for Buyers</label><textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Driver preferences, restrictions, special qualifications..." /></div>
        </div>
        <div className={`form-step ${step === 4 ? "active" : ""}`}>
          <h3 style={{ marginBottom: 16 }}>Step 4: Upload Documents *</h3>
          <input
            ref={docInputRef}
            type="file"
            className="file-input-hidden"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void onDocumentChosen(file);
            }}
          />
          <div
            className="upload-zone"
            role="button"
            tabIndex={0}
            onClick={() => !uploadingDoc && docInputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && !uploadingDoc && docInputRef.current?.click()}
          >
            <UploadCloud />
            <div className="t-body">{uploadingDoc ? "Uploading…" : "Drag & drop files here or click to browse"}</div>
            <div className="t-caption" style={{ marginTop: "var(--s2)" }}>CDL Copy, Medical Certificate, MVR Report, Employment History</div>
          </div>
          {documents.length > 0 ? (
            <ul className="sell-doc-list">
              {documents.map((name) => (
                <li key={name}><Paperclip className="icon-sm" /> {name}</li>
              ))}
            </ul>
          ) : (
            <p className="t-caption t-secondary" style={{ marginTop: 12 }}>At least one document is required before publishing.</p>
          )}
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
            <div className="form-group">
              <label>Listing Price *</label>
              <input
                type="number"
                value={price}
                min={50}
                max={priceCap}
                placeholder="Listing price"
                required
                onChange={(e) => setPrice(e.target.value === "" ? "" : Math.min(priceCap, Math.max(50, Number(e.target.value) || 50)))}
              />
              <span className="t-caption t-secondary">Max {fmtPrice(priceCap)} for {driverType}</span>
            </div>
            <div className="form-group">
              <label>Listing Duration *</label>
              <select value={listingDurationDays} onChange={(e) => setListingDurationDays(Number(e.target.value))} required>
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <option key={d} value={d}>{d} day{d === 1 ? "" : "s"}</option>
                ))}
              </select>
              <span className="t-caption t-secondary">Listings expire after up to 7 days</span>
            </div>
          </div>
        </div>
        <div className={`form-step ${step === 7 ? "active" : ""}`}>
          <h3 style={{ marginBottom: 16 }}>Step 7: Review & Publish</h3>
          <div style={{ fontSize: 13, lineHeight: 2, background: "var(--gray-50)", padding: 20, borderRadius: 8 }}>
            <strong>Driver:</strong> {first || "—"} {last || ""}<br />
            <strong>Driver Type:</strong> {driverType}<br />
            <strong>Listing Price:</strong> {price !== "" ? fmtPrice(Number(price)) : "—"}<br />
            <strong>Duration:</strong> {listingDurationDays} day{listingDurationDays === 1 ? "" : "s"}<br />
            <strong>Consent:</strong> {consent ? "Confirmed" : "Pending"}<br />
            <strong>Documents:</strong> {documents.length ? documents.join(", ") : "None uploaded"}<br />
            <strong>Status:</strong> Pending admin approval
          </div>
        </div>
        <div className="form-nav">
          <button className="btn btn-secondary" style={{ visibility: step === 1 ? "hidden" : "visible" }} type="button" onClick={() => setStep((s) => Math.max(1, s - 1))}><ArrowLeft className="icon-sm" /> Previous</button>
          <button className="btn btn-primary" type="button" onClick={next} disabled={submitting}>
            {step === 7 ? (submitting ? "Publishing..." : "Publish Listing") : <>Next <ArrowRight className="icon-sm" /></>}
          </button>
        </div>
      </div></div>
    </div>
  );
}
