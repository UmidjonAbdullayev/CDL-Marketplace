import type { ReactNode } from "react";
import {
  AlertCircle,
  AlertTriangle,
  BadgeCheck,
  Ban,
  BarChart3,
  CalendarOff,
  CheckCircle2,
  ClipboardList,
  Lock,
  Search,
  ShieldCheck,
  Star,
  UserCheck
} from "lucide-react";
import type { ScoreFlag as ScoreFlagType } from "../types";

const SCORE_MAP: Record<ScoreFlagType, { badgeClass: string; text: string; icon: ReactNode }> = {
  green: { badgeClass: "badge-green", text: "Good", icon: <CheckCircle2 className="icon-sm" /> },
  yellow: { badgeClass: "badge-yellow", text: "Review", icon: <AlertCircle className="icon-sm" /> },
  red: { badgeClass: "badge-red", text: "Flagged", icon: <AlertTriangle className="icon-sm" /> }
};

const COMPLIANCE_ICON_MAP = {
  "user-check": UserCheck,
  lock: Lock,
  ban: Ban,
  "calendar-off": CalendarOff,
  "clipboard-list": ClipboardList,
  search: Search,
  "alert-triangle": AlertTriangle,
  "bar-chart-3": BarChart3
} as const;

export function ScoreBadge({ score }: { score: ScoreFlagType }) {
  const cfg = SCORE_MAP[score] ?? SCORE_MAP.yellow;
  return (
    <span className={`badge ${cfg.badgeClass}`}>
      {cfg.icon} {cfg.text}
    </span>
  );
}

export function ScoreFlag({ score }: { score: ScoreFlagType }) {
  const cfg = SCORE_MAP[score] ?? SCORE_MAP.yellow;
  return <span className={`score-flag ${score}`}>{cfg.icon}{cfg.text}</span>;
}

export function VerifiedIcon() {
  return (
    <span className="verified-mini" title="Verified">
      <ShieldCheck className="icon-sm" />
    </span>
  );
}

export function VerifiedBadge({ text = "Verified" }: { text?: string }) {
  return (
    <span className="badge badge-blue">
      <BadgeCheck className="icon-sm" /> {text}
    </span>
  );
}

export function StarRating({ rating }: { rating: number | string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--s1)" }}>
      <Star className="icon-sm" style={{ color: "var(--warning)" }} />
      <span>{rating}</span>
    </span>
  );
}

export function ReviewStars({ filled }: { filled: number }) {
  return (
    <span className="review-stars">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className="icon-sm"
          style={{ color: i <= filled ? "var(--warning)" : "var(--border)" }}
        />
      ))}
    </span>
  );
}

export function PageHeader({
  title,
  desc,
  inline = false,
  centered = false,
  row = false,
  actions
}: {
  title: string;
  desc?: string;
  inline?: boolean;
  centered?: boolean;
  row?: boolean;
  actions?: ReactNode;
}) {
  const cls = ["page-header", inline ? "inline" : "", centered ? "centered" : "", row ? "row" : ""].filter(Boolean).join(" ");
  if (row) {
    return (
      <div className={cls}>
        <div className="page-header-text">
          <h2>{title}</h2>
          {desc ? <p>{desc}</p> : null}
        </div>
        {actions}
      </div>
    );
  }
  return (
    <div className={cls}>
      <h2>{title}</h2>
      {desc ? <p>{desc}</p> : null}
    </div>
  );
}

export function ComplianceCard({
  icon,
  title,
  text
}: {
  icon: keyof typeof COMPLIANCE_ICON_MAP;
  title: string;
  text: string;
}) {
  const Icon = COMPLIANCE_ICON_MAP[icon];
  return (
    <div className="card compliance-item">
      <div className="compliance-icon">
        <Icon />
      </div>
      <h4 className="t-card">{title}</h4>
      <p className="t-secondary">{text}</p>
    </div>
  );
}

export function SellBar({ pct, cls }: { pct: number; cls: "high" | "mid" | "low" }) {
  const badge = cls === "high" ? "green" : cls === "mid" ? "blue" : "yellow";
  return (
    <div className="sell-bar">
      <div className="sell-bar-track">
        <div className={`sell-bar-fill ${cls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`badge badge-${badge}`}>{pct}%</span>
    </div>
  );
}
