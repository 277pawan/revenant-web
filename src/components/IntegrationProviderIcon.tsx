import type { WebhookProvider } from "../types/api";

type Props = {
  provider: WebhookProvider | string;
  size?: number;
  className?: string;
};

/** Brand-style icons for integration picker (Slack, Gmail, Custom HTTP). */
export function IntegrationProviderIcon({ provider, size = 40, className = "" }: Props) {
  const box = `inline-flex shrink-0 items-center justify-center rounded-xl ${className}`;

  if (provider === "slack") {
    return (
      <span
        className={`${box} bg-white ring-1 ring-slate-200`}
        style={{ width: size, height: size }}
        aria-hidden
      >
        <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 122.8 122.8">
          <path
            d="M25.8 77.4c0 7.1-5.8 12.9-12.9 12.9S0 84.5 0 77.4s5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.4z"
            fill="#E01E5A"
          />
          <path
            d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z"
            fill="#36C5F0"
          />
          <path
            d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z"
            fill="#2EB67D"
          />
          <path
            d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9zm0-6.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z"
            fill="#ECB22E"
          />
        </svg>
      </span>
    );
  }

  if (provider === "email") {
    return (
      <span
        className={`${box} bg-white ring-1 ring-slate-200`}
        style={{ width: size, height: size }}
        aria-hidden
      >
        <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 48 48">
          <path fill="#4caf50" d="M45 16.2 24 30.4 3 16.2V38h42V16.2z" />
          <path fill="#1e88e5" d="M45 11 24 25.2 3 11V10h42v1z" />
          <path fill="#e53935" d="M3 10v8.2l21 14.2 21-14.2V10L24 24.2 3 10z" />
          <path fill="#c62828" d="M3 10l21 14.2L45 10H3z" />
          <path fill="#fbc02d" d="M24 24.2 3 10v1l21 14.2L45 11v-1L24 24.2z" />
        </svg>
      </span>
    );
  }

  return (
    <span
      className={`${box} bg-slate-100 ring-1 ring-slate-200`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg
        width={size * 0.5}
        height={size * 0.5}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-slate-600"
      >
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    </span>
  );
}
