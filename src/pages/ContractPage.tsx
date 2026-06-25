import { useEffect, useState } from "react";
import { ArrowLeft, FileSignature, ShieldCheck } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { canStartHiring } from "../lib/account-capabilities";
import { invalidateDataViews } from "../lib/dataInvalidation";
import { BUYER_CONTRACT_CLAUSES } from "../lib/hiring";
import { driverExperienceFields } from "../lib/driver-experience";
import { fmtDate, fmtRecruitingFee, fullName } from "../lib/format";
import { isSupabaseConfigured } from "../lib/supabase";
import { findActiveDealForListing, fetchListingForContract, fetchListingHireAvailability, ListingNotAvailableError, PlatformLimitError, startHiringProcess, WalletInsufficientError } from "../services/hiring";
import { CompanyReviewsPanel } from "../components/CompanyReviewsPanel";
import type { DriverCard } from "../types";

export default function ContractPage() {
  const { listingId } = useParams();
  const navigate = useNavigate();
  const { showToast, sessionUser, openDepositModal, refreshWalletBalance } = useApp();
  const canStartHiringProcess = canStartHiring(sessionUser);
  const id = Number(listingId);

  const [driver, setDriver] = useState<DriverCard | null>(null);
  const [sellerCompanyId, setSellerCompanyId] = useState<string | null>(null);
  const [listingUnavailable, setListingUnavailable] = useState(false);
  const [unavailableReason, setUnavailableReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [signerName, setSignerName] = useState(sessionUser?.name ?? "");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!canStartHiringProcess) {
      showToast("Only carrier and platform admin accounts can start hiring processes", "error");
      navigate("/marketplace", { replace: true });
    }
  }, [canStartHiringProcess, navigate, showToast]);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        if (isSupabaseConfigured) {
          const availability = await fetchListingHireAvailability(id);
          if (!availability.available) {
            setListingUnavailable(true);
            setUnavailableReason(availability.reason ?? "This driver is no longer available.");
            setLoading(false);
            return;
          }
          const existing = await findActiveDealForListing(id);
          if (existing?.buyer_signed_at) {
            navigate(`/deals/${existing.id}`, { replace: true });
            return;
          }
          const result = await fetchListingForContract(id);
          setDriver(result?.card ?? null);
          setSellerCompanyId(result?.sellerId ?? null);
        } else {
          const { DRIVERS } = await import("../data/drivers");
          const d = DRIVERS.find((x) => x.id === id);
          if (d) {
            setDriver({
              id: d.id,
              first: d.first,
              last: d.last,
              state: d.state,
              ...driverExperienceFields(d.expYears, d.expMonths),
              cdl: d.cdl,
              equip: d.equip,
              avail: d.avail,
              score: d.score,
              verified: d.verified,
              price: d.price,
              seller: d.seller,
              sellerRating: d.sellerRating,
              driverType: "Owner Operator",
              featured: false,
              createdAt: new Date().toISOString()
            });
          }
        }
      } catch {
        showToast("Could not load listing", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate, showToast]);

  const sign = async () => {
    if (!agreed || !signerName.trim() || !driver) return;
    setSubmitting(true);
    try {
      let dealId = `DL-DEMO-${driver.id}`;
      if (isSupabaseConfigured) {
        dealId = await startHiringProcess(driver.id, signerName.trim());
      }
      invalidateDataViews(["deals", "marketplace", "dashboard", "messages", "my-listings"]);
      await refreshWalletBalance();
      showToast("Agreement signed. Awaiting seller signature.", "success");
      navigate(`/deals/${dealId}`);
    } catch (e) {
      if (e instanceof ListingNotAvailableError) {
        showToast(e.message, "error");
        navigate("/marketplace", { replace: true });
      } else if (e instanceof PlatformLimitError) {
        showToast(e.message, "error");
      } else if (e instanceof WalletInsufficientError) {
        showToast(e.message, "error");
        openDepositModal();
      } else {
        showToast("Failed to start hiring process", "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="page active"><p className="t-secondary">Loading contract...</p></div>;
  }

  if (listingUnavailable) {
    return (
      <div className="page active">
        <p className="t-secondary">{unavailableReason}</p>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate("/marketplace")}>Back to Marketplace</button>
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="page active">
        <p className="t-secondary">Listing not found.</p>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate("/marketplace")}>Back to Marketplace</button>
      </div>
    );
  }

  return (
    <div className="page active contract-page">
      <div className="page-header inline">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate(`/driver/${driver.id}`)}>
          <ArrowLeft className="icon-sm" /> Back
        </button>
        <div>
          <h2>Recruiting Agreement</h2>
          <p className="t-secondary">Platform recruiting engagement — not a sale of a person</p>
        </div>
      </div>

      <div className="contract-layout">
        <div className="card contract-doc">
          <div className="card-header">
            <h3><FileSignature className="icon-md" /> CDL Exchange Recruiting Agreement</h3>
          </div>
          <div className="card-body contract-body">
            <section className="contract-section">
              <h4>Parties</h4>
              <p><strong>Recruiting company (Buyer):</strong> {sessionUser?.name ?? "Your company"}</p>
              <p><strong>Listing provider (Seller):</strong> {driver.seller}</p>
              <p><strong>Driver candidate:</strong> {fullName(driver)} · {driver.state} · {driver.cdl} · {driver.equip}</p>
            </section>

            <section className="contract-section">
              <h4>Platform Recruiting Fee</h4>
              <p>
                The recruiting fee for facilitating this introduction through CDL Exchange is{" "}
                <strong>{fmtRecruitingFee(driver.price)}</strong>. This fee compensates the platform and listing
                provider for recruiting coordination — not for the transfer of a person.
              </p>
            </section>

            <section className="contract-section">
              <h4>Availability</h4>
              <p>Target availability date: {fmtDate(driver.avail)}</p>
            </section>

            <section className="contract-section">
              <h4>Buyer responsibilities</h4>
              <ul>
                {BUYER_CONTRACT_CLAUSES.map((c) => <li key={c}>{c}</li>)}
              </ul>
            </section>

            <section className="contract-section">
              <h4>Escrow &amp; dispute protection</h4>
              <p className="t-secondary">
                Recruiting fees may be held in escrow until hiring milestones are confirmed. A 72-hour dispute
                window applies after key stage completions.
              </p>
            </section>

            <section className="contract-section">
              <h4>Next steps after signing</h4>
              <p className="t-secondary">
                After you sign, the seller must countersign their representation agreement. Once both parties
                sign, a dedicated hiring workspace opens with timeline tracking, messaging, and document sharing.
              </p>
            </section>
          </div>
        </div>

        <div className="card contract-sign">
          {sellerCompanyId ? (
            <div className="contract-reviews-block">
              <div className="card-header" style={{ borderBottom: "1px solid var(--border)" }}>
                <h3>Seller Reviews</h3>
              </div>
              <div className="card-body">
                <p className="t-caption t-secondary" style={{ marginBottom: 12 }}>
                  Review partner feedback before signing this recruiting agreement.
                </p>
                <CompanyReviewsPanel
                  companyId={sellerCompanyId}
                  compact
                  onViewAll={() => navigate(`/company/${sellerCompanyId}/reviews`)}
                />
              </div>
            </div>
          ) : null}
          <div className="card-header"><h3>Buyer Signature</h3></div>
          <div className="card-body">
            <p className="t-caption t-secondary" style={{ marginBottom: 12 }}>
              <ShieldCheck className="icon-sm" style={{ verticalAlign: -2 }} /> Signing as recruiting company
            </p>
            <div className="form-group">
              <label>Authorized signer name</label>
              <input value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="Your full name" />
            </div>
            <label className="filter-check" style={{ margin: "14px 0" }}>
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              I agree to the recruiting agreement and platform terms
            </label>
            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={!agreed || !signerName.trim() || submitting}
              onClick={() => void sign()}
            >
              {submitting ? "Signing..." : "Sign & Start Hiring Process"}
            </button>
            <p className="t-caption t-secondary" style={{ marginTop: 10 }}>
              {sessionUser?.companyId ? `Company ID: ${sessionUser.companyId.slice(0, 8)}…` : null}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
