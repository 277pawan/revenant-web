import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Play, Plus, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { useToast } from "./toast/ToastProvider";
import type { RecoveryChallengeResource } from "../types/api";

type RecoveryChallengesPanelProps = {
  databaseId: string;
  canRun: boolean;
  refreshToken?: number;
};

export function RecoveryChallengesPanel({
  databaseId,
  canRun,
  refreshToken = 0,
}: RecoveryChallengesPanelProps) {
  const toast = useToast();
  const [challenges, setChallenges] = useState<RecoveryChallengeResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [strategy, setStrategy] = useState<"latest" | "days_ago">("days_ago");
  const [daysAgo, setDaysAgo] = useState(7);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { challenges: data } = await api.listRecoveryChallenges(databaseId);
      setChallenges(data);
    } catch {
      setChallenges([]);
    } finally {
      setLoading(false);
    }
  }, [databaseId]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  async function createChallenge() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.createRecoveryChallenge(databaseId, {
        name: name.trim(),
        strategy,
        daysAgo: strategy === "days_ago" ? daysAgo : undefined,
      });
      toast.success("Challenge saved", "Run it anytime to prove an older backup point.");
      setShowForm(false);
      setName("");
      await load();
    } catch (err) {
      toast.error("Could not save", err instanceof Error ? err.message : "Try again");
    } finally {
      setSaving(false);
    }
  }

  async function runChallenge(id: string) {
    setRunningId(id);
    try {
      const { jobId } = await api.runRecoveryChallenge(id);
      toast.success("Challenge queued", "Track progress in execution history.");
      await load();
      window.location.hash = "workflow-execution-history";
      void jobId;
    } catch (err) {
      toast.error("Run failed", err instanceof Error ? err.message : "Try again");
    } finally {
      setRunningId(null);
    }
  }

  async function deleteChallenge(id: string) {
    try {
      await api.deleteRecoveryChallenge(id);
      toast.success("Removed", "Challenge deleted.");
      await load();
    } catch (err) {
      toast.error("Delete failed", err instanceof Error ? err.message : "Try again");
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">Recovery challenges</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Prove older backup points recover — not just the latest snapshot.
          </p>
        </div>
        {canRun && (
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Plus size={14} />
            Add challenge
          </button>
        )}
      </div>

      {showForm && canRun && (
        <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-600">
              Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="7-day backup point"
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Strategy
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as "latest" | "days_ago")}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="latest">Latest snapshot</option>
                <option value="days_ago">N days ago</option>
              </select>
            </label>
            {strategy === "days_ago" && (
              <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
                Days ago
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={daysAgo}
                  onChange={(e) => setDaysAgo(Number(e.target.value))}
                  className="mt-1 w-full max-w-[120px] rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
              </label>
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={saving || !name.trim()}
              onClick={() => void createChallenge()}
              className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save challenge"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={14} className="animate-spin" />
          Loading challenges…
        </div>
      ) : challenges.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          No challenges yet. Add one to schedule proof that backups from last week still
          restore.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {challenges.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <div className="font-medium text-slate-900">{c.name}</div>
                <div className="text-xs text-slate-500">
                  {c.strategy === "days_ago"
                    ? `Restore from ${c.daysAgo} day${c.daysAgo === 1 ? "" : "s"} ago`
                    : "Latest snapshot"}
                  {c.lastStatus ? ` · last run: ${c.lastStatus}` : ""}
                </div>
                {c.lastJobId && (
                  <Link
                    to={`/workflows/${databaseId}/runs/${c.lastJobId}`}
                    className="text-xs text-brand hover:underline"
                  >
                    View last run
                  </Link>
                )}
              </div>
              <div className="flex items-center gap-1">
                {canRun && (
                  <button
                    type="button"
                    disabled={runningId === c.id}
                    onClick={() => void runChallenge(c.id)}
                    className="rounded-md border border-slate-300 p-2 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    title="Run challenge"
                  >
                    {runningId === c.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Play size={14} />
                    )}
                  </button>
                )}
                {canRun && (
                  <button
                    type="button"
                    onClick={() => void deleteChallenge(c.id)}
                    className="rounded-md border border-slate-300 p-2 text-red-600 hover:bg-red-50"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
