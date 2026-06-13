export const HIRING_STAGES = [
  { key: "contract", label: "Contract Signed", desc: "Both parties agree to platform terms" },
  { key: "screening", label: "Screening", desc: "Initial qualification and fit review" },
  { key: "interview", label: "Interview", desc: "Buyer interviews the driver candidate" },
  { key: "orientation", label: "Orientation", desc: "Onboarding and orientation scheduled" },
  { key: "hired", label: "Hired", desc: "Driver confirmed for employment" },
  { key: "completed", label: "Completed", desc: "Hiring process closed successfully" }
] as const;

export type HiringStage = (typeof HIRING_STAGES)[number]["key"];

export const ONGOING_DEAL_STATUSES = [
  "Contract Pending",
  "Awaiting Seller Signature",
  "Hiring Active",
  "Contact Released",
  "Orientation Scheduled",
  "Hired Confirmed",
  "Pending Payment",
  "Reserved"
] as const;

export const BUYER_CONTRACT_CLAUSES = [
  "I am initiating a driver recruiting engagement through CDL Exchange, not purchasing ownership of any person.",
  "I agree to pay the stated platform recruiting fee upon successful contract execution.",
  "I will use driver information only for legitimate recruiting and hiring purposes.",
  "I will comply with FMCSA, DOT, and applicable employment laws during the hiring process.",
  "I understand CDL Exchange facilitates introductions and does not guarantee hire outcomes."
];

export const SELLER_CONTRACT_CLAUSES = [
  "I confirm this driver listing is accurate and the candidate has consented to be represented.",
  "I accept responsibility for the accuracy of credentials, availability, and documentation provided.",
  "I will cooperate in good faith with the buyer throughout the hiring process.",
  "I understand the platform recruiting fee is earned when hiring milestones are met per platform policy.",
  "I will not misrepresent driver qualifications, experience, or employment status."
];

export function stageIndex(stage: string): number {
  const idx = HIRING_STAGES.findIndex((s) => s.key === stage);
  return idx >= 0 ? idx : 0;
}

export function statusBadgeClass(status: string): string {
  if (status.includes("Contract") || status.includes("Awaiting")) return "badge-yellow";
  if (status === "Hiring Active" || status === "Contact Released") return "badge-blue";
  if (status === "Orientation Scheduled") return "badge-purple";
  if (status === "Hired Confirmed") return "badge-green";
  if (status === "Completed") return "badge-gray";
  if (status === "Disputed") return "badge-red";
  return "badge-gray";
}
