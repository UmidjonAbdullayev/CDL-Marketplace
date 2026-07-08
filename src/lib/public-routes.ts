/** Routes visitors can browse without signing in. */
export function isPublicBrowsePath(pathname: string): boolean {
  if (pathname === "/" || pathname === "/marketplace") return true;
  if (pathname.startsWith("/apply/")) return true;
  return pathname.startsWith("/driver/");
}

export function registerReturnPath(pathname: string, search = ""): string {
  const path = `${pathname}${search}`;
  return path.startsWith("/register") ? "/marketplace" : path;
}
