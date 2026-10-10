import { CARRIER_OFFERS_FIELD_LABELS } from "../../lib/carrier-offers";
import type { CarrierOffersRequirements } from "../../types/carrier-offers";
import { CarrierOffersIncompleteNote } from "./CarrierOffersBanner";

export function CarrierOffersSummary({
  offers,
  showIncompleteNote = true
}: {
  offers: CarrierOffersRequirements | null;
  showIncompleteNote?: boolean;
}) {
  if (!offers) {
    return showIncompleteNote ? <CarrierOffersIncompleteNote /> : <p className="t-secondary">No offers profile on file.</p>;
  }

  const rows: { label: string; value: string }[] = [];
  const add = (key: keyof CarrierOffersRequirements, label?: string) => {
    const v = offers[key];
    if (typeof v === "string" && v.trim()) rows.push({ label: label ?? CARRIER_OFFERS_FIELD_LABELS[key] ?? key, value: v });
    if (v === "yes" || v === "no") rows.push({ label: label ?? CARRIER_OFFERS_FIELD_LABELS[key] ?? key, value: v === "yes" ? "Yes" : "No" });
  };

  add("minDriverExperience");
  add("minDriverAge");
  if (offers.hireTaxType) rows.push({ label: "Hire type", value: offers.hireTaxType.toUpperCase() });
  add("driverPay");
  add("highestPaycheck6Months");
  add("timeOnRoadAndHome", "Home time");
  add("topMileagePerWeek");
  add("escrowDetails");
  add("transportationAccommodation");
  add("statesOrLanes", "Lanes / states");
  add("trailerTypes", "Equipment");
  add("truckYearMakeModelMileage");
  add("truckFeatures");
  add("providedItems");
  add("bonuses");
  add("dispatchFee");
  add("ownerOpFees");
  add("recruiterNotes", "Recruiter notes");

  const driverTypes: string[] = [];
  if (offers.lookingForCompanyDrivers) driverTypes.push("Company");
  if (offers.lookingForOwnerOperators) driverTypes.push("Owner op");
  if (offers.lookingForLeaseDrivers) driverTypes.push("Lease");
  if (offers.lookingForTeamDrivers) driverTypes.push("Team");
  if (driverTypes.length) rows.push({ label: "Driver types", value: driverTypes.join(", ") });

  for (const sec of offers.customSections ?? []) {
    if (sec.header.trim() && sec.body.trim()) rows.push({ label: sec.header.trim(), value: sec.body.trim() });
  }

  if (!rows.length) {
    return showIncompleteNote ? <CarrierOffersIncompleteNote /> : null;
  }

  return (
    <dl className="carrier-offers-summary">
      {rows.map((r) => (
        <div key={r.label} className="carrier-offers-summary-row">
          <dt>{r.label}</dt>
          <dd>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CarrierRequirementsSummary({ offers }: { offers: CarrierOffersRequirements | null }) {
  if (!offers) return null;
  const rows: { label: string; value: string }[] = [];
  const add = (key: keyof CarrierOffersRequirements) => {
    const v = offers[key];
    if (typeof v === "string" && v.trim()) rows.push({ label: CARRIER_OFFERS_FIELD_LABELS[key] ?? key, value: v });
    if (v === "yes" || v === "no") rows.push({ label: CARRIER_OFFERS_FIELD_LABELS[key] ?? key, value: v === "yes" ? "Yes" : "No" });
  };
  add("minAge");
  add("minCdlExperience");
  add("minOtrExperience");
  add("acceptedStates");
  add("maxPspViolations");
  add("maxPreventableAccidents");
  add("maxMovingViolations");
  add("drugTestHistory");
  add("sapAccepted");
  if (offers.feloniesPolicy) rows.push({ label: "Felonies", value: offers.feloniesPolicy.replace(/_/g, " ") });
  add("misdemeanorsPolicy");
  add("duiPolicy");
  add("manualTransmissionRequired");
  add("twicRequired");
  add("hazmatRequired");
  add("tankerRequired");
  add("passportRequired");

  if (!rows.length) return <p className="t-secondary">No structured requirements listed yet.</p>;

  return (
    <dl className="carrier-offers-summary">
      {rows.map((r) => (
        <div key={r.label} className="carrier-offers-summary-row">
          <dt>{r.label}</dt>
          <dd>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
