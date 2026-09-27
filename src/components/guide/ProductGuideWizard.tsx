import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { ArrowLeft, ArrowRight, MousePointer2, X } from "lucide-react";
import { PRODUCT_GUIDE_STEPS } from "../../lib/product-guide-steps";
import { RevenantMark } from "../auth/RevenantMark";

type ProductGuideWizardProps = {
  open: boolean;
  onClose: () => void;
};

type TargetRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export function ProductGuideWizard({ open, onClose }: ProductGuideWizardProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);

  useEffect(() => {
    if (open) setStepIndex(0);
  }, [open]);

  const goTo = useCallback((index: number) => {
    const next = Math.max(0, Math.min(PRODUCT_GUIDE_STEPS.length - 1, index));
    setStepIndex(next);
  }, []);

  const step = PRODUCT_GUIDE_STEPS[stepIndex];

  useLayoutEffect(() => {
    if (!open || !step) return;
    let frame = 0;
    let observer: MutationObserver | undefined;

    const measure = () => {
      const target = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (!target) {
        setTargetRect(null);
        return;
      }
      const bounds = target.getBoundingClientRect();
      if (bounds.width === 0 || bounds.height === 0) {
        setTargetRect(null);
        return;
      }
      setTargetRect({ top: bounds.top, left: bounds.left, width: bounds.width, height: bounds.height });
    };

    const target = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    target?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    frame = window.requestAnimationFrame(measure);
    const delayedMeasure = window.setTimeout(measure, 280);
    const onViewportChange = () => window.requestAnimationFrame(measure);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    observer = new MutationObserver(onViewportChange);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "aria-expanded"] });

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(delayedMeasure);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
      observer?.disconnect();
    };
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") goTo(stepIndex + 1);
      if (event.key === "ArrowLeft") goTo(stepIndex - 1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, goTo, stepIndex]);

  if (!open || !step) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === PRODUCT_GUIDE_STEPS.length - 1;
  const targetLabel = step.hrefLabel ?? "this area";
  const cardWidth = Math.min(360, window.innerWidth - 32);

  return (
    <div className="fixed inset-0 z-[70] pointer-events-none" aria-live="polite">
      {targetRect && (
        <>
          <div
            className="product-tour-spotlight fixed rounded-lg"
            style={{
              top: targetRect.top - 8,
              left: targetRect.left - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
            }}
            aria-hidden="true"
          />
          <div
            className="product-tour-cursor fixed"
            style={{
              top: targetRect.top + targetRect.height / 2 - 2,
              left: Math.min(window.innerWidth - 26, targetRect.left + Math.min(targetRect.width * 0.7, 48)),
            }}
            aria-hidden="true"
          >
            <MousePointer2 size={25} fill="#5eead4" stroke="#07121d" strokeWidth={1.6} />
            <span className="ml-4 -mt-1 rounded-full border border-teal-200/50 bg-[#0c1a26] px-2 py-1 text-[10px] font-semibold text-teal-100 shadow-xl">
              Revenant guide
            </span>
          </div>
        </>
      )}

      <section
        role="dialog"
        aria-modal="false"
        aria-labelledby="product-guide-title"
        className="product-tour-card pointer-events-auto fixed right-4 top-4 flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-xl border border-slate-300 bg-[#f8fafc] text-slate-900 shadow-2xl sm:right-6 sm:top-6"
        style={{ width: cardWidth }}
      >
        <div className="h-1 shrink-0 bg-slate-200">
          <div className="h-full bg-teal-600 transition-[width] duration-500" style={{ width: `${((stepIndex + 1) / PRODUCT_GUIDE_STEPS.length) * 100}%` }} />
        </div>
        <div className="overflow-y-auto p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-md border border-teal-200 bg-teal-50">
                {stepIndex === 0 ? <RevenantMark size="xs" alt="Revenant" className="h-5" /> : <step.icon size={15} className="text-teal-800" />}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-teal-800">Step {stepIndex + 1} of {PRODUCT_GUIDE_STEPS.length}</span>
            </div>
            <button type="button" onClick={onClose} className="rounded p-1 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900" aria-label="Close guide">
              <X size={15} />
            </button>
          </div>
          <h2 id="product-guide-title" className="mt-4 text-lg font-semibold leading-snug text-slate-950">{step.title}</h2>
          <p className="mt-1.5 text-sm text-slate-700">{step.summary}</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">{step.detail}</p>
          <p className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-teal-800">
            <MousePointer2 size={12} /> Pointing to {targetLabel}
          </p>
          {!targetRect && <p className="mt-2 text-[10px] text-amber-800">Target is not visible on this screen. Continue the tour or return to the dashboard.</p>}
          <div className="sticky bottom-0 mt-4 flex items-center justify-between border-t border-slate-200 bg-[#f8fafc] pt-3">
            <button type="button" onClick={() => goTo(stepIndex - 1)} disabled={isFirst} className="inline-flex items-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-30">
              <ArrowLeft size={14} /> Previous
            </button>
            <button type="button" onClick={() => isLast ? onClose() : goTo(stepIndex + 1)} className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-800">
              {isLast ? "Finish" : "Next"} {!isLast && <ArrowRight size={14} />}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export function openProductGuide() {
  window.dispatchEvent(new CustomEvent("revenant:open-guide"));
}

export function ProductGuideLauncher({
  onOpen,
  compact = false,
}: {
  onOpen?: () => void;
  compact?: boolean;
}) {
  const handleOpen = onOpen ?? openProductGuide;

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-900 hover:bg-blue-100"
      >
        <RevenantMark size="xs" alt="" className="h-4" />
        How Revenant works
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800/60 hover:text-white"
    >
      <RevenantMark size="xs" alt="" className="h-4" />
      Product guide
    </button>
  );
}
