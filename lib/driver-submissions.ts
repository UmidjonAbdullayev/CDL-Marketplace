export type DriverSubmissionStatus =
  | "opened"
  | "contacted"
  | "mvr_checking"
  | "mvr_cleared"
  | "interview_scheduled"
  | "orientation_scheduled"
  | "flight_ticket_bought"
  | "hired"
  | "refused"
  | "withdrawn";

export type DriverSubmissionStage = {
  key: DriverSubmissionStatus;
  label: string;
  desc: string;
};

export const DRIVER_SUBMISSION_STAGES: DriverSubmissionStage[] = [
  { key: "opened", label: "Opened", desc: "Driver profile sent to carrier" },
  { key: "contacted", label: "Contacted", desc: "Carrier reached out to the driver" },
  { key: "mvr_checking", label: "MVR Checking", desc: "Motor vehicle record under review" },
  { key: "mvr_cleared", label: "MVR Cleared", desc: "Background and MVR passed" },
  { key: "interview_scheduled", label: "Interview Scheduled", desc: "Driver interview booked" },
  { key: "orientation_scheduled", label: "Orientation", desc: "Orientation or road test scheduled" },
  { key: "flight_ticket_bought", label: "Flight Ticket Bought", desc: "Travel arranged for orientation" },
  { key: "hired", label: "Hired", desc: "Driver accepted and hired" },
  { key: "refused", label: "Refused", desc: "Carrier declined this driver" },
  { key: "withdrawn", label: "Withdrawn", desc: "Recruiter withdrew the submission" }
];

export const CARRIER_UPDATABLE_STATUSES: DriverSubmissionStatus[] = [
  "contacted",
  "mvr_checking",
  "mvr_cleared",
  "interview_scheduled",
  "orientation_scheduled",
  "flight_ticket_bought",
  "hired",
  "refused"
];

export function submissionStatusLabel(status: string): string {
  return DRIVER_SUBMISSION_STAGES.find((s) => s.key === status)?.label ?? status.replace(/_/g, " ");
}

export function submissionStatusBadgeClass(status: string): string {
  if (status === "hired") return "badge-green";
  if (status === "refused" || status === "withdrawn") return "badge-red";
  if (status === "opened" || status === "contacted") return "badge-yellow";
  if (status === "flight_ticket_bought") return "badge-purple";
  return "badge-blue";
}

export function submissionStageIndex(status: string): number {
  const idx = DRIVER_SUBMISSION_STAGES.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}
