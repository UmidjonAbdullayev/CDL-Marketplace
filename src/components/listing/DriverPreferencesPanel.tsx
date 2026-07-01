import { DollarSign, Home, Percent, Sparkles } from "lucide-react";
import type { DriverPreferences } from "../../lib/driver-preferences";
import { driverPreferencesSummary, isOwnerStyleDriverType } from "../../lib/driver-preferences";

type Props = {
  preferences: Partial<DriverPreferences>;
  driverType?: string;
  compact?: boolean;
};

export function DriverPreferencesPanel({ preferences, driverType, compact = false }: Props) {
  const summary = driverPreferencesSummary(preferences);
  const hasDetail =
    Boolean(preferences.desiredWeeklyPay?.trim()) ||
    Boolean(preferences.weeksOutPreference?.trim()) ||
    Boolean(preferences.companyExpectations?.trim()) ||
    (preferences.maxDispatchFeePct != null && preferences.maxDispatchFeePct > 0);

  if (!hasDetail) {
    return compact ? null : (
      <div className="driver-preferences-panel driver-preferences-panel--empty t-secondary t-caption">
        Driver preferences not listed yet.
      </div>
    );
  }

  if (compact) {
    if (!summary.length) return null;
    return (
      <div className="driver-preferences-snippet">
        <Sparkles className="icon-sm" aria-hidden />
        <span>{summary.slice(0, 2).join(" · ")}</span>
      </div>
    );
  }

  return (
    <div className="driver-preferences-panel card">
      <div className="card-header"><h3>Driver Preferences</h3></div>
      <div className="card-body driver-preferences-grid">
        {preferences.desiredWeeklyPay?.trim() ? (
          <div className="driver-pref-item">
            <DollarSign className="icon-sm driver-pref-icon" aria-hidden />
            <div>
              <div className="lbl">Target pay</div>
              <div className="val">{preferences.desiredWeeklyPay}</div>
            </div>
          </div>
        ) : null}
        {preferences.weeksOutPreference?.trim() ? (
          <div className="driver-pref-item">
            <Home className="icon-sm driver-pref-icon" aria-hidden />
            <div>
              <div className="lbl">Home time / weeks out</div>
              <div className="val">{preferences.weeksOutPreference}</div>
            </div>
          </div>
        ) : null}
        {driverType && isOwnerStyleDriverType(driverType) && preferences.maxDispatchFeePct != null && preferences.maxDispatchFeePct > 0 ? (
          <div className="driver-pref-item">
            <Percent className="icon-sm driver-pref-icon" aria-hidden />
            <div>
              <div className="lbl">Max dispatch fee</div>
              <div className="val">{preferences.maxDispatchFeePct}%</div>
            </div>
          </div>
        ) : null}
        {preferences.companyExpectations?.trim() ? (
          <div className="driver-pref-item driver-pref-item--wide">
            <div className="lbl">What they want from a company</div>
            <div className="val t-secondary">{preferences.companyExpectations}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
