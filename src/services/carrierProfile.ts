import { getActiveCompanyId } from "../lib/activeCompany";
import { parseCarrierOffers, syncLegacyOfferFields } from "../lib/carrier-offers";
import { supabase } from "../lib/supabase";
import type { CarrierOffersRequirements } from "../types/carrier-offers";
import type { CarrierProfile } from "../types/registration";
import { fetchRegistrationById } from "./registration";

export async function fetchCarrierOffersForAccount(accountId: string): Promise<CarrierOffersRequirements | null> {
  const account = await fetchRegistrationById(accountId);
  if (!account || account.account_type !== "carrier") return null;
  const profile = account.profile_data as CarrierProfile & { offersRequirements?: unknown };
  return parseCarrierOffers(profile.offersRequirements);
}

export async function fetchCarrierOffersForCompany(companyId: string): Promise<CarrierOffersRequirements | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("registration_accounts")
    .select("profile_data, account_type")
    .eq("company_id", companyId)
    .eq("account_type", "carrier")
    .maybeSingle();
  if (error || !data || data.account_type !== "carrier") return null;
  const profile = data.profile_data as CarrierProfile & { offersRequirements?: unknown };
  return parseCarrierOffers(profile.offersRequirements);
}

export async function saveCarrierOffersRequirements(
  accountId: string,
  offers: CarrierOffersRequirements
): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const account = await fetchRegistrationById(accountId);
  if (!account || account.account_type !== "carrier") throw new Error("Carrier account required");

  const profile = { ...(account.profile_data as CarrierProfile) };
  const legacy = syncLegacyOfferFields(offers);
  const nextProfile: CarrierProfile & { offersRequirements: CarrierOffersRequirements } = {
    ...profile,
    ...legacy,
    offersRequirements: { ...offers, updatedAt: new Date().toISOString() }
  };

  const { error } = await supabase
    .from("registration_accounts")
    .update({
      profile_data: nextProfile,
      updated_at: new Date().toISOString()
    })
    .eq("id", accountId);

  if (error) throw new Error(error.message);
}

export async function saveCarrierOffersForSession(accountId: string, offers: CarrierOffersRequirements): Promise<void> {
  const companyId = getActiveCompanyId();
  await saveCarrierOffersRequirements(accountId, offers);
  void companyId;
}
