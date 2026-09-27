import { DollarSign } from "lucide-react";

export function RecoveryCostHint({ awsMode }: { awsMode: boolean }) {
  if (!awsMode) return null;

  return (
    <section className="rounded-xl border border-sky-200 bg-sky-50/60 p-4 shadow-sm">
      <div className="flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
          <DollarSign size={18} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-sky-950">Cost-aware drills</h2>
          <p className="mt-1 text-sm text-sky-900/90">
            AWS drills restore into a short-lived sandbox instance (typically{" "}
            <span className="font-medium">db.t3.micro</span> or free-tier eligible), run validation,
            then reap. Expect roughly{" "}
            <span className="font-medium">$0–2 per drill</span> depending on snapshot size and
            region — often $0 on free tier for light workloads.
          </p>
          <ul className="mt-2 space-y-1 text-xs text-sky-900/80">
            <li>• Use <strong>Verify snapshot</strong> for a cheaper pre-check without full restore</li>
            <li>• Scheduled drills keep cost predictable — one sandbox at a time per workflow</li>
            <li>• Sandboxes auto-reap after validation; no idle RDS left running</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
