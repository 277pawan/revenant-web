import { useState } from "react";
import { Check, Copy, X } from "lucide-react";

import { redisLocalRestoreCommands } from "../../lib/redis-format";

export function RedisRestoreDialog({
  fileName,
  onClose,
}: {
  fileName: string;
  onClose: () => void;
}) {
  const commands = redisLocalRestoreCommands(fileName);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(commands);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="redis-restore-title"
      onClick={onClose}
    >
      <div
        className="redis-panel-in w-full max-w-lg rounded-xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="redis-restore-title" className="text-sm font-semibold text-slate-900">
              Restore this snapshot
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              <code className="font-mono text-[11px] text-slate-700">{fileName}</code> is a
              binary Redis dump. Do not open it in an editor. Load it with redis-server.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </header>

        <div className="space-y-4 px-5 py-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Load on a spare port
              </p>
              <button
                type="button"
                onClick={() => void copy()}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="overflow-x-auto rounded-lg bg-slate-950 px-3 py-3 font-mono text-[11px] leading-relaxed text-slate-100">
              {commands}
            </pre>
            <p className="mt-2 text-xs text-slate-500">
              The server runs in the foreground. In a second terminal, run{" "}
              <code className="font-mono">redis-cli -p 6380 PING</code> and{" "}
              <code className="font-mono">redis-cli -p 6380 DBSIZE</code> to inspect it.
              Stop the temporary server with Ctrl+C. This does not write to production.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-relaxed text-slate-600">
            This safely loads the file into a separate local Redis on port 6380. Redis
            cannot import an RDB into a running server: for self-managed production,
            follow your outage/recovery procedure, stop the target, back up its current
            data directory, place this file there as <code className="font-mono">dump.rdb</code>,
            and restart it. For managed Redis, use the provider&apos;s supported restore
            workflow; do not replace a live data directory.
          </div>
        </div>
      </div>
    </div>
  );
}
