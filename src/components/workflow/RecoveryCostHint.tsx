import { Clock3, DollarSign } from "lucide-react";

export function RecoveryCostHint({ awsMode }: { awsMode: boolean }) {
  if (!awsMode) return null;

  return (
    <section className="rounded-xl border border-sky-200 bg-sky-50/60 p-4 shadow-sm">
      <div className="flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
          <DollarSign size={18} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-sky-950">What an AWS restore drill does</h2>
          <p className="mt-1 text-sm text-sky-900/90">
            A snapshot cannot run database checks by itself.{" "}
            <strong>Verify snapshot</strong> restores your latest existing snapshot into a temporary
            RDS database, runs the configured checks against it, then requests deletion. It does
            not create a new snapshot.{" "}
            <strong>Run restore drill</strong> first checks the live database and creates a new
            manual snapshot, then performs that same restore-and-check.
          </p>
          <ul className="mt-2 space-y-1 text-xs text-sky-900/80">
            <li>• The full drill's new manual snapshot remains in AWS and may incur storage charges.</li>
            <li>• The temporary RDS class is configurable; it defaults to db.t4g.micro.</li>
            <li>• AWS time and charges vary by snapshot size, region, storage, and instance class; there is no guaranteed fixed price or completion time.</li>
            <li>• Cleanup requests deletion after checks. AWS deletion can take time; check run results if cleanup is reported as failed.</li>
          </ul>
          <div className="mt-3 flex items-start gap-2 border-t border-sky-200 pt-3 text-xs text-sky-900/80">
            <Clock3 size={14} className="mt-0.5 shrink-0" />
            <p>
              AWS can take several minutes to create or restore a database. Each snapshot/restore
              wait is limited to 30 minutes; a full drill can take an hour or more. The background
              panel reports the current stage and elapsed time.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
