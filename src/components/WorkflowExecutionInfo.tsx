import { Cloud, Container, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { getPlanDefinition, planAllowsSelfHostedAgent } from "../lib/plans";
import type { OrganizationPlan, PlanServiceResource } from "../types/api";

export function WorkflowExecutionInfo({
  plan,
  service,
}: {
  plan: OrganizationPlan;
  service: PlanServiceResource;
}) {
  const def = getPlanDefinition(plan);
  const agentOnline =
    service.runner?.lastSeenAt &&
    Date.now() - new Date(service.runner.lastSeenAt).getTime() < 60_000;
  const needsPrivateAgent = planAllowsSelfHostedAgent(plan);
  const parallel = def.parallelRestoreDrills ?? 1;

  return (
    <section className="mb-6 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-slate-700">
      <div className="flex gap-2">
        <Info size={16} className="mt-0.5 shrink-0 text-brand" />
        <div className="min-w-0 space-y-2">
          <p className="font-medium text-slate-900">How drills run on {def.name}</p>

          {def.managedCloudDrills && !needsPrivateAgent && (
            <p className="flex items-start gap-2 text-slate-600">
              <Cloud size={14} className="mt-0.5 shrink-0" />
              <span>
                <strong>No Docker required.</strong> Revenant&apos;s cloud API picks up queued
                drills automatically (managed runner). Starter runs{" "}
                <strong>{parallel} drill{parallel === 1 ? "" : "s"} at a time</strong> — wait for
                the current run to finish before starting another.
              </span>
            </p>
          )}

          {needsPrivateAgent && (
            <p className="flex items-start gap-2 text-slate-600">
              <Container size={14} className="mt-0.5 shrink-0" />
              <span>
                AWS RDS drills still run on Revenant cloud ({parallel} parallel max). Use the{" "}
                <Link to="/settings/runners" className="font-medium text-brand hover:underline">
                  Docker agent
                </Link>{" "}
                only when Postgres is private inside your VPC.
                {agentOnline
                  ? " Agent is online."
                  : " Agent is offline — private-network drills will stay queued."}
              </span>
            </p>
          )}

          <p className="text-xs text-slate-500">
            While a drill runs, other dashboard requests may be slow on a small local API — that is
            normal. Production Cloud Run should use 2&nbsp;GiB RAM and a 60&nbsp;min timeout. Editing
            validation plans or contracts does not block the API; only the active drill is heavy.
          </p>
        </div>
      </div>
    </section>
  );
}
