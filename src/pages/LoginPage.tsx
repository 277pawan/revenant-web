import { useCallback, useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { Building2, Loader2, Shield } from "lucide-react";
import { AuthBrandPanel } from "../components/auth/AuthBrandPanel";
import { AuthSuccessOverlay } from "../components/auth/AuthSuccessOverlay";
import { OAuthButtons } from "../components/auth/OAuthButtons";
import { PasswordField } from "../components/auth/PasswordField";
import { RevenantMark } from "../components/auth/RevenantMark";
import { useToast } from "../components/toast/ToastProvider";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { getPlanDefinition } from "../lib/plans";
import type {
  AuthProviderInfo,
  AuthProvidersResponse,
  InvitePreviewResponse,
} from "../types/api";

type AuthMode = "login" | "register";

export function LoginPage() {
  const { user, login, register } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialMode = searchParams.get("mode") === "register" ? "register" : "login";
  const inviteToken = searchParams.get("invite");

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const [authConfig, setAuthConfig] = useState<AuthProvidersResponse | null>(null);
  const [invite, setInvite] = useState<InvitePreviewResponse | null>(null);

  const loadAuthMeta = useCallback(async () => {
    try {
      const config = await api.getAuthProviders();
      setAuthConfig(config);
    } catch {
      setAuthConfig({
        providers: [
          { id: "google", label: "Google", status: "coming_soon" },
          { id: "github", label: "GitHub", status: "coming_soon" },
          { id: "microsoft", label: "Microsoft", status: "coming_soon" },
        ],
        passwordLoginEnabled: true,
        openRegistration: true,
      });
    }
  }, []);

  useEffect(() => {
    void loadAuthMeta();
  }, [loadAuthMeta]);

  useEffect(() => {
    if (!inviteToken) {
      setInvite(null);
      return;
    }
    void api
      .getInvitePreview(inviteToken)
      .then(({ invite: data }) => {
        setInvite(data);
        setEmail(data.email);
        setMode("login");
      })
      .catch(() => setInvite(null));
  }, [inviteToken]);

  useEffect(() => {
    if (initialMode === "register" && authConfig && !authConfig.openRegistration) {
      setMode("login");
    }
  }, [initialMode, authConfig]);

  function switchMode(next: AuthMode) {
    setMode(next);
    setError("");
    const nextParams = new URLSearchParams(searchParams);
    if (next === "register") nextParams.set("mode", "register");
    else nextParams.delete("mode");
    setSearchParams(nextParams, { replace: true });
  }

  if (user && !success) return <Navigate to="/" replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login({ email, password });
        setSuccessMessage("Welcome back — loading your fleet posture…");
      } else {
        await register({ organizationName: orgName, email, password });
        setSuccessMessage("Organization created — let's prove your first restore…");
      }
      setSuccess(true);
      toast.success(
        mode === "login" ? "Signed in" : "Organization ready",
        mode === "login"
          ? "Your control plane session is active."
          : "Add a database to run your first drill."
      );
      window.setTimeout(() => {
        window.location.href = "/";
      }, 1400);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed";
      setError(message);
      setShake(true);
      window.setTimeout(() => setShake(false), 450);
      toast.error(mode === "login" ? "Sign-in failed" : "Registration failed", message);
    } finally {
      setLoading(false);
    }
  }

  const providers: AuthProviderInfo[] = authConfig?.providers ?? [];
  const canRegister = authConfig?.openRegistration ?? true;
  const starterPlan = getPlanDefinition("starter");

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AuthBrandPanel />

      <div className="auth-form-panel flex min-h-screen w-full shrink-0 flex-col justify-center px-6 py-10 sm:px-10 lg:w-[40%] lg:px-12 xl:px-14">
        <div className="mx-auto w-full max-w-[400px]">
          {/* Mobile brand */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <RevenantMark size="md" glow />
            <div>
              <div className="font-semibold text-slate-900">Revenant Cloud</div>
              <div className="text-xs text-slate-500">DR proof control plane</div>
            </div>
          </div>

          {invite && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              <Building2 size={18} className="mt-0.5 shrink-0 text-blue-600" />
              <div>
                <p className="font-medium">You&apos;re joining {invite.organizationName}</p>
                <p className="mt-0.5 text-xs text-blue-800/80">
                  Sign in as <span className="font-medium">{invite.email}</span> · role:{" "}
                  {invite.role}
                </p>
              </div>
            </div>
          )}

          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {mode === "login" ? "Sign in to your control plane" : "Create your organization"}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {mode === "login"
                ? "Orchestrate restore drills and prove every backup is recoverable."
                : "You'll be the admin. Invite teammates after your first restore drill."}
            </p>
          </div>

          <OAuthButtons
            providers={providers}
            onUnavailable={(label) =>
              toast.info(`${label} sign-in`, "Coming soon — use email and password for now.")
            }
          />

          <form
            onSubmit={handleSubmit}
            className={`mt-6 space-y-4 ${shake ? "auth-form-shake" : ""}`}
          >
            <div className="auth-expand-grid" data-open={mode === "register"}>
              <div className="auth-expand-inner">
                <div className="space-y-4 pb-4">
                  <div>
                    <label
                      htmlFor="orgName"
                      className="mb-1.5 block text-sm font-medium text-slate-700"
                    >
                      Organization name
                    </label>
                    <input
                      id="orgName"
                      type="text"
                      required={mode === "register"}
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="Acme Engineering"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm transition-all focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                    />
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <Shield size={14} className="shrink-0 text-brand" />
                    <span>
                      Starts on <strong>{starterPlan.name}</strong> ({starterPlan.priceLabel}) —
                      billing via website later
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                Work email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                readOnly={!!invite}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm transition-all focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 read-only:bg-slate-50 read-only:text-slate-600"
              />
            </div>

            <PasswordField
              id="password"
              label="Password"
              value={password}
              onChange={setPassword}
              showStrength={mode === "register"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              invalid={!!error}
            />

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || success}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-sm shadow-blue-500/20 transition-all duration-200 hover:bg-blue-700 hover:shadow-md active:scale-[0.99] disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Please wait…
                </>
              ) : mode === "login" ? (
                "Sign in with email"
              ) : (
                "Create organization"
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-600">
            {mode === "login" ? (
              canRegister ? (
                <>
                  First time here?{" "}
                  <button
                    type="button"
                    className="font-medium text-brand hover:underline"
                    onClick={() => switchMode("register")}
                  >
                    Create your organization
                  </button>
                </>
              ) : (
                <span className="text-slate-500">Registration is invite-only.</span>
              )
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  className="font-medium text-brand hover:underline"
                  onClick={() => switchMode("login")}
                >
                  Sign in
                </button>
              </>
            )}
          </p>

          <p className="mt-8 text-center text-xs text-slate-400">
            Need access? Ask your organization administrator.
            <span className="mt-1 block font-mono text-slate-400">
              Already have the CLI?{" "}
              <span className="text-brand">revenant verify</span>
            </span>
          </p>
        </div>
      </div>

      <AuthSuccessOverlay visible={success} message={successMessage} />
    </div>
  );
}
