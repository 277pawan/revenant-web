import { useEffect, useState } from "react";
import { RevenantMark } from "./RevenantMark";
import { OrbitingTeamOrbit } from "./OrbitingTeamOrbit";
import { BackupResurrection } from "./BackupResurrection";
import { VerifyTerminal } from "./VerifyTerminal";
import { PostgresMark, AwsMark } from "./BrandMarks";

const HEADLINES = [
  "Prove backups recover — not just exist.",
  "One command. Signed evidence. Real RTO.",
  "Tuesday-morning fleet health at a glance.",
];

export function AuthBrandPanel() {
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const [headlineVisible, setHeadlineVisible] = useState(true);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHeadlineVisible(false);
      window.setTimeout(() => {
        setHeadlineIndex((i) => (i + 1) % HEADLINES.length);
        setHeadlineVisible(true);
      }, 280);
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="auth-brand-panel relative hidden w-[60%] shrink-0 overflow-hidden lg:flex lg:flex-col">
      <div className="auth-brand-grid pointer-events-none absolute inset-0 opacity-50" />

      <div className="relative flex min-h-0 flex-1 flex-col px-8 py-7 xl:px-12 xl:py-8">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-medium text-cyan-100">
              <PostgresMark className="h-4 w-4" />
              PostgreSQL
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-[11px] font-medium text-amber-100">
              <AwsMark className="h-4 w-8" />
              RDS restore
            </span>
          </div>
          <span className="hidden font-mono text-[11px] text-slate-400 xl:inline">
            revenant verify
          </span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
          <OrbitingTeamOrbit />

          <div className="mt-5 flex h-12 w-full max-w-lg items-center justify-center">
            <p
              className={`text-center text-lg font-semibold leading-snug text-white drop-shadow-[0_0_18px_rgba(56,189,248,0.25)] transition-all duration-300 xl:text-xl ${
                headlineVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
              }`}
            >
              {HEADLINES[headlineIndex]}
            </p>
          </div>
        </div>

        <div className="mt-4 grid h-[168px] w-full max-w-2xl grid-cols-1 gap-3 self-center xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <BackupResurrection />
          <div className="hidden h-full xl:block">
            <VerifyTerminal />
          </div>
        </div>
      </div>

      <div className="relative z-10 shrink-0 border-t border-white/10 bg-black/20 px-8 py-4 xl:px-12">
        <div className="flex items-center gap-3">
          <RevenantMark size="sm" />
          <div>
            <div className="text-sm font-semibold text-white">Revenant Cloud</div>
            <div className="text-xs text-slate-400">Disaster recovery proof</div>
          </div>
          <span className="ml-auto hidden font-mono text-[11px] text-slate-500 lg:inline">
            CLI · revenant verify
          </span>
        </div>
      </div>
    </div>
  );
}
