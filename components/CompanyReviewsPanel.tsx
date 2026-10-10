import { useEffect, useState } from "react";
import { ReviewStars, StarRating } from "../lib/badges";
import { fmtDate } from "../lib/format";
import {
  companyTypeLabel,
  fetchCompanyReviewSummary,
  type CompanyReviewSummary
} from "../services/reviews";

type Props = {
  companyId: string;
  compact?: boolean;
  onViewAll?: () => void;
};

export function CompanyReviewsPanel({ companyId, compact = false, onViewAll }: Props) {
  const [summary, setSummary] = useState<CompanyReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void fetchCompanyReviewSummary(companyId)
      .then((data) => {
        if (active) setSummary(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [companyId]);

  if (loading) {
    return <p className="t-secondary">Loading reviews…</p>;
  }

  if (!summary) {
    return <p className="t-secondary">Company profile not found.</p>;
  }

  const visible = compact ? summary.reviews.slice(0, 3) : summary.reviews;

  return (
    <div className="company-reviews-panel">
      <div className="company-reviews-head">
        <div>
          <strong>{summary.companyName}</strong>
          <span className="t-caption t-secondary"> · {companyTypeLabel(summary.companyType)}</span>
        </div>
        <div className="company-reviews-rating">
          <StarRating rating={String(summary.rating)} />
          <span className="t-caption t-secondary">
            {summary.reviewCount ? `${summary.rating} · ${summary.reviewCount} review${summary.reviewCount === 1 ? "" : "s"}` : "No reviews yet"}
          </span>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="t-secondary company-reviews-empty">No partner reviews yet. Reviews appear after completed deals.</p>
      ) : (
        <div className="company-reviews-list">
          {visible.map((r) => (
            <article key={r.id} className="company-review-item">
              <div className="company-review-top">
                <StarRating rating={String(r.rating)} />
                <span className="t-caption t-secondary">{fmtDate(r.created_at)}</span>
              </div>
              {r.title ? <strong>{r.title}</strong> : null}
              <p>{r.body}</p>
              {r.driver_rating && r.driver_comment ? (
                <p className="t-caption" style={{ marginTop: 8 }}>
                  <strong>Driver feedback:</strong> <ReviewStars filled={r.driver_rating} /> — {r.driver_comment}
                </p>
              ) : null}
              <span className="t-caption t-secondary">
                {r.reviewer_name} · {companyTypeLabel(r.reviewer_type)}
                {r.deal_id ? ` · Deal ${r.deal_id}` : ""}
              </span>
            </article>
          ))}
        </div>
      )}

      {compact && onViewAll ? (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onViewAll}>View all reviews</button>
      ) : null}
    </div>
  );
}
