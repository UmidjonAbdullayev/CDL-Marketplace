import { Check } from "lucide-react";

const STEPS = [
  "Account Type",
  "Profile Details",
  "Plan / Permissions",
  "Policy Agreement",
  "Submit"
] as const;

type Props = {
  current: number;
};

export function RegistrationProgress({ current }: Props) {
  return (
    <div className="reg-progress">
      {STEPS.map((label, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div key={label} className={`reg-progress-step ${done ? "done" : ""} ${active ? "active" : ""}`}>
            <div className="reg-progress-dot">{done ? <Check className="icon-sm" /> : step}</div>
            <span className="reg-progress-label">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
