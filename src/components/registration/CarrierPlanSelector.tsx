import { Check, Lock } from "lucide-react";
import { CARRIER_PLANS } from "../../lib/carrier-plans";
import type { CarrierPlanId } from "../../types/registration";

type Props = {
  value: CarrierPlanId;
  onChange: (plan: CarrierPlanId) => void;
};

export function CarrierPlanSelector({ value, onChange }: Props) {
  return (
    <div className="carrier-plan-grid">
      {CARRIER_PLANS.map((plan) => (
        <button
          key={plan.id}
          type="button"
          className={`carrier-plan-card ${value === plan.id ? "selected" : ""} ${plan.popular ? "popular" : ""}`}
          onClick={() => onChange(plan.id)}
        >
          {plan.popular ? <span className="carrier-plan-badge">Most Popular</span> : null}
          <h4>{plan.name}</h4>
          <div className="carrier-plan-price">{plan.priceLabel}</div>
          <ul>
            {plan.features.map((f) => (
              <li key={f.text} className={f.locked ? "locked" : ""}>
                {f.locked ? <Lock className="icon-sm" /> : <Check className="icon-sm" />}
                {f.text}
              </li>
            ))}
          </ul>
        </button>
      ))}
    </div>
  );
}
