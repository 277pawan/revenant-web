import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

/** In-page guide for how Custom HTTP integrations work. */
export function CustomHttpGuide() {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-700">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left font-medium text-slate-900"
      >
        How Custom HTTP works
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div className="space-y-3 border-t border-slate-200 px-4 py-3 text-xs leading-relaxed sm:text-sm">
          <p>
            <strong>1. You host an endpoint</strong> — a URL on your server, or a catch URL from
            Zapier / Make / n8n that accepts <code className="rounded bg-white px-1">POST</code>.
          </p>
          <p>
            <strong>2. You paste that URL here</strong> when connecting. When a validation job
            finishes (pass / fail / error), Revenant sends JSON to that URL.
          </p>
          <p>
            <strong>3. Copy the signing secret</strong> shown once after connect. On your server,
            verify header <code className="rounded bg-white px-1">X-Revenant-Signature</code>{" "}
            equals <code className="rounded bg-white px-1">sha256=</code> + HMAC-SHA256 of the raw
            body using that secret. Reject requests that don&apos;t match.
          </p>
          <p>
            <strong>4. Payload shape</strong> —{" "}
            <code className="block mt-1 overflow-x-auto rounded bg-white p-2 font-mono text-[11px] sm:text-xs">
              {`{ "event": "job.pass", "job": { "id", "databaseName", "status", ... }, "sentAt" }`}
            </code>
          </p>
          <p className="text-slate-500">
            No secret verification needed for Slack or Email — only Custom HTTP uses the signing
            secret.
          </p>
        </div>
      )}
    </div>
  );
}
