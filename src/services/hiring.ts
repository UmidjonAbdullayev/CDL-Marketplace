import { getActiveCompanyId } from "../lib/activeCompany";
import type { HiringStage } from "../lib/hiring";
import { supabase } from "../lib/supabase";
import { LISTING_CARD_SELECT, LISTING_DETAIL_SELECT, rowToCard, rowToDriver, unwrapRelation } from "./marketplace";
import type { Driver, DriverCard } from "../types";

type ListingRow = {
  id: number;
  first_name: string;
  last_name: string;
  state: string;
  price: number;
  seller_company_id: string;
  equipment: string;
  cdl_class: string;
  companies: { name: string; rating: number } | { name: string; rating: number }[] | null;
};

export type HiringDealRow = {
  id: string;
  listing_id: number | null;
  buyer_company_id: string;
  seller_company_id: string;
  amount: number;
  status: string;
  hiring_stage: string;
  escrow_amount: number;
  escrow_released: boolean;
  buyer_signed_at: string | null;
  seller_signed_at: string | null;
  buyer_signer_name: string | null;
  seller_signer_name: string | null;
  created_at: string;
  updated_at: string;
  companies_buyer: { name: string } | null;
  companies_seller: { name: string } | null;
  driver_listings: ListingRow | null;
};

export type DealEventRow = {
  id: string;
  deal_id: string;
  stage: string;
  title: string;
  description: string;
  created_at: string;
};

export type DealDocumentRow = {
  id: string;
  deal_id: string;
  file_name: string;
  uploaded_by_company_id: string | null;
  created_at: string;
};

export type DealWorkspace = {
  deal: HiringDealRow;
  driver: Driver | null;
  driverCard: DriverCard | null;
  events: DealEventRow[];
  documents: DealDocumentRow[];
  conversationId: string | null;
};

function dealId(): string {
  return `DL-${Date.now().toString().slice(-6)}`;
}

async function insertDealEvent(dealIdValue: string, stage: string, title: string, description = "") {
  if (!supabase) return;
  await supabase.from("deal_events").insert({ deal_id: dealIdValue, stage, title, description });
}

export async function fetchOngoingDeals(): Promise<HiringDealRow[]> {
  if (!supabase) return [];
  const companyId = getActiveCompanyId();
  const { data: deals, error } = await supabase
    .from("deals")
    .select("*")
    .or(`buyer_company_id.eq.${companyId},seller_company_id.eq.${companyId}`)
    .not("status", "eq", "Completed")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  if (!deals?.length) return [];

  const listingIds = deals.map((d) => d.listing_id).filter((id): id is number => id != null);
  const companyIds = [...new Set(deals.flatMap((d) => [d.buyer_company_id, d.seller_company_id]))];

  const [{ data: companies }, { data: listings }] = await Promise.all([
    supabase.from("companies").select("id, name").in("id", companyIds),
    listingIds.length
      ? supabase.from("driver_listings").select("id, first_name, last_name, state, price, seller_company_id, equipment, cdl_class, companies (name, rating)").in("id", listingIds)
      : Promise.resolve({ data: [] as ListingRow[] })
  ]);

  const companyMap = new Map((companies ?? []).map((c) => [c.id, c]));
  const listingMap = new Map((listings ?? []).map((l) => [l.id, l]));

  return deals.map((d) => ({
    ...d,
    companies_buyer: companyMap.get(d.buyer_company_id) ? { name: companyMap.get(d.buyer_company_id)!.name } : null,
    companies_seller: companyMap.get(d.seller_company_id) ? { name: companyMap.get(d.seller_company_id)!.name } : null,
    driver_listings: d.listing_id && listingMap.get(d.listing_id) ? listingMap.get(d.listing_id)! : null
  }));
}

export async function findActiveDealForListing(listingId: number): Promise<HiringDealRow | null> {
  if (!supabase) return null;
  const companyId = getActiveCompanyId();
  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .eq("listing_id", listingId)
    .eq("buyer_company_id", companyId)
    .not("status", "eq", "Completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as HiringDealRow | null;
}

export async function startHiringProcess(listingId: number, buyerSignerName: string): Promise<string> {
  if (!supabase) throw new Error("Supabase not configured");

  const existing = await findActiveDealForListing(listingId);
  if (existing) {
    if (!existing.buyer_signed_at) {
      await signBuyerContract(existing.id, buyerSignerName);
    }
    return existing.id;
  }

  const { data: listing, error: listingErr } = await supabase
    .from("driver_listings")
    .select("price, seller_company_id, cdl_class, equipment, state, first_name, last_name")
    .eq("id", listingId)
    .single();
  if (listingErr || !listing) throw new Error("Listing not found");

  const id = dealId();
  const now = new Date().toISOString();

  const { error: dealErr } = await supabase.from("deals").insert({
    id,
    listing_id: listingId,
    buyer_company_id: getActiveCompanyId(),
    seller_company_id: listing.seller_company_id,
    amount: listing.price,
    status: "Awaiting Seller Signature",
    hiring_stage: "contract",
    escrow_amount: listing.price,
    buyer_signed_at: now,
    buyer_signer_name: buyerSignerName
  });
  if (dealErr) throw dealErr;

  await insertDealEvent(id, "contract", "Buyer signed recruiting agreement", `Signed by ${buyerSignerName}`);
  await supabase.from("driver_listings").update({ status: "reserved", updated_at: now }).eq("id", listingId);

  await supabase.from("activities").insert({
    activity_type: "deal",
    title: "Hiring process started",
    description: `${listing.cdl_class} ${listing.equipment} · ${listing.state} · recruiting fee $${listing.price}`,
    status_label: "CONTRACT",
    status_class: "listed"
  });

  return id;
}

export async function signBuyerContract(dealIdValue: string, signerName: string): Promise<void> {
  if (!supabase) return;
  const now = new Date().toISOString();
  const { error } = await supabase.from("deals").update({
    buyer_signed_at: now,
    buyer_signer_name: signerName,
    status: "Awaiting Seller Signature",
    updated_at: now
  }).eq("id", dealIdValue);
  if (error) throw error;
  await insertDealEvent(dealIdValue, "contract", "Buyer signed recruiting agreement", `Signed by ${signerName}`);
}

export async function signSellerContract(dealIdValue: string, signerName: string): Promise<string> {
  if (!supabase) throw new Error("Supabase not configured");
  const now = new Date().toISOString();

  const { error } = await supabase.from("deals").update({
    seller_signed_at: now,
    seller_signer_name: signerName,
    status: "Hiring Active",
    hiring_stage: "screening",
    updated_at: now
  }).eq("id", dealIdValue);
  if (error) throw error;

  await insertDealEvent(dealIdValue, "contract", "Seller signed representation agreement", `Signed by ${signerName}`);
  await insertDealEvent(dealIdValue, "screening", "Hiring process activated", "Both parties may now communicate and exchange documents.");

  const conversationId = await ensureDealConversation(dealIdValue);
  if (conversationId) {
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_company_id: null,
      direction: "in",
      body: "Contract fully executed. This channel is now open for recruiting coordination, document exchange, and hiring updates."
    });
    await supabase.from("conversations").update({ last_message_at: now }).eq("id", conversationId);
  }

  return conversationId ?? "";
}

async function ensureDealConversation(dealIdValue: string): Promise<string | null> {
  if (!supabase) return null;

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("deal_id", dealIdValue)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: deal } = await supabase
    .from("deals")
    .select("buyer_company_id, seller_company_id, listing_id")
    .eq("id", dealIdValue)
    .single();
  if (!deal) return null;

  let subject = `Hiring — Deal ${dealIdValue}`;
  if (deal.listing_id) {
    const { data: listing } = await supabase
      .from("driver_listings")
      .select("first_name, last_name")
      .eq("id", deal.listing_id)
      .maybeSingle();
    if (listing) subject = `Hiring — ${listing.first_name} ${listing.last_name}`;
  }

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({
      buyer_company_id: deal.buyer_company_id,
      seller_company_id: deal.seller_company_id,
      deal_id: dealIdValue,
      subject,
      is_support: false
    })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

export async function fetchDealWorkspace(dealIdValue: string): Promise<DealWorkspace | null> {
  if (!supabase) return null;

  const { data: deal, error } = await supabase.from("deals").select("*").eq("id", dealIdValue).maybeSingle();
  if (error) throw error;
  if (!deal) return null;

  const [{ data: companies }, listingResult, { data: events }, { data: documents }, { data: conv }] = await Promise.all([
    supabase.from("companies").select("id, name").in("id", [deal.buyer_company_id, deal.seller_company_id]),
    deal.listing_id
      ? supabase.from("driver_listings").select(LISTING_DETAIL_SELECT).eq("id", deal.listing_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("deal_events").select("*").eq("deal_id", dealIdValue).order("created_at", { ascending: true }),
    supabase.from("deal_documents").select("*").eq("deal_id", dealIdValue).order("created_at", { ascending: false }),
    supabase.from("conversations").select("id").eq("deal_id", dealIdValue).maybeSingle()
  ]);

  const companyMap = new Map((companies ?? []).map((c) => [c.id, c]));
  const listing = listingResult.data;
  const listingCard = listing
    ? rowToCard({ ...listing, companies: unwrapRelation(listing.companies) } as Parameters<typeof rowToCard>[0])
    : null;
  const driver = listing ? rowToDriver(listing as Parameters<typeof rowToDriver>[0]) : null;

  return {
    deal: {
      ...deal,
      companies_buyer: companyMap.get(deal.buyer_company_id) ? { name: companyMap.get(deal.buyer_company_id)!.name } : null,
      companies_seller: companyMap.get(deal.seller_company_id) ? { name: companyMap.get(deal.seller_company_id)!.name } : null,
      driver_listings: listing
        ? {
            id: listing.id,
            first_name: listing.first_name,
            last_name: listing.last_name,
            state: listing.state,
            price: listing.price,
            seller_company_id: listing.seller_company_id,
            equipment: listing.equipment,
            cdl_class: listing.cdl_class,
            companies: unwrapRelation(listing.companies)
          }
        : null
    },
    driver,
    driverCard: listingCard,
    events: events ?? [],
    documents: documents ?? [],
    conversationId: conv?.id ?? null
  };
}

export async function advanceHiringStage(dealIdValue: string, stage: HiringStage): Promise<void> {
  if (!supabase) return;
  const label = stage.charAt(0).toUpperCase() + stage.slice(1);
  const statusMap: Record<string, string> = {
    screening: "Hiring Active",
    interview: "Hiring Active",
    orientation: "Orientation Scheduled",
    hired: "Hired Confirmed",
    completed: "Completed"
  };
  const { error } = await supabase.from("deals").update({
    hiring_stage: stage,
    status: statusMap[stage] ?? "Hiring Active",
    updated_at: new Date().toISOString(),
    ...(stage === "completed" ? { escrow_released: true } : {})
  }).eq("id", dealIdValue);
  if (error) throw error;
  await insertDealEvent(dealIdValue, stage, `Stage updated: ${label}`, "");
}

export async function uploadDealDocument(dealIdValue: string, fileName: string, companyId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("deal_documents").insert({
    deal_id: dealIdValue,
    file_name: fileName,
    uploaded_by_company_id: companyId
  });
  if (error) throw error;
  await insertDealEvent(dealIdValue, "document", "Document shared", fileName);
}

export async function fetchDealMessages(conversationId: string) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("messages")
    .select("id, direction, body, created_at, attachment_name")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function sendDealMessage(
  conversationId: string,
  body: string,
  companyId: string,
  buyerCompanyId: string,
  attachmentName?: string
) {
  if (!supabase) return;
  const direction = companyId === buyerCompanyId ? "out" : "in";
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_company_id: companyId,
    direction,
    body,
    attachment_name: attachmentName ?? null
  });
  if (error) throw error;
  await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId);
}

export async function fetchListingForContract(listingId: number): Promise<{ card: DriverCard; sellerId: string } | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("driver_listings").select(LISTING_CARD_SELECT).eq("id", listingId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as { seller_company_id: string } & Parameters<typeof rowToCard>[0];
  return { card: rowToCard(row), sellerId: row.seller_company_id };
}
