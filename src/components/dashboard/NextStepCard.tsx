import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { marketingLink } from "../../lib/site";
import type { DashboardOnboardingStep } from "../../types/api";

type NextStepCardProps = {
  steps: DashboardOnboardingStep[];
};

export function NextStepCard({ steps }: NextStepCardProps) {
  const next = steps.find((s) => !s.done);
  if (!next) return null;

  const done = steps.filter((s) => s.done).length;
  const total = steps.length;
  const progress = Math.round((done / total) * 100);

  return (
    <section className="mb-5 overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-white shadow-sm">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-900">
            <Sparkles size={16} />
            Your next step ({done} of {total} complete)
          </div>
          <p className="mt-2 text-base font-medium text-slate-900">{next.label}</p>
          <div className="mt-3 h-2 max-w-xs overflow-hidden rounded-full bg-blue-100">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            to={next.href}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Continue setup
            <ArrowRight size={16} />
          </Link>
          {next.docsHref && (
            <a
              href={marketingLink(next.docsHref)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Read docs
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
