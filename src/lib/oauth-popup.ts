const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

export const OAUTH_COMPLETE_PATH = "/auth/oauth/complete";
export const OAUTH_MESSAGE_TYPE = "revenant:oauth";

const POPUP_FEATURES = "popup=yes,width=520,height=720,left=100,top=24";

export function buildOAuthStartUrl(
  authorizePath: string,
  inviteToken?: string | null
): string {
  const params = new URLSearchParams();
  params.set("returnTo", `${window.location.origin}${OAUTH_COMPLETE_PATH}`);
  params.set("popup", "1");
  if (inviteToken) params.set("invite", inviteToken);
  return `${API_URL}${authorizePath}?${params.toString()}`;
}

export function openOAuthPopup(
  authorizePath: string,
  inviteToken?: string | null
): Window | null {
  const url = buildOAuthStartUrl(authorizePath, inviteToken);
  return window.open(url, "revenant_oauth", POPUP_FEATURES);
}

export type OAuthPopupResult =
  | { ok: true; token: string }
  | { ok: false; error: string };

export function waitForOAuthPopupMessage(): Promise<OAuthPopupResult> {
  return new Promise((resolve) => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== OAUTH_MESSAGE_TYPE) return;
      window.removeEventListener("message", handler);
      if (event.data.error) {
        resolve({ ok: false, error: String(event.data.error) });
        return;
      }
      if (event.data.token) {
        resolve({ ok: true, token: String(event.data.token) });
        return;
      }
      resolve({ ok: false, error: "Sign-in failed. Please try again." });
    };
    window.addEventListener("message", handler);
  });
}
