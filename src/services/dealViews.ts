import { isPlatformStaff } from "../lib/account-capabilities";
import type { SessionUser } from "../lib/session";
import { fetchOngoingDeals } from "./hiring";

function storageKey(companyId: string): string {
  return `cdl_deal_views_${companyId}`;
}

export function readDealViews(companyId: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(storageKey(companyId)) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function markDealViewed(companyId: string, dealId: string): void {
  const views = readDealViews(companyId);
  views[dealId] = new Date().toISOString();
  localStorage.setItem(storageKey(companyId), JSON.stringify(views));
}

export function markOngoingDealsViewed(companyId: string, dealIds: string[]): void {
  if (!dealIds.length) return;
  const views = readDealViews(companyId);
  const now = new Date().toISOString();
  for (const id of dealIds) views[id] = now;
  localStorage.setItem(storageKey(companyId), JSON.stringify(views));
}

export function countUnviewedDeals(
  deals: { id: string; updated_at: string }[],
  companyId: string
): number {
  const views = readDealViews(companyId);
  return deals.filter((d) => {
    const lastView = views[d.id] ? new Date(views[d.id]).getTime() : 0;
    return new Date(d.updated_at).getTime() > lastView;
  }).length;
}

export async function fetchOngoingDealsUnreadCount(user: SessionUser | null): Promise<number> {
  if (!user?.companyId) return 0;
  const platformWide = isPlatformStaff(user);
  const deals = await fetchOngoingDeals({ platformWide });
  return countUnviewedDeals(deals, user.companyId);
}
