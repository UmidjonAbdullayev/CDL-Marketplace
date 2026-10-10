import { useEffect, useState } from "react";
import { CheckCircle2, Star } from "lucide-react";
import { StarRatingInput } from "./StarRatingInput";
import { ReviewStars } from "../../lib/badges";
import { fmtDate } from "../../lib/format";
import {
  fetchDealReviewContext,
  submitDealReview,
  type DealReviewContext
} from "../../services/reviews";

type Props = {
  dealId: string;
  myCompanyId: string;
  onSubmitted?: () => void;
};

export function DealReviewPanel({ dealId, myCompanyId, onSubmitted }: Props) {
  const [ctx, setCtx] = useState<DealReviewContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [partnerRating, setPartnerRating] = useState(0);
  const [driverRating, setDriverRating] = useState(0);
  const [partnerComment, setPartnerComment] = useState("");
  const [driverComment, setDriverComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchDealReviewContext(dealId, myCompanyId);
      setCtx(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [dealId, myCompanyId]);

  if (loading) {
    return <p className="t-secondary">Loading review panel…</p>;
  }

  if (!ctx?.canReview) {
    return null;
  }

  const partnerLabel = ctx.myRole === "buyer" ? "Recruiter / agency" : "Carrier";
  const partnerCommentLabel =
    ctx.myRole === "buyer"
      ? `Comments about ${ctx.counterpartyName} (recruiter)`
      : `Comments about ${ctx.counterpartyName} (carrier)`;
  const driverCommentLabel = `Comments about ${ctx.driverName} (driver)`;

  if (ctx.myReview) {
    return (
      <div className="deal-review-panel deal-review-panel--submitted card">
        <div className="card-body">
          <div className="deal-review-panel-head">
            <CheckCircle2 className="icon-md" style={{ color: "var(--success)" }} />
            <div>
              <strong>Your review was submitted</strong>
              <p className="t-caption t-secondary">Thanks for rating this completed deal.</p>
            </div>
          </div>
          <div className="deal-review-submitted-grid">
            <div>
              <span className="t-caption t-secondary">{partnerLabel}</span>
              <ReviewStars filled={ctx.myReview.rating} />
              <p>{ctx.myReview.body}</p>
            </div>
            {ctx.myReview.driver_rating ? (
              <div>
                <span className="t-caption t-secondary">Driver — {ctx.driverName}</span>
                <ReviewStars filled={ctx.myReview.driver_rating} />
                <p>{ctx.myReview.driver_comment}</p>
              </div>
            ) : null}
          </div>
          <p className="t-caption t-secondary">Submitted {fmtDate(ctx.myReview.created_at)}</p>
          {ctx.counterpartyHasReviewed ? (
            <p className="t-caption t-secondary" style={{ marginTop: 8 }}>
              {ctx.counterpartyName} has also left a review for this deal.
            </p>
          ) : (
            <p className="t-caption t-secondary" style={{ marginTop: 8 }}>
              Waiting for {ctx.counterpartyName} to submit their review.
            </p>
          )}
        </div>
      </div>
    );
  }

  const submit = async () => {
    setError("");
    if (partnerRating < 1) {
      setError(`Please rate the ${partnerLabel.toLowerCase()} with stars.`);
      return;
    }
    if (!partnerComment.trim()) {
      setError(`Please add comments about the ${partnerLabel.toLowerCase()}.`);
      return;
    }
    if (driverRating < 1) {
      setError("Please rate the driver with stars.");
      return;
    }
    if (!driverComment.trim()) {
      setError("Please add comments about the driver.");
      return;
    }

    setSubmitting(true);
    try {
      await submitDealReview({
        dealId,
        reviewedCompanyId: ctx.counterpartyCompanyId,
        partnerRating,
        partnerComment: partnerComment.trim(),
        driverRating,
        driverComment: driverComment.trim(),
        partnerTitle: `${partnerLabel} review — Deal ${dealId}`
      });
      await load();
      onSubmitted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="deal-review-panel card">
      <div className="card-header deal-review-panel-header">
        <h3><Star className="icon-sm" /> Rate this completed deal</h3>
      </div>
      <div className="card-body">
        <p className="t-secondary" style={{ marginBottom: 16, fontSize: 13 }}>
          This deal is complete. Share star ratings and comments about {ctx.counterpartyName} and driver{" "}
          {ctx.driverName}. Reviews help build trust on the marketplace.
        </p>

        <div className="deal-review-form-section">
          <h4 className="deal-review-section-title">{partnerLabel}: {ctx.counterpartyName}</h4>
          <StarRatingInput
            label={`Rate ${partnerLabel.toLowerCase()}`}
            value={partnerRating}
            onChange={setPartnerRating}
            disabled={submitting}
          />
          <div className="form-group">
            <label>{partnerCommentLabel}</label>
            <textarea
              rows={3}
              value={partnerComment}
              disabled={submitting}
              placeholder={
                ctx.myRole === "buyer"
                  ? "How was the recruiter's communication, lead quality, and professionalism?"
                  : "How was the carrier to work with on this placement?"
              }
              onChange={(e) => setPartnerComment(e.target.value)}
            />
          </div>
        </div>

        <div className="deal-review-form-section">
          <h4 className="deal-review-section-title">Driver: {ctx.driverName}</h4>
          <StarRatingInput
            label="Rate driver"
            value={driverRating}
            onChange={setDriverRating}
            disabled={submitting}
          />
          <div className="form-group">
            <label>{driverCommentLabel}</label>
            <textarea
              rows={3}
              value={driverComment}
              disabled={submitting}
              placeholder={
                ctx.myRole === "buyer"
                  ? "Was the driver qualified, responsive, and as described in the listing?"
                  : "How did this driver perform through screening and placement?"
              }
              onChange={(e) => setDriverComment(e.target.value)}
            />
          </div>
        </div>

        {error ? <p className="field-error" style={{ marginBottom: 12 }}>{error}</p> : null}

        <button type="button" className="btn btn-primary" disabled={submitting} onClick={() => void submit()}>
          {submitting ? "Submitting review…" : "Submit review"}
        </button>
      </div>
    </div>
  );
}
