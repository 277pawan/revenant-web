import { useEffect, useState } from "react";
import { CheckCircle2, Database, FileCheck, RotateCcw } from "lucide-react";
import { RevenantMark } from "./RevenantMark";

const PIPELINE = [
  { id: "snapshot", label: "Snapshot", icon: Database },
  { id: "restore", label: "Restore", icon: RotateCcw },
  { id: "verify", label: "Validate", icon: CheckCircle2 },
  { id: "evidence", label: "Evidence", icon: FileCheck },
] as const;

const DRILL_FEED = [
  {
    name: "Priya Sharma",
    role: "SRE Lead",
    org: "FinStack",
    database: "prod-payments",
    rto: "3m 41s",
    initials: "PS",
    color: "from-violet-500 to-purple-600",
  },
  {
    name: "Arjun Mehta",
    role: "Platform Eng",
    org: "NovaHealth",
    database: "patient-records",
    rto: "5m 08s",
    initials: "AM",
    color: "from-cyan-500 to-blue-600",
  },
  {
    name: "Sneha Reddy",
    role: "DBA",
    org: "LogiCore",
    database: "orders-primary",
    rto: "2m 19s",
    initials: "SR",
    color: "from-emerald-500 to-teal-600",
  },
  {
    name: "Rahul Kapoor",
    role: "DevOps",
    org: "PayGrid",
    database: "ledger-replica",
    rto: "4m 55s",
    initials: "RK",
    color: "from-amber-500 to-orange-600",
  },
];

export function RestoreProofPanel() {
  const [activeStep, setActiveStep] = useState(0);
  const [feedIndex, setFeedIndex] = useState(0);
  const [feedVisible, setFeedVisible] = useState(true);
  const [hoveredFeed, setHoveredFeed] = useState<number | null>(null);

  useEffect(() => {
    const stepTimer = window.setInterval(() => {
      setActiveStep((s) => (s + 1) % PIPELINE.length);
    }, 2200);
    return () => window.clearInterval(stepTimer);
  }, []);

  useEffect(() => {
    const feedTimer = window.setInterval(() => {
      setFeedVisible(false);
      window.setTimeout(() => {
        setFeedIndex((i) => (i + 1) % DRILL_FEED.length);
        setFeedVisible(true);
      }, 320);
    }, 4500);
    return () => window.clearInterval(feedTimer);
  }, []);

  const current = DRILL_FEED[feedIndex];
  const visibleFeed = [
    current,
    DRILL_FEED[(feedIndex + 1) % DRILL_FEED.length],
    DRILL_FEED[(feedIndex + 2) % DRILL_FEED.length],
  ];

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Pipeline — proves restore works */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm">
        <div className="mb-3 flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-slate-400">
          <span>Live restore drill</span>
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="auth-live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Running
          </span>
        </div>

        <div className="relative mx-1 mb-1">
          <div className="h-0.5 w-full rounded-full bg-white/10" aria-hidden />
          <div
            className="auth-pipeline-progress absolute left-0 top-0 h-0.5 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
            style={{ width: `${(activeStep / (PIPELINE.length - 1)) * 100}%` }}
            aria-hidden
          />
        </div>

        <div className="relative flex items-center justify-between gap-1">

          {PIPELINE.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === activeStep;
            const isDone = index < activeStep;
            return (
              <div key={step.id} className="relative z-10 flex flex-1 flex-col items-center gap-2">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-500 ${
                    isActive
                      ? "auth-pipeline-step-active border-cyan-400/60 bg-cyan-500/20 text-cyan-100 shadow-lg shadow-cyan-500/20"
                      : isDone
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                        : "border-white/10 bg-white/5 text-slate-500"
                  }`}
                >
                  <Icon size={16} strokeWidth={isActive ? 2.25 : 2} />
                </div>
                <span
                  className={`text-[10px] font-medium transition-colors duration-300 ${
                    isActive ? "text-white" : isDone ? "text-emerald-300/90" : "text-slate-500"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-center gap-3 border-t border-white/10 pt-4">
          <RevenantMark size="sm" glow />
          <div className="text-center">
            <div className="text-xs font-semibold text-white">
              {PIPELINE[activeStep].label}
              {activeStep === PIPELINE.length - 1 ? " signed" : " in progress…"}
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-cyan-300/90">
              RTO <span className="auth-rto-tick tabular-nums">04:12</span>
            </div>
          </div>
        </div>
      </div>

      {/* Team feed — real humans, not random letters */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm">
        <div className="mb-3 text-[11px] font-medium uppercase tracking-wide text-slate-400">
          Teams proving restore this week
        </div>
        <ul className="space-y-2">
          {visibleFeed.map((entry, i) => {
            const globalIndex = (feedIndex + i) % DRILL_FEED.length;
            const isHovered = hoveredFeed === globalIndex;
            return (
              <li
                key={`${entry.name}-${i}`}
                className={`auth-feed-row flex cursor-default items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-300 ${
                  i === 0 && feedVisible ? "auth-feed-enter" : ""
                } ${
                  isHovered
                    ? "border-white/20 bg-white/10 scale-[1.02] shadow-lg shadow-black/20"
                    : "border-transparent bg-white/[0.03] hover:border-white/10 hover:bg-white/[0.06]"
                }`}
                onMouseEnter={() => setHoveredFeed(globalIndex)}
                onMouseLeave={() => setHoveredFeed(null)}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${entry.color} text-xs font-bold text-white shadow-md transition-transform duration-300 ${isHovered ? "scale-110" : ""}`}
                  title={entry.name}
                >
                  {entry.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-white">{entry.name}</span>
                    <span className="shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                      PASS
                    </span>
                  </div>
                  <p className="truncate text-xs text-slate-400">
                    {entry.org} · <span className="font-mono text-slate-300">{entry.database}</span>
                  </p>
                  {isHovered && (
                    <p className="mt-1 text-[11px] text-cyan-200/90">
                      {entry.role} — restored sandbox in {entry.rto}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-xs font-medium text-emerald-300">{entry.rto}</div>
                  <div className="text-[10px] text-slate-500">RTO</div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
