import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, MailCheck } from "lucide-react";
import { AuthShellLayout } from "../components/auth/AuthShellLayout";
import { api } from "../lib/api";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShellLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reset password</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Enter your work email and we&apos;ll send a secure reset link that expires in one hour.
        </p>
      </div>

      {sent ? (
        <div className="auth-success-bloom rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-5 text-sm text-slate-700">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <MailCheck size={20} />
          </div>
          <p className="font-medium text-slate-900">Check your inbox</p>
          <p className="mt-2">
            If an account exists for <strong>{email}</strong>, we sent a reset link.
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Check spam if it doesn&apos;t arrive in a few minutes.
          </p>
          <Link
            to="/login"
            className="mt-5 inline-block text-sm font-medium text-brand hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
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
              placeholder="you@company.com"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm transition-all focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
            />
          </div>
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-sm shadow-blue-500/20 transition-all duration-200 hover:bg-blue-700 hover:shadow-md active:scale-[0.99] disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : "Send reset link"}
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
