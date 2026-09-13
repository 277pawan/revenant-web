import { RevenantMark } from "./RevenantMark";

type AuthSuccessOverlayProps = {
  visible: boolean;
  message: string;
};

export function AuthSuccessOverlay({ visible, message }: AuthSuccessOverlayProps) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="auth-success-bloom flex flex-col items-center rounded-2xl bg-white px-10 py-8 shadow-2xl">
        <div className="relative mb-4">
          <svg className="h-28 w-28 -rotate-90" viewBox="0 0 120 120" aria-hidden>
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="4"
            />
            <circle
              className="auth-success-ring"
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="#10b981"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <RevenantMark size="lg" />
          </div>
        </div>
        <p className="text-center text-sm font-medium text-slate-800">{message}</p>
      </div>
    </div>
  );
}
