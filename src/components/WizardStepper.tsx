import { Check } from "lucide-react";

const STEPS = [
  { id: 1, title: "Identity", blurb: "Name & context" },
  { id: 2, title: "Connection", blurb: "Host & credentials" },
  { id: 3, title: "Validation plan", blurb: "Checks (next)" },
  { id: 4, title: "Review", blurb: "Confirm & create" },
] as const;

export function WizardStepper({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <ol className="flex w-full items-center gap-2">
      {STEPS.map((step, i) => {
        const done = current > step.id;
        const active = current === step.id;
        return (
          <li key={step.id} className="flex min-w-0 flex-1 items-center gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  done
                    ? "bg-emerald-600 text-white"
                    : active
                      ? "bg-brand text-white"
                      : "bg-slate-200 text-slate-500"
                }`}
              >
                {done ? <Check size={16} strokeWidth={3} /> : step.id}
              </span>
              <div className="min-w-0 hidden sm:block">
                <div
                  className={`truncate text-sm font-medium ${
                    active || done ? "text-slate-900" : "text-slate-500"
                  }`}
                >
                  {step.title}
                </div>
                <div className="truncate text-xs text-slate-500">{step.blurb}</div>
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`mx-1 hidden h-px flex-1 md:block ${
                  done ? "bg-emerald-400" : "bg-slate-200"
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
