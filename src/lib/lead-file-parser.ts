import * as XLSX from "xlsx";
import type { CompanyLeadInput } from "../types/company-leads";

const HEADER_ALIASES: Record<string, keyof CompanyLeadInput | "ignore"> = {
  first_name: "first_name",
  firstname: "first_name",
  first: "first_name",
  "first name": "first_name",
  last_name: "last_name",
  lastname: "last_name",
  last: "last_name",
  "last name": "last_name",
  phone: "phone",
  mobile: "phone",
  cell: "phone",
  telephone: "phone",
  email: "email",
  "e-mail": "email",
  cdl: "cdl_class",
  cdl_class: "cdl_class",
  "cdl class": "cdl_class",
  class: "cdl_class",
  state: "state",
  experience: "years_experience",
  years: "years_experience",
  years_experience: "years_experience",
  "years experience": "years_experience",
  "years of experience": "years_experience",
  endorsements: "endorsements",
  endorsement: "endorsements",
  driver_type: "driver_type",
  "driver type": "driver_type",
  type: "driver_type",
  notes: "notes_preview",
  note: "notes_preview",
  comments: "notes_preview"
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, " ");
}

function mapHeader(h: string): keyof CompanyLeadInput | null {
  const key = HEADER_ALIASES[normalizeHeader(h)];
  if (!key || key === "ignore") return null;
  return key;
}

function cellStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function cellNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function rowToLead(row: Record<string, unknown>, headerMap: Map<string, keyof CompanyLeadInput>): CompanyLeadInput | null {
  const out: CompanyLeadInput = { first_name: "", last_name: "" };
  for (const [rawKey, value] of Object.entries(row)) {
    const field = headerMap.get(rawKey) ?? mapHeader(rawKey);
    if (!field) continue;
    if (field === "years_experience") {
      out.years_experience = cellNum(value);
    } else if (field === "first_name" || field === "last_name") {
      out[field] = cellStr(value);
    } else {
      (out as Record<string, unknown>)[field] = cellStr(value) || undefined;
    }
  }

  // Support single "name" column
  if (!out.first_name && !out.last_name) {
    const nameKey = Object.keys(row).find((k) => ["name", "full name", "driver", "driver name"].includes(normalizeHeader(k)));
    if (nameKey) {
      const parts = cellStr(row[nameKey]).split(/\s+/);
      out.first_name = parts[0] ?? "";
      out.last_name = parts.slice(1).join(" ");
    }
  }

  if (!out.first_name.trim() && !out.last_name.trim()) return null;
  if (!out.first_name.trim()) out.first_name = "Driver";
  if (!out.cdl_class) out.cdl_class = "Class A";
  return out;
}

export function parseLeadSpreadsheet(file: ArrayBuffer, fileName: string): CompanyLeadInput[] {
  const workbook = XLSX.read(file, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (!rows.length) return [];

  const headerMap = new Map<string, keyof CompanyLeadInput>();
  for (const key of Object.keys(rows[0])) {
    const mapped = mapHeader(key);
    if (mapped) headerMap.set(key, mapped);
  }

  const leads: CompanyLeadInput[] = [];
  for (const row of rows) {
    const lead = rowToLead(row, headerMap);
    if (lead) leads.push(lead);
  }

  if (!leads.length && fileName.toLowerCase().endsWith(".csv")) {
    // fallback already covered by sheet_to_json
  }
  return leads;
}

export async function parseLeadFile(file: File): Promise<CompanyLeadInput[]> {
  const buf = await file.arrayBuffer();
  return parseLeadSpreadsheet(buf, file.name);
}
