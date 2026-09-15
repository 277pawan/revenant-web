import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { AuthShellLayout } from "../components/auth/AuthShellLayout";
import { PasswordField } from "../components/auth/PasswordField";
import { api } from "../lib/api";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setError("Missing reset token. Request a new link.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShellLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Choose a new password</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Pick a strong password for your Revenant Cloud account.
        </p>
      </div>

      {done ? (
        <div className="auth-success-bloom rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-5 text-sm text-slate-700">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 size={20} />
          </div>
          <p className="font-medium text-slate-900">Password updated</p>
          <p className="mt-2">You can sign in with your new password.</p>
          <Link
            to="/login"
            className="mt-5 inline-block text-sm font-medium text-brand hover:underline"
          >
            Sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {!token && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              This link is missing a reset token.{" "}
              <Link to="/forgot-password" className="font-medium text-brand hover:underline">
                Request a new one
              </Link>
              .
            </p>
          )}
          <PasswordField
            id="password"
            label="New password"
            value={password}
            onChange={setPassword}
            showStrength
            autoComplete="new-password"
            invalid={!!error}
          />
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !token}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-sm shadow-blue-500/20 transition-all duration-200 hover:bg-blue-700 hover:shadow-md active:scale-[0.99] disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : "Update password"}
          </button>
          <p className="text-center text-sm text-slate-600">
            <Link to="/login" className="font-medium text-brand hover:underline">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AuthShellLayout>
  );
}
