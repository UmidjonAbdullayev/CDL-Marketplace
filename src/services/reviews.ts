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
};

export type CompanyReviewSummary = {
  companyId: string;
  companyName: string;
  companyType: string;
  rating: number;
  reviewCount: number;
  reviews: CompanyReview[];
};

export async function fetchCompanyReviewSummary(companyId: string): Promise<CompanyReviewSummary | null> {
  if (!supabase) return null;

  const [{ data: company }, { data: reviews, error }] = await Promise.all([
    supabase.from("companies").select("id, name, company_type, rating").eq("id", companyId).maybeSingle(),
    supabase
      .from("company_reviews")
      .select("id, rating, title, body, created_at, deal_id, reviewer_company_id")
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
}

export function companyTypeLabel(type: string): string {
  if (type === "carrier") return "Carrier";
  if (type === "agency") return "Agency";
  if (type === "solo_recruiter") return "Recruiter";
  return type.replace(/_/g, " ");
}
