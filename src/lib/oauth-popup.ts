import { site } from "./site";

const API_URL = site.apiUrl;

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

export function waitForOAuthPopupMessage(popup: Window): Promise<OAuthPopupResult> {
  return new Promise((resolve) => {
    let closeTimeout: number | undefined;
    let closePoll: number;
    let handler: (event: MessageEvent) => void;

    const finish = (result: OAuthPopupResult) => {
      window.removeEventListener("message", handler);
      window.clearInterval(closePoll);
      if (closeTimeout !== undefined) window.clearTimeout(closeTimeout);
      resolve(result);
    };

    handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== OAUTH_MESSAGE_TYPE) return;
      if (event.data.error) {
        finish({ ok: false, error: String(event.data.error) });
        return;
      }
      if (event.data.token) {
        finish({ ok: true, token: String(event.data.token) });
        return;
      }
      finish({ ok: false, error: "Sign-in failed. Please try again." });
    };

    closePoll = window.setInterval(() => {
      if (!popup.closed || closeTimeout !== undefined) return;
      closeTimeout = window.setTimeout(() => {
        finish({
          ok: false,
          error: "Sign-in window was closed before sign-in completed.",
        });
      }, 1000);
    }, 250);

    window.addEventListener("message", handler);
  });
}
