import type { AuthUser } from "../types/api";
import { site } from "./site";

/** Cloud dashboard requires ₹1 autopay setup on the marketing site. */
export function canAccessCloudDashboard(
  user: Pick<AuthUser, "autopaySetup"> | null | undefined
): boolean {
  return user?.autopaySetup === true;
}

export function websiteBillingUrl(token?: string | null): string {
  const base = `${site.marketingUrl}/billing`;
  if (!token) return base;
  return `${base}#token=${encodeURIComponent(token)}`;
}

export function redirectToWebsiteBilling(): void {
  const token = localStorage.getItem("revenant_token");
  window.location.href = websiteBillingUrl(token);
}
