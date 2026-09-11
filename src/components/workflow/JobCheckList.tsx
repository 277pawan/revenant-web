import { CheckCircle2, XCircle } from "lucide-react";
import type { JobResultResource } from "../../types/api";

function CheckRow({
  result,
  index,
  isLast,
}: {
  result: JobResultResource;
  index: number;
  isLast: boolean;
}) {
  const pass = result.status === "pass";
  const fail = result.status === "fail";

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${
            pass
              ? "border-emerald-500 bg-emerald-50 text-emerald-600"
              : fail
                ? "border-red-500 bg-red-50 text-red-600"
                : "border-slate-300 bg-white text-slate-400"
          }`}
        >
          {pass ? (
            <CheckCircle2 size={14} />
          ) : fail ? (
            <XCircle size={14} />
          ) : (
            <span className="text-[10px] font-medium">{index + 1}</span>
          )}
        </div>
        {!isLast && (
          <div
            className={`mt-0.5 w-0.5 min-h-[20px] flex-1 ${
              pass ? "bg-emerald-300" : fail ? "bg-red-300" : "bg-slate-200"
            }`}
          />
        )}
      </div>
      <div className="min-w-0 flex-1 pb-4">
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-xs font-medium text-slate-900">
              {result.checkName}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                pass
                  ? "bg-emerald-50 text-emerald-800"
                  : fail
                    ? "bg-red-50 text-red-800"
                    : "bg-slate-100 text-slate-600"
              }`}
            >
              {result.status}
            </span>
          </div>
          {result.message && (
            <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-slate-600">
              {result.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function JobCheckList({ results }: { results: JobResultResource[] }) {
  if (results.length === 0) return null;

  return (
    <div className="mt-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Verification checks
      </p>
      <div>
        {results.map((r, i) => (
          <CheckRow
            key={r.id}
            result={r}
            index={i}
            isLast={i === results.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
