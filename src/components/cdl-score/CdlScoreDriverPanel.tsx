import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Search,
  Shield,
  Sparkles,
  TrendingUp
} from "lucide-react";
import { ScoreBadge } from "../../lib/badges";
import { CDL_SCORE_APP_URL } from "../../lib/cdl-score-urls";
import { useApp } from "../../context/AppContext";
import { searchDriverOnCdlScore, type CdlScoreDriverResult } from "../../services/cdlScore";

type Props = {
  driverFirst: string;
  driverLast: string;
  listingScore: "green" | "yellow" | "red";
  creditsAvailable?: number;
  onCreditsChange?: (credits: number) => void;
};

function flagLabel(flag: string): "green" | "yellow" | "red" {
  const f = flag?.toLowerCase();
  if (f === "green" || f === "yellow" || f === "red") return f;
  return "yellow";
}

export function CdlScoreDriverPanel({
  driverFirst,
  driverLast,
  listingScore,
  creditsAvailable = 0,
  onCreditsChange
}: Props) {
  const { sessionUser, showToast } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<CdlScoreDriverResult[] | null>(null);
  const [creditsLeft, setCreditsLeft] = useState(creditsAvailable);

  const driverName = `${driverFirst} ${driverLast}`.trim();
  const canSearch = sessionUser?.accountType === "carrier" && (sessionUser.cdlScoreLinked || creditsLeft > 0);

  const runSearch = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await searchDriverOnCdlScore(driverName);
      if (!response.success) {
        setError(response.error ?? "Could not pull CDL Score data");
        return;
      }
      setResults(response.drivers);
      setCreditsLeft(response.creditsLeft);
      onCreditsChange?.(response.creditsLeft);
      if (!response.drivers.length) {
        showToast("No CDL Score record found for this name", "error");
      } else {
        showToast("CDL Score report loaded", "success");
      }
    } catch {
      setError("CDL Score search failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="cdl-score-panel">
      <div className="cdl-score-panel-header">
        <div className="cdl-score-panel-icon">
          <Shield className="icon-lg" />
        </div>
        <div>
          <h4 className="cdl-score-panel-title">Pull driver data from CDL Score</h4>
          <p className="cdl-score-panel-sub">
            Run an official safety lookup for <strong>{driverName}</strong> using your CDL Score search credits.
          </p>
        </div>
      </div>

      <div className="cdl-score-panel-meta">
        <div className="cdl-score-meta-item">
          <span className="lbl">Listing flag</span>
          <ScoreBadge score={listingScore} />
        </div>
        <div className="cdl-score-meta-item">
          <span className="lbl">Search credits</span>
          <strong>{creditsLeft}</strong>
        </div>
        <div className="cdl-score-meta-item">
          <span className="lbl">CDL Score account</span>
          <strong>{sessionUser?.cdlScoreLinked ? "Linked" : "Not linked"}</strong>
        </div>
      </div>

      {!canSearch ? (
        <div className="cdl-score-panel-callout">
          <AlertCircle className="icon-md" />
          <div>
            <strong>CDL Score search unavailable</strong>
            <p className="t-caption t-secondary">
              Carriers need a linked CDL Score account with search credits. Register on CDL Exchange with the same
              email and password — your plan credits sync automatically.
            </p>
            <a className="btn btn-ghost btn-sm" href={CDL_SCORE_APP_URL} target="_blank" rel="noopener noreferrer">
              Open CDL Score <ExternalLink className="icon-sm" />
            </a>
          </div>
        </div>
      ) : (
        <div className="cdl-score-panel-actions">
          <button type="button" className="btn btn-primary cdl-score-search-btn" disabled={loading || creditsLeft <= 0} onClick={() => void runSearch()}>
            {loading ? (
              <><Loader2 className="icon-sm spin" /> Searching CDL Score...</>
            ) : (
              <><Search className="icon-sm" /> Pull CDL Score report (1 credit)</>
            )}
          </button>
          {creditsLeft <= 0 ? (
            <p className="t-caption t-secondary">No search credits remaining. Upgrade your carrier plan for more.</p>
          ) : null}
        </div>
      )}

      {error ? <p className="field-error cdl-score-panel-error">{error}</p> : null}

      {results?.length ? (
        <div className="cdl-score-results">
          {results.map((row) => (
            <article key={row.id} className="cdl-score-result-card">
              <div className="cdl-score-result-top">
                <div>
                  <h5>{row.full_name}</h5>
                  <div className="cdl-score-result-badges">
                    <ScoreBadge score={flagLabel(row.flag)} />
                    <span className="badge badge-blue"><Sparkles className="icon-sm" /> {row.stars?.toFixed?.(1) ?? row.stars} stars</span>
                  </div>
                </div>
                <div className="cdl-score-score-ring">
                  <span className="cdl-score-score-value">{row.score}</span>
                  <span className="t-caption">CDL Score</span>
                </div>
              </div>
              <div className="cdl-score-metrics">
                <div><TrendingUp className="icon-sm" /><span>Reliability</span><strong>{row.reliability_pct}%</strong></div>
                <div><CheckCircle2 className="icon-sm" /><span>Drug tests</span><strong>{row.drug_test_pct}%</strong></div>
                <div><CheckCircle2 className="icon-sm" /><span>On-time</span><strong>{row.on_time_pct}%</strong></div>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {!results && !loading && canSearch ? (
        <p className="cdl-score-panel-footnote t-caption t-secondary">
          MVR, PSP, and safety event history are included in the full CDL Score profile after a successful match.
        </p>
      ) : null}
    </section>
  );
}
