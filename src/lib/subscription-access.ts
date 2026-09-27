import type { AuthUser } from "../types/api";
import { site } from "./site";

/** Cloud dashboard requires ₹1 autopay setup on the marketing site. */
export function canAccessCloudDashboard(
  user: Pick<AuthUser, "autopaySetup"> | null | undefined
): boolean {
  return user?.autopaySetup === true;
}

export type WebsiteBillingOptions = {
  plan?: "pro";
  upgrade?: boolean;
  openCloud?: boolean;
};

export function websiteBillingUrl(
  token?: string | null,
  options?: WebsiteBillingOptions
): string {
  const url = new URL(`${site.marketingUrl}/billing`);
  if (options?.plan) url.searchParams.set("plan", options.plan);
  if (options?.upgrade) url.searchParams.set("upgrade", "1");
  if (options?.openCloud) url.searchParams.set("open", "cloud");
  const base = url.toString();
  if (!token) return base;
  return `${base}#token=${encodeURIComponent(token)}`;
}

export function redirectToWebsiteBilling(options?: WebsiteBillingOptions): void {
  const token = localStorage.getItem("revenant_token");
  window.location.href = websiteBillingUrl(token, options);
}
