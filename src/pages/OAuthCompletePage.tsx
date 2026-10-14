import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { OAUTH_MESSAGE_TYPE } from "../lib/oauth-popup";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { canAccessCloudDashboard, websiteBillingUrl } from "../lib/subscription-access";

export function OAuthCompletePage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState("Completing sign-in…");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const popup = searchParams.get("popup") === "1";
    const oauthError = searchParams.get("oauth_error");

    if (oauthError) {
      if (oauthError === "Sign-in failed. Please try again.") {
        void api.sessionToken().then(
          ({ token }) => finishSignIn(token),
          () => showSignInError(oauthError)
        );
      } else {
        showSignInError(oauthError);
      }
      return;
    }

    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    let token = hash.get("token");

    if (!token) {
      void (async () => {
        try {
          const session = await api.sessionToken();
          finishSignIn(session.token);
        } catch {
          showSignInError("Sign-in failed. Please try again.");
        }
      })();
      return;
    }

    finishSignIn(token);

    function showSignInError(error: string) {
      if (popup && window.opener) {
        window.opener.postMessage(
          { type: OAUTH_MESSAGE_TYPE, error },
          window.location.origin
        );
        window.close();
        return;
      }
      navigate(`/login?oauth_error=${encodeURIComponent(error)}`, { replace: true });
    }

    function finishSignIn(sessionToken: string) {
      localStorage.setItem("revenant_token", sessionToken);

      if (popup && window.opener) {
        window.opener.postMessage(
          { type: OAUTH_MESSAGE_TYPE, token: sessionToken },
          window.location.origin
        );
        setMessage("Signed in — closing…");
        window.close();
        return;
      }

      void (async () => {
        try {
          const user = await refreshUser();
          if (!user) {
            navigate(`/login?oauth_error=${encodeURIComponent("Sign-in failed")}`, {
              replace: true,
            });
            return;
          }
          if (!canAccessCloudDashboard(user)) {
            setMessage("Complete billing on the website…");
            window.location.href = websiteBillingUrl(sessionToken);
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
    }
  }, [navigate, refreshUser, searchParams]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 text-slate-600">
      <Loader2 className="h-8 w-8 animate-spin text-brand" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
