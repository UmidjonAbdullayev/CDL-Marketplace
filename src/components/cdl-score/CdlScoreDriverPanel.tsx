import { ExternalLink, Shield, Sparkles } from "lucide-react";
import { ScoreBadge } from "../../lib/badges";
import { buildCdlScoreDriverSearchUrl, CDL_SCORE_APP_URL } from "../../lib/cdl-score-urls";
import { searchCreditsForPlan } from "../../lib/carrier-plans";
import { useApp } from "../../context/AppContext";

type Props = {
  driverFirst: string;
  driverLast: string;
  listingScore: "green" | "yellow" | "red";
  creditsAvailable?: number;
  onCreditsChange?: (credits: number) => void;
};

export function CdlScoreDriverPanel({
  driverFirst,
  driverLast,
  listingScore,
  creditsAvailable = 0
}: Props) {
  const { sessionUser, showToast } = useApp();

  const driverName = `${driverFirst} ${driverLast}`.trim();
  const creditsLeft = sessionUser?.cdlScoreCredits ?? creditsAvailable;
  const planCredits = searchCreditsForPlan(sessionUser?.selectedPlan ?? "free");
  const canSearch =
    sessionUser?.accountType === "carrier" &&
    (sessionUser.cdlScoreLinked || creditsLeft > 0);

  const openCdlScoreSearch = () => {
    if (creditsLeft <= 0) {
      showToast("No CDL Score search credits remaining", "error");
      return;
    }
    const url = buildCdlScoreDriverSearchUrl(driverName);
    window.open(url, "_blank", "noopener,noreferrer");
    showToast(`Opening CDL Score to search for ${driverName}`, "success");
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
            Open CDL Score to run an official safety lookup for <strong>{driverName}</strong>. Sign in with the same
            email and password you use on CDL Exchange.
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
          <span className="lbl">Plan allowance</span>
          <strong>{planCredits > 0 ? planCredits : "—"}</strong>
        </div>
        <div className="cdl-score-meta-item">
          <span className="lbl">CDL Score account</span>
          <strong>{sessionUser?.cdlScoreLinked ? "Linked" : "Not linked"}</strong>
        </div>
      </div>

      {!canSearch ? (
        <div className="cdl-score-panel-callout">
          <Sparkles className="icon-md" />
          <div>
            <strong>CDL Score search unavailable</strong>
            <p className="t-caption t-secondary">
              Carriers need a linked CDL Score account with search credits. Sign out and sign back in on CDL Exchange to
              sync your login, or register with the same email and password.
            </p>
            <a className="btn btn-ghost btn-sm" href={CDL_SCORE_APP_URL} target="_blank" rel="noopener noreferrer">
              Open CDL Score <ExternalLink className="icon-sm" />
            </a>
          </div>
        </div>
      ) : (
        <div className="cdl-score-panel-actions">
          <button
            type="button"
            className="btn btn-primary cdl-score-search-btn"
            disabled={creditsLeft <= 0}
            onClick={openCdlScoreSearch}
          >
            <ExternalLink className="icon-sm" /> Open CDL Score &amp; search driver
          </button>
          {creditsLeft <= 0 ? (
            <p className="t-caption t-secondary">No search credits remaining. Upgrade your carrier plan for more.</p>
          ) : (
            <p className="t-caption t-secondary">
              CDL Score opens in a new tab with this driver name ready to search. Use your Exchange login credentials.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
