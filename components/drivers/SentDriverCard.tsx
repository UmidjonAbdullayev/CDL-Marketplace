import { Building2, Clock, Eye, MapPin, Truck, User } from "lucide-react";
import { submissionStatusBadgeClass, submissionStatusLabel } from "../../lib/driver-submissions";
import { fmtDate } from "../../lib/format";
import type { DriverSubmissionListItem } from "../../services/driverSubmissions";

type SentDriverCardProps = {
  item: DriverSubmissionListItem;
  variant: "recruiter" | "carrier";
  onClick: () => void;
};

function maskName(first: string, last: string) {
  return `${first} ${last.charAt(0)}.`;
}

function viewedLabel(iso: string | null | undefined): string {
  if (!iso) return "Not opened yet";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 3600000) return `Viewed ${Math.max(1, Math.floor(diff / 60000))}m ago`;
  if (diff < 86400000) return `Viewed ${Math.floor(diff / 3600000)}h ago`;
  return `Viewed ${fmtDate(iso)}`;
}

export function SentDriverCard({ item, variant, onClick }: SentDriverCardProps) {
  const partyName = variant === "recruiter" ? item.carrier_name : item.recruiter_name;
  const partyLabel = variant === "recruiter" ? "Sent to" : "From recruiter";

  return (
    <button type="button" className="sent-driver-card card" onClick={onClick}>
      <div className="sent-driver-card-top">
        <div className="sent-driver-card-avatar"><User className="icon-md" /></div>
        <div className="sent-driver-card-head">
          <h4>{maskName(item.driver_first_name, item.driver_last_name)}</h4>
          <div className="sent-driver-card-meta t-caption t-secondary">
            <span><MapPin className="icon-sm" /> {item.driver_state}</span>
            <span><Truck className="icon-sm" /> {item.driver_equipment}</span>
          </div>
        </div>
        <span className={`badge ${submissionStatusBadgeClass(item.status)}`}>
          {submissionStatusLabel(item.status)}
        </span>
      </div>

      <div className="sent-driver-card-party">
        <Building2 className="icon-sm" />
        <span className="t-caption">{partyLabel}: <strong>{partyName}</strong></span>
      </div>

      {item.status_comment ? (
        <p className="sent-driver-card-note t-caption t-secondary">{item.status_comment}</p>
      ) : null}

      <div className="sent-driver-card-foot">
        {variant === "recruiter" ? (
          <span className="sent-driver-card-viewed">
            <Eye className="icon-sm" />
            {item.carrier_last_viewed_at
              ? `Carrier last opened case ${viewedLabel(item.carrier_last_viewed_at).replace("Viewed ", "")}`
              : "Carrier has not opened this case yet"}
          </span>
        ) : (
          <span className="sent-driver-card-viewed t-caption t-secondary">
            Sent {fmtDate(item.created_at)}
          </span>
        )}
        <span className="t-caption t-secondary">
          <Clock className="icon-sm" /> Updated {fmtDate(item.updated_at)}
        </span>
      </div>
    </button>
  );
}
