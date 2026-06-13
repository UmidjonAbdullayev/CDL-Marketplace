import type { CarrierPlanId } from "../types/registration";

export type CarrierPlan = {
  id: CarrierPlanId;
  name: string;
  price: number;
  priceLabel: string;
  popular?: boolean;
  features: { text: string; locked?: boolean }[];
};

export const CARRIER_PLANS: CarrierPlan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    priceLabel: "$0/mo",
    features: [
      { text: "Browse marketplace preview" },
      { text: "View limited driver cards" },
      { text: "Start hiring process", locked: true },
      { text: "Express interest", locked: true },
      { text: "Unlock contact", locked: true },
      { text: "CRM pipeline", locked: true },
      { text: "Full CDL Score details", locked: true }
    ]
  },
  {
    id: "starter",
    name: "Starter",
    price: 99,
    priceLabel: "$99/mo",
    features: [
      { text: "Browse full marketplace" },
      { text: "Up to 5 active hires per month" },
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
    features: [
      { text: "Up to 15 active interests per month" },
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
    features: [
      { text: "Unlimited hires" },
      { text: "Dedicated rep & bulk export" },
      { text: "Full CDL Score + verification badges" },
      { text: "License, MVR, safety record & score trends" },
      { text: "Team seats & custom pipelines" },
      { text: "Analytics: time-to-hire & success rate" }
    ]
  }
];
