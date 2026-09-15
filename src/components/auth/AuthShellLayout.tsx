import type { ReactNode } from "react";
import { AuthBrandPanel } from "./AuthBrandPanel";
import { RevenantMark } from "./RevenantMark";

type AuthShellLayoutProps = {
  children: ReactNode;
};

export function AuthShellLayout({ children }: AuthShellLayoutProps) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <AuthBrandPanel />

      <div className="auth-form-panel relative flex min-h-screen w-full shrink-0 flex-col justify-center overflow-hidden px-6 py-10 sm:px-10 lg:w-[40%] lg:px-12 xl:px-14">
        <div className="auth-form-ambient pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto w-full max-w-[400px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <RevenantMark size="sm" className="!h-10" glow />
            <div>
              <div className="font-semibold text-slate-900">Revenant Cloud</div>
              <div className="text-xs text-slate-500">DR proof control plane</div>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
