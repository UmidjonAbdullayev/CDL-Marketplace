import { getActiveCompanyId } from "../lib/activeCompany";
import type { HiringStage } from "../lib/hiring";
import { supabase } from "../lib/supabase";
import { enrichMessagesWithAttachmentUrls, getAttachmentViewUrl, uploadChatAttachment } from "./chatAttachments";
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
  storage_path: string | null;
  created_at: string;
  download_url?: string | null;
};

export type DealChannelType = "legacy" | "carrier_admin" | "recruiter_admin";

export type DealWorkspace = {
  deal: HiringDealRow;
  driver: Driver | null;
  driverCard: DriverCard | null;
  events: DealEventRow[];
  documents: DealDocumentRow[];
  /** @deprecated use carrierConversationId / recruiterConversationId */
  conversationId: string | null;
  carrierConversationId: string | null;
  recruiterConversationId: string | null;
  listPrice: number | null;
  carrierPrice: number;
};

function dealId(): string {
  return `DL-${Date.now().toString().slice(-6)}`;
}

async function insertDealEvent(dealIdValue: string, stage: string, title: string, description = "") {
  if (!supabase) return;
  await supabase.from("deal_events").insert({ deal_id: dealIdValue, stage, title, description });
}

export async function fetchOngoingDeals(options?: { platformWide?: boolean }): Promise<HiringDealRow[]> {
  if (!supabase) return [];
  const companyId = getActiveCompanyId();
  let q = supabase
    .from("deals")
    .select("*")
    .not("status", "eq", "Completed")
    .order("updated_at", { ascending: false });
  if (!options?.platformWide) {
    q = q.or(`buyer_company_id.eq.${companyId},seller_company_id.eq.${companyId}`);
  }
  const { data: deals, error } = await q;
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
    if (existing.listing_id) {
      await supabase
        .from("driver_listings")
        .update({ status: "hiring", updated_at: new Date().toISOString() })
        .eq("id", existing.listing_id);
    }
    return existing.id;
  }

  const { data: listing, error: listingErr } = await supabase
    .from("driver_listings")
    .select("price, carrier_price, seller_company_id, cdl_class, equipment, state, first_name, last_name")
    .eq("id", listingId)
    .single();
  if (listingErr || !listing) throw new Error("Listing not found");

  const dealAmount = listing.carrier_price ?? listing.price;
  const id = dealId();
  const now = new Date().toISOString();

  const { error: dealErr } = await supabase.from("deals").insert({
    id,
    listing_id: listingId,
    buyer_company_id: getActiveCompanyId(),
    seller_company_id: listing.seller_company_id,
    amount: dealAmount,
    status: "Awaiting Seller Signature",
    hiring_stage: "contract",
    escrow_amount: dealAmount,
    buyer_signed_at: now,
    buyer_signer_name: buyerSignerName
  });
  if (dealErr) throw dealErr;

  await insertDealEvent(id, "contract", "Buyer signed recruiting agreement", `Signed by ${buyerSignerName}`);
  await ensureCarrierAdminConversation(id, listing.seller_company_id, getActiveCompanyId());
  await supabase.from("driver_listings").update({ status: "hiring", updated_at: now }).eq("id", listingId);

  await supabase.from("activities").insert({
    activity_type: "deal",
    title: "Hiring process started",
    description: `${listing.cdl_class} ${listing.equipment} · ${listing.state} · recruiting fee $${dealAmount}`,
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
  await insertDealEvent(dealIdValue, "screening", "Hiring process activated", "Platform admin will coordinate next steps with both parties.");

  const { data: dealRow } = await supabase
    .from("deals")
    .select("buyer_company_id, seller_company_id")
    .eq("id", dealIdValue)
    .single();

  const carrierConvId = dealRow
    ? await ensureCarrierAdminConversation(dealIdValue, dealRow.seller_company_id, dealRow.buyer_company_id)
    : null;
  const recruiterConvId = dealRow
    ? await ensureRecruiterAdminConversation(dealIdValue, dealRow.seller_company_id, dealRow.buyer_company_id)
    : null;

  const now2 = new Date().toISOString();
  if (carrierConvId) {
    await supabase.from("messages").insert({
      conversation_id: carrierConvId,
      sender_company_id: null,
      direction: "in",
      body: "Your hiring case is active. Message the platform team here — we will keep you updated on recruiting progress."
    });
    await supabase.from("conversations").update({ last_message_at: now2 }).eq("id", carrierConvId);
  }
  if (recruiterConvId) {
    await supabase.from("messages").insert({
      conversation_id: recruiterConvId,
      sender_company_id: null,
      direction: "in",
      body: "Your listing is in an active hiring process. Message the platform team here for updates."
    });
    await supabase.from("conversations").update({ last_message_at: now2 }).eq("id", recruiterConvId);
  }

  return recruiterConvId ?? carrierConvId ?? "";
}

async function ensureCarrierAdminConversation(
  dealIdValue: string,
  sellerCompanyId: string,
  buyerCompanyId?: string
): Promise<string | null> {
  if (!supabase) return null;

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("deal_id", dealIdValue)
    .eq("channel_type", "carrier_admin")
    .maybeSingle();
  if (existing?.id) return existing.id;

  let buyerId = buyerCompanyId;
  if (!buyerId) {
    const { data: deal } = await supabase.from("deals").select("buyer_company_id").eq("id", dealIdValue).single();
    buyerId = deal?.buyer_company_id;
  }
  if (!buyerId) return null;

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({
      buyer_company_id: buyerId,
      seller_company_id: sellerCompanyId,
      deal_id: dealIdValue,
      channel_type: "carrier_admin",
      subject: "Carrier ↔ Platform",
      is_support: true
    })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

async function ensureRecruiterAdminConversation(
  dealIdValue: string,
  sellerCompanyId: string,
  buyerCompanyId: string
): Promise<string | null> {
  if (!supabase) return null;

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("deal_id", dealIdValue)
    .eq("channel_type", "recruiter_admin")
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({
      buyer_company_id: sellerCompanyId,
      seller_company_id: buyerCompanyId,
      deal_id: dealIdValue,
      channel_type: "recruiter_admin",
      subject: "Recruiter ↔ Platform",
      is_support: true
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

  const [{ data: companies }, listingResult, { data: events }, { data: documents }, { data: convRows }] = await Promise.all([
    supabase.from("companies").select("id, name").in("id", [deal.buyer_company_id, deal.seller_company_id]),
    deal.listing_id
      ? supabase.from("driver_listings").select(LISTING_DETAIL_SELECT).eq("id", deal.listing_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("deal_events").select("*").eq("deal_id", dealIdValue).order("created_at", { ascending: true }),
    supabase.from("deal_documents").select("*").eq("deal_id", dealIdValue).order("created_at", { ascending: false }),
    supabase.from("conversations").select("id, channel_type").eq("deal_id", dealIdValue)
  ]);

  let carrierConversationId =
    convRows?.find((c) => c.channel_type === "carrier_admin")?.id ?? null;
  let recruiterConversationId =
    convRows?.find((c) => c.channel_type === "recruiter_admin")?.id ?? null;

  if (deal.buyer_signed_at) {
    carrierConversationId = await ensureCarrierAdminConversation(
      dealIdValue,
      deal.seller_company_id,
      deal.buyer_company_id
    );
  }
  if (deal.buyer_signed_at && deal.seller_signed_at) {
    recruiterConversationId = await ensureRecruiterAdminConversation(
      dealIdValue,
      deal.seller_company_id,
      deal.buyer_company_id
    );
  }

  const legacyId = convRows?.find((c) => c.channel_type === "legacy" || !c.channel_type)?.id ?? null;
  const conversationId = carrierConversationId ?? recruiterConversationId ?? legacyId;

  const companyMap = new Map((companies ?? []).map((c) => [c.id, c]));
  const listing = listingResult.data;
  const listingCard = listing
    ? rowToCard({ ...listing, companies: unwrapRelation(listing.companies) } as Parameters<typeof rowToCard>[0], "carrier")
    : null;
  const driver = listing ? rowToDriver(listing as Parameters<typeof rowToDriver>[0], "carrier") : null;
  const documentsWithUrls: DealDocumentRow[] = (documents ?? []).map((doc) => ({
    ...(doc as DealDocumentRow),
    download_url: doc.storage_path ? getAttachmentViewUrl(doc.storage_path) : null
  }));

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
    documents: documentsWithUrls,
    conversationId,
    carrierConversationId,
    recruiterConversationId,
    listPrice: listing?.price ?? null,
    carrierPrice: deal.amount
  };
}

export type DealInternalNote = {
  id: string;
  author_name: string;
  body: string;
  created_at: string;
};

export async function fetchDealInternalNotes(dealIdValue: string): Promise<DealInternalNote[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("deal_events")
    .select("id, title, description, created_at")
    .eq("deal_id", dealIdValue)
    .eq("stage", "admin_note")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    author_name: row.title,
    body: row.description,
    created_at: row.created_at
  }));
}

export async function addDealInternalNote(
  dealIdValue: string,
  authorName: string,
  body: string
): Promise<void> {
  if (!supabase) return;
  const trimmed = body.trim();
  if (!trimmed) return;
  await insertDealEvent(dealIdValue, "admin_note", authorName, trimmed);
}

export async function advanceHiringStageAsAdmin(
  dealIdValue: string,
  stage: HiringStage,
  adminNote = ""
): Promise<void> {
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
  await insertDealEvent(dealIdValue, stage, `Platform updated stage: ${label}`, adminNote);
}

export async function advanceHiringStage(
  _dealIdValue: string,
  _stage: HiringStage,
  _buyerCompanyId: string
): Promise<void> {
  throw new Error("Only platform admins can update hiring stages");
}

export async function recordDealDocument(
  dealIdValue: string,
  fileName: string,
  storagePath: string,
  companyId: string
): Promise<DealDocumentRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("deal_documents")
    .insert({
      deal_id: dealIdValue,
      file_name: fileName,
      storage_path: storagePath,
      uploaded_by_company_id: companyId
    })
    .select("id, deal_id, file_name, storage_path, uploaded_by_company_id, created_at")
    .single();
  if (error) throw error;
  await insertDealEvent(dealIdValue, "document", "Document shared", fileName);
  const download_url = getAttachmentViewUrl(storagePath);
  return { ...(data as DealDocumentRow), download_url };
}

export async function uploadDealDocument(
  dealIdValue: string,
  file: File,
  companyId: string
): Promise<DealDocumentRow | null> {
  const uploaded = await uploadChatAttachment(file, `deals/${dealIdValue}`);
  return recordDealDocument(dealIdValue, uploaded.name, uploaded.path, companyId);
}

export async function fetchDealMessages(conversationId: string) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("messages")
    .select("id, direction, body, created_at, attachment_name, attachment_path, sender_company_id")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return enrichMessagesWithAttachmentUrls(data ?? []);
}

export type DealMessageRow = Awaited<ReturnType<typeof fetchDealMessages>>[number];

/** Messages use buyer-centric direction when sender_company_id is missing (legacy rows). */
export function isOwnDealMessage(
  msg: DealMessageRow,
  myCompanyId: string,
  buyerCompanyId: string
): boolean {
  if (!myCompanyId) return false;
  if (msg.sender_company_id) return msg.sender_company_id === myCompanyId;
  const amBuyer = myCompanyId === buyerCompanyId;
  return amBuyer ? msg.direction === "out" : msg.direction === "in";
}

export function subscribeDealMessages(conversationId: string, onChange: () => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`deal-messages-${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`
      },
      () => onChange()
    )
    .subscribe();
  return () => {
    if (supabase) void supabase.removeChannel(channel);
  };
}

export function subscribeDealWorkspace(dealIdValue: string, onChange: () => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`deal-workspace-${dealIdValue}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "deal_events",
        filter: `deal_id=eq.${dealIdValue}`
      },
      () => onChange()
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "deals",
        filter: `id=eq.${dealIdValue}`
      },
      () => onChange()
    )
    .subscribe();
  return () => {
    if (supabase) void supabase.removeChannel(channel);
  };
}

export async function sendDealMessage(
  conversationId: string,
  body: string,
  companyId: string,
  buyerCompanyId: string,
  attachment?: { name: string; path: string }
): Promise<DealMessageRow | null> {
  if (!supabase) return null;
  const direction = companyId === buyerCompanyId ? "out" : "in";
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_company_id: companyId,
      direction,
      body,
      attachment_name: attachment?.name ?? null,
      attachment_path: attachment?.path ?? null
    })
    .select("id, direction, body, created_at, attachment_name, attachment_path, sender_company_id")
    .single();
  if (error) throw error;
  await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId);
  const [enriched] = await enrichMessagesWithAttachmentUrls([data as DealMessageRow]);
  return enriched ?? null;
}

export async function sendDealFileMessage(
  conversationId: string,
  file: File,
  companyId: string,
  buyerCompanyId: string
): Promise<DealMessageRow | null> {
  const uploaded = await uploadChatAttachment(file, `conversations/${conversationId}`);
  return sendDealMessage(
    conversationId,
    `Shared file: ${uploaded.name}`,
    companyId,
    buyerCompanyId,
    { name: uploaded.name, path: uploaded.path }
  );
}

export async function fetchListingForContract(listingId: number): Promise<{ card: DriverCard; sellerId: string } | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("driver_listings").select(LISTING_CARD_SELECT).eq("id", listingId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as { seller_company_id: string } & Parameters<typeof rowToCard>[0];
  return { card: rowToCard(row, "carrier"), sellerId: row.seller_company_id };
}
