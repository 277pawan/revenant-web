import { useEffect } from "react";
import { Copy, ExternalLink, X } from "lucide-react";
import { Link } from "react-router-dom";
import { DateTimeText } from "./DateTimeText";
import {
  auditEventLink,
  auditResourceLabel,
  formatAuditAction,
  metadataEntries,
} from "../lib/audit";
import { formatDateTimeUtc } from "../lib/datetime";
import type { AuditEventResource } from "../types/api";

type Props = {
  event: AuditEventResource | null;
  onClose: () => void;
  onCopy: (label: string, value: string) => void;
};

function CopyableId({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: (label: string, value: string) => void;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 flex items-start justify-between gap-2">
        <code className="break-all text-xs text-slate-900">{value}</code>
        <button
          type="button"
          onClick={() => onCopy(label, value)}
          className="shrink-0 rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700"
          title={`Copy ${label}`}
        >
          <Copy size={14} />
        </button>
      </div>
    </div>
  );
}

export function AuditEventDetailDialog({ event, onClose, onCopy }: Props) {
  useEffect(() => {
    if (!event) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [event, onClose]);

  if (!event) return null;

  const relatedLink = auditEventLink(event);
  const metaRows = metadataEntries(event.metadata);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog backdrop"
        className="absolute inset-0 bg-slate-900/50"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-detail-title"
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="audit-detail-title" className="text-lg font-semibold text-slate-900">
              Audit event
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              {formatAuditAction(event.action)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto px-5 py-4">
          <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
            <span className="text-slate-500">When</span>
            <div className="mt-0.5 font-medium text-slate-900">
              <DateTimeText value={event.createdAt} />
            </div>
            <div className="mt-0.5 text-xs text-slate-400">
              UTC: {formatDateTimeUtc(event.createdAt)}
            </div>
          </div>

          <CopyableId label="Event ID" value={event.id} onCopy={onCopy} />
          <CopyableId label="Resource ID" value={event.resourceId} onCopy={onCopy} />

          {event.actorUserId && (
            <CopyableId label="Actor user ID" value={event.actorUserId} onCopy={onCopy} />
          )}

          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Resource
            </span>
            <div className="mt-1 text-slate-900">
              {auditResourceLabel(event.resourceType)}{" "}
              <span className="font-mono text-xs text-slate-500">({event.resourceType})</span>
            </div>
          </div>

          {metaRows.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                Metadata
              </div>
              <dl className="space-y-2">
                {metaRows.map((row) => (
                  <div
                    key={row.key}
                    className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <dt className="text-xs font-medium text-slate-500">{row.key}</dt>
                    <dd className="mt-0.5 flex items-start justify-between gap-2">
                      <code className="break-all text-xs text-slate-800">{row.value}</code>
                      <button
                        type="button"
                        onClick={() => onCopy(row.key, row.value)}
                        className="shrink-0 rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700"
                        title={`Copy ${row.key}`}
                      >
                        <Copy size={14} />
                      </button>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {relatedLink && (
            <Link
              to={relatedLink}
              onClick={onClose}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
            >
              <ExternalLink size={14} />
              Open related resource
            </Link>
          )}
        </div>

        <div className="border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
