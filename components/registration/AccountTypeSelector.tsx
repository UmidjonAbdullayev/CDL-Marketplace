import { Building2, Truck, UserRound } from "lucide-react";
import type { AccountType } from "../../types/registration";

const OPTIONS: { type: AccountType; label: string; desc: string; icon: typeof Truck }[] = [
  {
    type: "carrier",
    label: "Carrier",
    desc: "Trucking companies hiring CDL drivers through the marketplace",
    icon: Truck
  },
  {
    type: "agency",
    label: "Recruiting Agency",
    desc: "Agencies listing and providing consent-verified driver leads",
    icon: Building2
  },
  {
    type: "solo_recruiter",
    label: "Solo Recruiter",
    desc: "Independent recruiters working individual driver placements",
    icon: UserRound
  }
];

type Props = {
  value: AccountType | null;
  onChange: (type: AccountType) => void;
};

export function AccountTypeSelector({ value, onChange }: Props) {
  return (
    <div className="account-type-grid">
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.type;
        return (
          <button
            key={opt.type}
            type="button"
            className={`account-type-card ${active ? "active" : ""}`}
            onClick={() => onChange(opt.type)}
          >
            <div className="account-type-icon"><Icon className="icon-lg" /></div>
            <div className="account-type-label">{opt.label}</div>
            <div className="account-type-desc">{opt.desc}</div>
          </button>
        );
      })}
    </div>
  );
}
