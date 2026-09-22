import { DEVELOPMENT_URLS, PRODUCTION_URLS } from "./env.defaults";

const defaults = import.meta.env.PROD ? PRODUCTION_URLS : DEVELOPMENT_URLS;

const API_URL =
  import.meta.env.VITE_API_URL?.trim().replace(/\/$/, "") || defaults.apiUrl;
const APP_URL =
  import.meta.env.VITE_SITE_URL?.trim().replace(/\/$/, "") || defaults.appUrl;
const MARKETING_URL =
  import.meta.env.VITE_MARKETING_URL?.trim().replace(/\/$/, "") ||
  defaults.marketingUrl;

export const site = {
  name: "Revenant Cloud",
  apiUrl: API_URL,
  appUrl: APP_URL,
  marketingUrl: MARKETING_URL,
  docsUrl: `${MARKETING_URL}/docs`,
  cliUrl: `${MARKETING_URL}/cli`,
  pricingUrl: `${MARKETING_URL}/pricing`,
  talkUrl: `${MARKETING_URL}/talk`,
  githubCli: "https://github.com/277pawan/revenant-cli",
  githubAction: "https://github.com/277pawan/revenant-action",
} as const;

export function marketingLink(path = ""): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${site.marketingUrl}${p}`;
}
