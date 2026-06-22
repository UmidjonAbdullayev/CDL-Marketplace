import type { CarrierPlanId } from "../types/registration";

export type CarrierPlan = {
  id: CarrierPlanId;
  name: string;
  price: number;
  priceLabel: string;
  popular?: boolean;
  checkoutUrl?: string;
  activeHireLimit: number | null;
  features: { text: string; locked?: boolean }[];
};

export const WHOP_CHECKOUT_URLS: Record<Exclude<CarrierPlanId, "free">, string> = {
  starter: "https://whop.com/checkout/plan_Hd7cWWOAligH3",
  growth: "https://whop.com/checkout/plan_sC0f487bHYvw6",
  pro_fleet: "https://whop.com/checkout/plan_MQ7phleHfNYpU"
};

export function getWhopCheckoutUrl(plan: CarrierPlanId): string | null {
  if (plan === "free") return null;
  return WHOP_CHECKOUT_URLS[plan];
}

export function activeHireLimitForPlan(plan: CarrierPlanId | null | undefined): number | null {
  const p = CARRIER_PLANS.find((row) => row.id === (plan ?? "free"));
  return p?.activeHireLimit ?? 1;
}

export const CARRIER_PLANS: CarrierPlan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    priceLabel: "$0/mo",
    activeHireLimit: 1,
    features: [
      { text: "Browse marketplace preview" },
      { text: "View limited driver cards" },
      { text: "1 hire total (active or completed)" },
      { text: "Express interest", locked: true },
      { text: "Full CRM pipeline", locked: true },
      { text: "Full CDL Score details", locked: true }
    ]
  },
  {
    id: "starter",
    name: "Starter",
    price: 99,
    priceLabel: "$99/mo",
    checkoutUrl: WHOP_CHECKOUT_URLS.starter,
    activeHireLimit: 5,
    features: [
      { text: "Browse full marketplace" },
      { text: "Up to 5 active hires" },
      { text: "Basic CDL Score — overall rating" },
      { text: "Basic pipeline view" },
      { text: "Status tracking for active interests" }
    ]
  },
  {
    id: "growth",
    name: "Growth",
    price: 249,
    priceLabel: "$249/mo",
    popular: true,
    checkoutUrl: WHOP_CHECKOUT_URLS.growth,
    activeHireLimit: 15,
    features: [
      { text: "Up to 15 active hires" },
      { text: "Priority search placement" },
      { text: "Full CDL Score breakdown" },
      { text: "Past carrier comments & reviews" },
      { text: "Full CRM with saved lists, notes, tags" },
      { text: "Hire history & reminders" }
    ]
  },
  {
    id: "pro_fleet",
    name: "Pro / Fleet",
    price: 499,
    priceLabel: "$499/mo",
    checkoutUrl: WHOP_CHECKOUT_URLS.pro_fleet,
    activeHireLimit: null,
    features: [
      { text: "Unlimited active hires" },
      { text: "Dedicated rep & bulk export" },
      { text: "Full CDL Score + verification badges" },
      { text: "License, MVR, safety record & score trends" },
      { text: "Team seats & custom pipelines" },
      { text: "Analytics: time-to-hire & success rate" }
    ]
  }
];

export function carrierPlanLabel(plan: CarrierPlanId | null | undefined): string {
  return CARRIER_PLANS.find((p) => p.id === (plan ?? "free"))?.name ?? "Free";
}
