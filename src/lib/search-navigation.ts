/** Routes where a marketplace search must not steal navigation (e.g. admin console). */
const SEARCH_REDIRECT_BLOCKLIST = new Set([
  "/admin",
  "/settings",
  "/profile",
  "/pricing",
  "/compliance",
  "/sell",
  "/my-drivers",
  "/my-listings",
  "/messages",
  "/deals",
  "/disputes",
  "/ongoing-deals"
]);

export function blocksSearchRedirect(pathname: string): boolean {
  if (SEARCH_REDIRECT_BLOCKLIST.has(pathname)) return true;
  if (pathname.startsWith("/deals/")) return true;
  if (pathname.startsWith("/driver/")) return true;
  if (pathname.startsWith("/hiring/")) return true;
  return false;
}

export function shouldLaunchMarketplaceSearch(pathname: string, query: string): boolean {
  if (query.trim().length <= 2) return false;
  if (pathname === "/marketplace") return false;
  if (blocksSearchRedirect(pathname)) return false;
  return true;
}
