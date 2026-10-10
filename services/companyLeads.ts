import { getActiveCompanyId } from "../lib/activeCompany";
import { stagesForBucket } from "../lib/company-leads";
import { supabase } from "../lib/supabase";
import type {
  CompanyLead,
  CompanyLeadBatch,
  CompanyLeadFilters,
  CompanyLeadInput,
  CompanyLeadNote,
  CompanyLeadStage
} from "../types/company-leads";
import type { Paginated } from "../types";

const DEFAULT_PAGE_SIZE = 20;

function leadId(): string {
  return `LEAD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function batchId(): string {
  return `LB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function noteId(): string {
  return `LN-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function toPaginated<T>(items: T[], total: number, page: number, pageSize: number): Paginated<T> {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  };
}

export async function fetchAssignableCompanies(): Promise<{ id: string; name: string; company_type: string }[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, company_type")
    .neq("company_type", "platform")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function fetchCompanyLeadsPage(
  filters: CompanyLeadFilters = {},
  { page = 1, pageSize = DEFAULT_PAGE_SIZE, companyId }: { page?: number; pageSize?: number; companyId?: string } = {}
): Promise<Paginated<CompanyLead>> {
  if (!supabase) return toPaginated([], 0, page, pageSize);
  const cid = companyId ?? getActiveCompanyId();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase
    .from("company_leads")
    .select("*", { count: "exact" })
    .eq("company_id", cid)
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  if (filters.stage) q = q.eq("stage", filters.stage);
  else {
    const bucketStages = stagesForBucket(filters.bucket);
    if (bucketStages?.length) q = q.in("stage", bucketStages);
  }
  if (filters.driverType) q = q.ilike("driver_type", filters.driverType);
  if (filters.state) q = q.eq("state", filters.state);
  if (filters.source) q = q.eq("source", filters.source);
  if (filters.dateFrom) q = q.gte("assigned_at", filters.dateFrom);
  if (filters.dateTo) q = q.lte("assigned_at", `${filters.dateTo}T23:59:59.999Z`);
  if (filters.search?.trim()) {
    const s = filters.search.trim().replace(/[%_]/g, "");
    q = q.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%,state.ilike.%${s}%`);
  }

  const { data, error, count } = await q.range(from, to);
  if (error) throw error;
  return toPaginated((data ?? []) as CompanyLead[], count ?? 0, page, pageSize);
}

export async function fetchCompanyLeadById(id: string): Promise<CompanyLead | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("company_leads").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as CompanyLead | null;
}

export async function updateCompanyLeadStage(id: string, stage: CompanyLeadStage): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase
    .from("company_leads")
    .update({ stage, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchLeadNotes(leadId: string): Promise<CompanyLeadNote[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("company_lead_notes")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CompanyLeadNote[];
}

export async function addLeadNote(leadId: string, body: string, authorName: string): Promise<CompanyLeadNote> {
  if (!supabase) throw new Error("Supabase not configured");
  const companyId = getActiveCompanyId();
  const row = {
    id: noteId(),
    lead_id: leadId,
    company_id: companyId,
    author_name: authorName || "User",
    body: body.trim()
  };
  const { data, error } = await supabase.from("company_lead_notes").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  await supabase
    .from("company_leads")
    .update({ notes_preview: body.trim().slice(0, 160), updated_at: new Date().toISOString() })
    .eq("id", leadId);
  return data as CompanyLeadNote;
}

export async function assignLeadsToCompany(params: {
  companyId: string;
  leads: CompanyLeadInput[];
  source?: string;
  fileName?: string;
  createdByAccountId?: string | null;
}): Promise<{ batchId: string; count: number }> {
  if (!supabase) throw new Error("Supabase not configured");
  if (!params.leads.length) throw new Error("No leads to assign");

  const bid = batchId();
  const now = new Date().toISOString();
  const source = params.source ?? "manual";

  const { error: batchError } = await supabase.from("company_lead_batches").insert({
    id: bid,
    company_id: params.companyId,
    created_by_account_id: params.createdByAccountId ?? null,
    file_name: params.fileName ?? null,
    source,
    lead_count: params.leads.length
  });
  if (batchError) throw new Error(batchError.message);

  const rows = params.leads.map((l) => ({
    id: leadId(),
    company_id: params.companyId,
    batch_id: bid,
    first_name: l.first_name.trim(),
    last_name: l.last_name.trim(),
    phone: l.phone?.trim() || null,
    email: l.email?.trim() || null,
    cdl_class: l.cdl_class?.trim() || "Class A",
    state: l.state?.trim() || null,
    years_experience: l.years_experience ?? null,
    endorsements: l.endorsements?.trim() || null,
    driver_type: l.driver_type?.trim() || null,
    source,
    stage: l.stage ?? "lead",
    notes_preview: l.notes_preview?.trim() || null,
    assigned_by_account_id: params.createdByAccountId ?? null,
    assigned_at: now,
    created_at: now,
    updated_at: now
  }));

  const { error } = await supabase.from("company_leads").insert(rows);
  if (error) throw new Error(error.message);

  return { batchId: bid, count: rows.length };
}

export async function fetchRecentLeadBatches(limit = 20): Promise<(CompanyLeadBatch & { company_name?: string })[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("company_lead_batches")
    .select("*, companies(name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as CompanyLeadBatch & { companies?: { name: string } | { name: string }[] | null };
    const company = Array.isArray(r.companies) ? r.companies[0] : r.companies;
    return { ...r, company_name: company?.name };
  });
}

export async function fetchCompanyLeadCounts(companyId?: string): Promise<Record<string, number>> {
  if (!supabase) return {};
  const cid = companyId ?? getActiveCompanyId();
  const { data, error } = await supabase
    .from("company_leads")
    .select("stage")
    .eq("company_id", cid)
    .is("archived_at", null);
  if (error) throw error;
  const counts: Record<string, number> = { all: data?.length ?? 0 };
  for (const row of data ?? []) {
    counts[row.stage] = (counts[row.stage] ?? 0) + 1;
  }
  return counts;
}

export { DEFAULT_PAGE_SIZE as LEADS_PAGE_SIZE };
