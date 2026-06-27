import type {
  AccountType,
  AgencyProfile,
  CarrierPlanId,
  CarrierProfile,
  RegistrationAccount,
  SoloRecruiterProfile
} from "../types/registration";
import { searchCreditsForPlan } from "../lib/carrier-plans";
import { provisionCdlScoreAccount } from "./cdlScore";

function profileFields(
  accountType: AccountType,
  profile: CarrierProfile | AgencyProfile | SoloRecruiterProfile
): { companyName: string; mcNumber?: string; contactName?: string; email: string } {
  if (accountType === "carrier") {
    const p = profile as CarrierProfile;
    return {
      companyName: p.companyName,
      mcNumber: p.mcNumber,
      contactName: p.contactPersonName,
      email: p.companyEmail
    };
  }
  if (accountType === "agency") {
    const p = profile as AgencyProfile;
    return { companyName: p.agencyName, contactName: p.contactPersonName, email: p.companyEmail };
  }
  const p = profile as SoloRecruiterProfile;
  return { companyName: p.fullName, contactName: p.fullName, email: p.email };
}

/** Create/link CDL Score account with same credentials; grant plan search credits when applicable. */
export async function linkRegistrationToCdlScore(
  account: RegistrationAccount,
  password: string
): Promise<void> {
  const { companyName, mcNumber, contactName, email } = profileFields(account.account_type, account.profile_data);

  const plan = account.account_type === "carrier" ? account.selected_plan ?? "free" : null;
  const grantCredits =
    account.account_type === "carrier" &&
    account.status !== "pending_payment" &&
    searchCreditsForPlan(plan as CarrierPlanId) > 0;

  await provisionCdlScoreAccount({
    email,
    password,
    companyName,
    mcNumber,
    contactName,
    plan: plan as CarrierPlanId | null,
    searchCredits: grantCredits ? searchCreditsForPlan(plan as CarrierPlanId) : 0
  });
}
