import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { OAUTH_MESSAGE_TYPE } from "../lib/oauth-popup";
import { api } from "../lib/api";
import { canAccessCloudDashboard } from "../lib/subscription-access";
import { site } from "../lib/site";

export function OAuthCompletePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState("Completing sign-in…");

  useEffect(() => {
    const popup = searchParams.get("popup") === "1";
    const oauthError = searchParams.get("oauth_error");

    if (oauthError) {
      if (popup && window.opener) {
        window.opener.postMessage(
          { type: OAUTH_MESSAGE_TYPE, error: oauthError },
          window.location.origin
        );
        window.close();
        return;
      }
      navigate(`/login?oauth_error=${encodeURIComponent(oauthError)}`, { replace: true });
      return;
    }

    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = hash.get("token");

    if (!token) {
      const err = "Sign-in failed. Please try again.";
      if (popup && window.opener) {
        window.opener.postMessage({ type: OAUTH_MESSAGE_TYPE, error: err }, window.location.origin);
        window.close();
        return;
      }
      navigate(`/login?oauth_error=${encodeURIComponent(err)}`, { replace: true });
      return;
    }

    localStorage.setItem("revenant_token", token);

    if (popup && window.opener) {
      window.opener.postMessage({ type: OAUTH_MESSAGE_TYPE, token }, window.location.origin);
      setMessage("Signed in — closing…");
      window.close();
      return;
    }

    void (async () => {
      try {
        const { user } = await api.me();
        if (!canAccessCloudDashboard(user)) {
          setMessage("Starter trial required — redirecting…");
          window.location.href = `${site.marketingUrl}/trial-ended`;
          return;
        }
        setMessage("Signed in — opening dashboard…");
        navigate("/", { replace: true });
      } catch {
        navigate(`/login?oauth_error=${encodeURIComponent("Sign-in failed")}`, {
          replace: true,
        });
      }
    })();
  }, [navigate, searchParams]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 text-slate-600">
      <Loader2 className="h-8 w-8 animate-spin text-brand" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
