import { getActiveCompanyId } from "../lib/activeCompany";
import { supabase } from "../lib/supabase";

export type CompanyReview = {
  id: string;
  rating: number;
  title: string;
  body: string;
  created_at: string;
  reviewer_name: string;
  reviewer_type: string;
  deal_id: string | null;
  driver_rating: number | null;
  driver_comment: string | null;
};

export type CompanyReviewSummary = {
  companyId: string;
  companyName: string;
  companyType: string;
  rating: number;
  reviewCount: number;
  reviews: CompanyReview[];
};

export type DealReviewRecord = {
  id: string;
  rating: number;
  title: string;
  body: string;
  driver_rating: number | null;
  driver_comment: string | null;
  created_at: string;
};

export type DealReviewContext = {
  dealId: string;
  canReview: boolean;
  myRole: "buyer" | "seller";
  myCompanyId: string;
  counterpartyCompanyId: string;
  counterpartyName: string;
  driverName: string;
  myReview: DealReviewRecord | null;
  counterpartyHasReviewed: boolean;
};

function isDealComplete(status: string, hiringStage: string): boolean {
  return status === "Completed" || hiringStage === "completed";
}

async function refreshCompanyRating(companyId: string): Promise<void> {
  if (!supabase) return;
  const { data, error } = await supabase
    .from("company_reviews")
    .select("rating")
    .eq("reviewed_company_id", companyId);
  if (error) throw error;
  const ratings = (data ?? []).map((r) => r.rating);
  const avg = ratings.length
    ? Math.round((ratings.reduce((s, n) => s + n, 0) / ratings.length) * 10) / 10
    : 0;
  await supabase.from("companies").update({ rating: avg }).eq("id", companyId);
}

export async function fetchCompanyReviewSummary(companyId: string): Promise<CompanyReviewSummary | null> {
  if (!supabase) return null;

  const [{ data: company }, { data: reviews, error }] = await Promise.all([
    supabase.from("companies").select("id, name, company_type, rating").eq("id", companyId).maybeSingle(),
    supabase
      .from("company_reviews")
      .select("id, rating, title, body, created_at, deal_id, reviewer_company_id, driver_rating, driver_comment")
      .eq("reviewed_company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(50)
  ]);
  if (error) throw error;
  if (!company) return null;

  const reviewerIds = [...new Set((reviews ?? []).map((r) => r.reviewer_company_id))];
  const { data: reviewers } = reviewerIds.length
    ? await supabase.from("companies").select("id, name, company_type").in("id", reviewerIds)
    : { data: [] as { id: string; name: string; company_type: string }[] };

  const reviewerMap = new Map((reviewers ?? []).map((r) => [r.id, r]));
  const mapped: CompanyReview[] = (reviews ?? []).map((r) => {
    const reviewer = reviewerMap.get(r.reviewer_company_id);
    return {
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      created_at: r.created_at,
      deal_id: r.deal_id,
      driver_rating: r.driver_rating ?? null,
      driver_comment: r.driver_comment ?? null,
      reviewer_name: reviewer?.name ?? "Verified partner",
      reviewer_type: reviewer?.company_type ?? "partner"
    };
  });

  const reviewCount = mapped.length;
  const avgRating = reviewCount
    ? Math.round((mapped.reduce((s, r) => s + r.rating, 0) / reviewCount) * 10) / 10
    : Number(company.rating ?? 0);

  return {
    companyId: company.id,
    companyName: company.name,
    companyType: company.company_type,
    rating: avgRating,
    reviewCount,
    reviews: mapped
  };
}

export async function fetchDealReviewContext(dealId: string, myCompanyId: string): Promise<DealReviewContext | null> {
  if (!supabase || !dealId || !myCompanyId) return null;

  const { data: deal, error: dealErr } = await supabase
    .from("deals")
    .select("id, status, hiring_stage, buyer_company_id, seller_company_id, listing_id")
    .eq("id", dealId)
    .maybeSingle();
  if (dealErr) throw dealErr;
  if (!deal) return null;

  const isBuyer = deal.buyer_company_id === myCompanyId;
  const isSeller = deal.seller_company_id === myCompanyId;
  if (!isBuyer && !isSeller) {
    return {
      dealId,
      canReview: false,
      myRole: "buyer",
      myCompanyId,
      counterpartyCompanyId: "",
      counterpartyName: "",
      driverName: "Driver",
      myReview: null,
      counterpartyHasReviewed: false
    };
  }

  const counterpartyCompanyId = isBuyer ? deal.seller_company_id : deal.buyer_company_id;
  const [{ data: companies }, { data: listing }, { data: reviews }] = await Promise.all([
    supabase.from("companies").select("id, name").in("id", [counterpartyCompanyId]),
    deal.listing_id
      ? supabase.from("driver_listings").select("first_name, last_name").eq("id", deal.listing_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("company_reviews")
      .select("id, rating, title, body, driver_rating, driver_comment, created_at, reviewer_company_id")
      .eq("deal_id", dealId)
  ]);

  const counterparty = (companies ?? []).find((c) => c.id === counterpartyCompanyId);
  const driverName = listing
    ? `${listing.first_name} ${listing.last_name}`.trim()
    : "Driver";

  const myReviewRow = (reviews ?? []).find((r) => r.reviewer_company_id === myCompanyId);
  const counterpartyReview = (reviews ?? []).find((r) => r.reviewer_company_id === counterpartyCompanyId);

  const myReview: DealReviewRecord | null = myReviewRow
    ? {
        id: myReviewRow.id,
        rating: myReviewRow.rating,
        title: myReviewRow.title,
        body: myReviewRow.body,
        driver_rating: myReviewRow.driver_rating ?? null,
        driver_comment: myReviewRow.driver_comment ?? null,
        created_at: myReviewRow.created_at
      }
    : null;

  return {
    dealId,
    canReview: isDealComplete(deal.status, deal.hiring_stage ?? ""),
    myRole: isBuyer ? "buyer" : "seller",
    myCompanyId,
    counterpartyCompanyId,
    counterpartyName: counterparty?.name ?? "Partner",
    driverName,
    myReview,
    counterpartyHasReviewed: Boolean(counterpartyReview)
  };
}

export async function submitDealReview(input: {
  dealId: string;
  reviewedCompanyId: string;
  partnerRating: number;
  partnerComment: string;
  driverRating: number;
  driverComment: string;
  partnerTitle: string;
}): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const reviewerCompanyId = getActiveCompanyId();

  const { data: deal, error: dealErr } = await supabase
    .from("deals")
    .select("id, status, hiring_stage, buyer_company_id, seller_company_id")
    .eq("id", input.dealId)
    .maybeSingle();
  if (dealErr) throw dealErr;
  if (!deal) throw new Error("Deal not found");
  if (!isDealComplete(deal.status, deal.hiring_stage ?? "")) {
    throw new Error("Reviews are only available after the deal is completed");
  }
  if (reviewerCompanyId !== deal.buyer_company_id && reviewerCompanyId !== deal.seller_company_id) {
    throw new Error("Only deal parties can submit a review");
  }
  const expectedReviewed =
    reviewerCompanyId === deal.buyer_company_id ? deal.seller_company_id : deal.buyer_company_id;
  if (input.reviewedCompanyId !== expectedReviewed) {
    throw new Error("Invalid review target for this deal");
  }

  const { error } = await supabase.from("company_reviews").insert({
    reviewed_company_id: input.reviewedCompanyId,
    reviewer_company_id: reviewerCompanyId,
    deal_id: input.dealId,
    rating: Math.min(5, Math.max(1, Math.round(input.partnerRating))),
    title: input.partnerTitle.trim() || "Deal review",
    body: input.partnerComment.trim(),
    driver_rating: Math.min(5, Math.max(1, Math.round(input.driverRating))),
    driver_comment: input.driverComment.trim()
  });
  if (error) {
    if (error.code === "23505") throw new Error("You have already submitted a review for this deal");
    throw new Error(error.message);
  }

  await refreshCompanyRating(input.reviewedCompanyId);
}

export async function submitCompanyReview(input: {
  reviewedCompanyId: string;
  rating: number;
  title: string;
  body: string;
  dealId?: string;
}): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const reviewerCompanyId = getActiveCompanyId();
  const { error } = await supabase.from("company_reviews").insert({
    reviewed_company_id: input.reviewedCompanyId,
    reviewer_company_id: reviewerCompanyId,
    deal_id: input.dealId ?? null,
    rating: Math.min(5, Math.max(1, Math.round(input.rating))),
    title: input.title.trim(),
    body: input.body.trim()
  });
  if (error) throw error;
  await refreshCompanyRating(input.reviewedCompanyId);
}

export function companyTypeLabel(type: string): string {
  if (type === "carrier") return "Carrier";
  if (type === "agency") return "Agency";
  if (type === "solo_recruiter") return "Recruiter";
  return type.replace(/_/g, " ");
}
