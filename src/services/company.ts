import { supabase } from "../lib/supabase";

export type CompanyRow = {
  id: string;
  name: string;
  company_type: string;
  rating: number;
  wallet_balance: number;
  leads_sold: number;
  refund_rate: number;
  status: string;
  created_at: string;
  cdl_score_verified: boolean;
  cdl_score_email: string | null;
  max_active_hires: number | null;
  max_active_listings: number | null;
};

export async function fetchCompanyById(id: string): Promise<CompanyRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("companies").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as CompanyRow | null;
}
