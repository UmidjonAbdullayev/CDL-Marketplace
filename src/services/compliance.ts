import { getActiveCompanyId } from "../lib/activeCompany";
import { supabase } from "../lib/supabase";
import { PLATFORM_POLICY_RULES, POLICY_DOCUMENTS, POLICY_VERSION } from "../lib/policies";
import type { RegistrationAccount } from "../types/registration";

export type AcceptedPolicies = {
  version: string;
  acceptedAt: string | null;
  documents: typeof POLICY_DOCUMENTS;
  rules: readonly string[];
};

export type DealContractRecord = {
  dealId: string;
  buyerCompany: string;
  sellerCompany: string;
  buyerSigner: string | null;
  sellerSigner: string | null;
  buyerSignedAt: string | null;
  sellerSignedAt: string | null;
  driverLabel: string;
  amount: number;
  status: string;
  hiringStage: string;
};

export function policiesFromAccount(account: RegistrationAccount): AcceptedPolicies {
  return {
    version: account.policy_version ?? POLICY_VERSION,
    acceptedAt: account.policy_accepted_at,
    documents: POLICY_DOCUMENTS,
    rules: PLATFORM_POLICY_RULES
  };
}

export async function fetchDealContracts(): Promise<DealContractRecord[]> {
  if (!supabase) return [];

  const companyId = getActiveCompanyId();
  const { data: deals, error } = await supabase
    .from("deals")
    .select(
      "id, amount, status, hiring_stage, buyer_company_id, seller_company_id, listing_id, buyer_signed_at, seller_signed_at, buyer_signer_name, seller_signer_name"
    )
    .or(`buyer_company_id.eq.${companyId},seller_company_id.eq.${companyId}`)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!deals?.length) return [];

  const listingIds = deals.map((d) => d.listing_id).filter((id): id is number => id != null);
  const companyIds = [...new Set(deals.flatMap((d) => [d.buyer_company_id, d.seller_company_id]))];

  const [{ data: companies }, { data: listings }] = await Promise.all([
    supabase.from("companies").select("id, name").in("id", companyIds),
    listingIds.length
      ? supabase.from("driver_listings").select("id, first_name, last_name").in("id", listingIds)
      : Promise.resolve({ data: [] as { id: number; first_name: string; last_name: string }[] })
  ]);

  const companyMap = new Map((companies ?? []).map((c) => [c.id, c.name]));
  const listingMap = new Map((listings ?? []).map((l) => [l.id, l]));

  return deals.map((d) => {
    const listing = d.listing_id ? listingMap.get(d.listing_id) : null;
    const driverLabel = listing
      ? `${listing.first_name} ${listing.last_name.charAt(0)}.`
      : "Driver lead";
    return {
      dealId: d.id,
      buyerCompany: companyMap.get(d.buyer_company_id) ?? "Buyer",
      sellerCompany: companyMap.get(d.seller_company_id) ?? "Seller",
      buyerSigner: d.buyer_signer_name,
      sellerSigner: d.seller_signer_name,
      buyerSignedAt: d.buyer_signed_at,
      sellerSignedAt: d.seller_signed_at,
      driverLabel,
      amount: d.amount,
      status: d.status,
      hiringStage: d.hiring_stage
    };
  });
}

export type BillingRow = {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: string;
};

export async function fetchBillingHistory(): Promise<BillingRow[]> {
  if (!supabase) return [];

  const companyId = getActiveCompanyId();
  const rows: BillingRow[] = [];

  const { data: purchases } = await supabase
    .from("purchases")
    .select("id, amount, purchased_at, listing_id")
    .eq("buyer_company_id", companyId)
    .order("purchased_at", { ascending: false });

  for (const p of purchases ?? []) {
    rows.push({
      id: p.id,
      date: p.purchased_at,
      description: `Lead purchase — listing #${p.listing_id}`,
      amount: p.amount,
      status: "Paid"
    });
  }

  return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
