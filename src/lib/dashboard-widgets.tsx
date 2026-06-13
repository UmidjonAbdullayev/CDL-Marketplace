import type { ReactNode } from "react";
import {
  FilePlus,
  Flame,
  Handshake,
  MessageCircle,
  Phone,
  ShoppingCart,
  UserPlus
} from "lucide-react";
import type { HotListing } from "../types";
import { fmtPrice } from "./format";
import { StarRating, VerifiedIcon } from "./badges";

export function SnapshotMetric({
  iconCls,
  icon,
  label,
  value,
  subtext,
  subCls = "neutral"
}: {
  iconCls: string;
  icon: ReactNode;
  label: string;
  value: string;
  subtext: string;
  subCls?: "up" | "down" | "neutral" | "warn";
}) {
  return (
    <div className="snapshot-metric">
      <div className={`snapshot-metric-icon stat-icon ${iconCls}`}>{icon}</div>
      <div className="snapshot-metric-body">
        <div className="snapshot-metric-label">{label}</div>
        <div className="snapshot-metric-value">{value}</div>
        <div className={`snapshot-metric-sub ${subCls}`}>{subtext}</div>
      </div>
    </div>
  );
}

export function QuickActionBtn({
  iconCls,
  icon,
  label,
  onClick
}: {
  iconCls: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="quick-action-btn" onClick={onClick}>
      <div className={`quick-action-icon ${iconCls}`}>{icon}</div>
      <span>{label}</span>
    </button>
  );
}

const ACTIVITY_ICONS = {
  sale: ShoppingCart,
  list: FilePlus,
  deal: Handshake,
  user: UserPlus
} as const;

export function ActivityFeedItem({
  type,
  title,
  desc,
  time,
  status,
  statusCls
}: {
  type: keyof typeof ACTIVITY_ICONS;
  title: string;
  desc: string;
  time: string;
  status: string;
  statusCls: string;
}) {
  const Icon = ACTIVITY_ICONS[type];
  return (
    <div className="activity-feed-item">
      <div className="activity-feed-main">
        <div className={`activity-feed-icon ${type}`}><Icon /></div>
        <div className="activity-feed-body">
          <div className="activity-feed-title">{title}</div>
          <div className="activity-feed-desc">{desc}</div>
          <div className="activity-feed-time">{time}</div>
        </div>
      </div>
      <span className="activity-feed-status">
        <span className={`activity-status ${statusCls}`}>{status}</span>
      </span>
    </div>
  );
}

export function CategoryRow({
  name,
  listings,
  avg,
  pct,
  cls
}: {
  name: string;
  listings: string;
  avg: string;
  pct: number;
  cls: string;
}) {
  return (
    <div className="category-row">
      <div className="category-name">{name}</div>
      <div className="category-meta">
        <span>{listings} listings</span>
        <span>{avg} avg</span>
      </div>
      <div className="category-bar-wrap">
        <div className="category-bar"><span className={cls} style={{ width: `${pct}%` }} /></div>
        <span className="category-bar-pct">{pct}%</span>
      </div>
    </div>
  );
}

export function HotListingRow({ item, onClick }: { item: HotListing; onClick: () => void }) {
  const scoreCls = item.score >= 90 ? "" : " mid";
  return (
    <div className="hot-listing-row" role="button" tabIndex={0} onClick={onClick}>
      <div className="hot-listing-name">
        {item.name}
        {item.hot ? <span className="hot-listing-hot"><Flame /></span> : null}
      </div>
      <div className="hot-listing-meta">{item.exp}</div>
      <div className="hot-listing-meta">{item.state}</div>
      <div className="hot-listing-meta">{item.route}</div>
      <div className="hot-listing-trailer">{item.trailer}</div>
      <div className={`hot-listing-score${scoreCls}`}>{item.score}</div>
      <div className="hot-listing-price">{fmtPrice(item.price)}</div>
    </div>
  );
}

export function SellerListItem({
  rank,
  rankCls = "",
  initials,
  name,
  rating,
  sold,
  rate,
  onViewReviews
}: {
  rank: string;
  rankCls?: string;
  initials: string;
  name: string;
  rating: string;
  sold: string;
  rate: string;
  onViewReviews: () => void;
}) {
  return (
    <div className="dash-list-item">
      <div className={`seller-rank ${rankCls}`}>{rank}</div>
      <div className="seller-avatar">{initials}</div>
      <div className="seller-info">
        <div className="name">{name}<VerifiedIcon /></div>
        <div className="meta"><StarRating rating={rating} /> · {sold} sold · {rate}</div>
      </div>
      <button type="button" className="btn btn-ghost btn-sm seller-reviews-btn" onClick={onViewReviews}>View Reviews</button>
    </div>
  );
}

export function ActionListItem({
  initials,
  color,
  name,
  detail,
  time,
  urgency,
  onOpen
}: {
  initials: string;
  color: string;
  name: string;
  detail: string;
  time: string;
  urgency: "overdue" | "today" | "soon" | "info";
  onOpen: () => void;
}) {
  return (
    <button type="button" className={`dash-list-item action-item urgency-${urgency}`} onClick={onOpen}>
      <div className="followup-avatar" style={{ background: color }}>{initials}</div>
      <div className="seller-info" style={{ textAlign: "left" }}>
        <div className="name">{name}</div>
        <div className="meta">{detail}</div>
      </div>
      <div className="dash-list-end">
        <span className={`action-time-pill urgency-${urgency}`}>{time}</span>
      </div>
    </button>
  );
}

export function FollowupListItem({
  initials,
  color,
  name,
  detail,
  time,
  onCall,
  onMessage
}: {
  initials: string;
  color: string;
  name: string;
  detail: string;
  time: string;
  onCall: () => void;
  onMessage: () => void;
}) {
  return (
    <div className="dash-list-item">
      <div className="followup-avatar" style={{ background: color }}>{initials}</div>
      <div className="seller-info">
        <div className="name">{name}</div>
        <div className="meta">{detail}</div>
      </div>
      <div className="dash-list-end">
        <span className="followup-time-pill">{time}</span>
        <div className="followup-actions">
          <button type="button" onClick={onCall} title="Call" aria-label="Call"><Phone /></button>
          <button type="button" onClick={onMessage} title="Message" aria-label="Message"><MessageCircle /></button>
        </div>
      </div>
    </div>
  );
}
