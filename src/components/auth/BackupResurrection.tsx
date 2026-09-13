import { PostgresMark, AwsMark } from "./BrandMarks";

export function BackupResurrection() {
  return (
    <div className="flex h-full min-h-[168px] w-full flex-col rounded-2xl border border-white/12 bg-white/[0.06] px-5 py-3.5 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-300">
          Last night&apos;s backup
        </p>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400">
          <span className="auth-live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Coming back
        </span>
      </div>

      <div className="flex flex-1 items-center gap-3">
        <div className="auth-ghost-backup relative flex w-[104px] shrink-0 flex-col items-center rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2.5">
          <PostgresMark className="h-6 w-6 opacity-50 grayscale" />
          <span className="mt-1.5 text-[10px] font-medium text-slate-400">snapshot</span>
          <span className="font-mono text-[9px] text-slate-500">02:00 UTC</span>
        </div>

        <div className="relative min-w-0 flex-1">
          <div className="h-0.5 w-full rounded-full bg-gradient-to-r from-slate-600 via-cyan-400 to-emerald-400" />
          <div className="auth-packet absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-cyan-200 shadow-[0_0_16px_rgba(34,211,238,1)]" />
          <p className="pointer-events-none mt-2 text-center font-mono text-[10px] text-cyan-200/90">
            revenant verify
          </p>
        </div>

        <div className="relative flex w-[124px] shrink-0 flex-col items-center rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <PostgresMark className="h-5 w-5" />
            <AwsMark className="h-4 w-9" />
          </div>
          <span className="mt-1.5 text-[10px] font-medium text-emerald-200">sandbox live</span>
          <span className="font-mono text-[9px] text-emerald-300">RTO 3m 41s</span>
          <span className="auth-pass-stamp absolute -right-2 -top-2 rounded-md bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white shadow-lg">
            PASS
          </span>
        </div>
      </div>

      <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-400">
        A backup is an obituary until <span className="text-cyan-300">revenant verify</span> wakes it.
      </p>
    </div>
  );
}
