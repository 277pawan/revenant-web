/** Official-feel Postgres elephant, sized for badges */
export function PostgresMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden>
      <ellipse cx="16" cy="18.5" rx="10" ry="9.2" fill="#336791" />
      <path
        d="M10.2 13.2c.4-3.6 2.2-6.2 5.8-6.2 3.5 0 5.4 2.5 5.8 6.1.2 1.8-.3 3.3-1.4 4.1-.8.6-1.9.8-3 .8h-2.8c-1.2 0-2.3-.2-3.1-.8-1.1-.8-1.6-2.3-1.3-4z"
        fill="#fff"
        opacity="0.92"
      />
      <ellipse cx="13.2" cy="13.6" rx="1.15" ry="1.4" fill="#1e3a5f" />
      <ellipse cx="18.8" cy="13.6" rx="1.15" ry="1.4" fill="#1e3a5f" />
      <path
        d="M11.4 8.4c-1.6.2-2.8 1.4-3.2 2.8-.2.7.4 1 .9.7 1.1-.6 2.2-1.4 3.1-2.5.4-.5 0-1.1-.8-1z"
        fill="#336791"
      />
      <path
        d="M20.6 8.4c1.6.2 2.8 1.4 3.2 2.8.2.7-.4 1-.9.7-1.1-.6-2.2-1.4-3.1-2.5-.4-.5 0-1.1.8-1z"
        fill="#336791"
      />
      <path
        d="M14.2 17.6c.6.7 1.4 1.1 1.8 1.1.5 0 1.2-.4 1.8-1.1"
        stroke="#1e3a5f"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path d="M16 22.4v3.2" stroke="#25415d" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** AWS smile mark for RDS restore drills */
export function AwsMark({ className = "h-5 w-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 28" fill="none" aria-hidden>
      <text
        x="2"
        y="16"
        fill="#fff"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="13"
        fontWeight="700"
        letterSpacing="0.4"
      >
        aws
      </text>
      <path
        d="M14 20.5c5.2 3.8 13.2 3.6 19.2-.4"
        stroke="#FF9900"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M31.4 22.2l2.6-2.4 1.4 3.2-4-0.8z"
        fill="#FF9900"
      />
    </svg>
  );
}
