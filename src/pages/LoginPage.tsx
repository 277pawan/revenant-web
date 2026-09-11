import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useToast } from "../components/toast/ToastProvider";

export function LoginPage() {
  const { user, login, register } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login({ email, password });
        toast.success("Welcome back", "Your control plane session is ready.");
      } else {
        await register({ organizationName: orgName, email, password });
        toast.success("Organization created", "You’re signed in and ready to add a database.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed";
      setError(message);
      toast.error(mode === "login" ? "Sign-in failed" : "Registration failed", message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-brand font-bold text-white">
            R
          </div>
          <span className="text-lg font-semibold">Revenant Cloud</span>
        </div>

        <h1 className="text-xl font-semibold">Sign in to your control plane</h1>
        <p className="mt-1 text-sm text-slate-600">
          Orchestrate restore drills and prove every PostgreSQL backup is recoverable.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === "register" && (
            <div>
              <label className="mb-1 block text-sm font-medium">Organization name</label>
              <input
                type="text"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium">Work email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-brand py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-600">
          {mode === "login" ? (
            <>
              First time?{" "}
              <button type="button" className="text-brand underline" onClick={() => setMode("register")}>
                Create organization
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button type="button" className="text-brand underline" onClick={() => setMode("login")}>
                Sign in
              </button>
            </>
          )}
        </p>

        <p className="mt-6 text-center text-xs text-slate-500">
          <Link to="/">Need access? Contact your organization administrator.</Link>
        </p>
      </div>
    </div>
  );
}
