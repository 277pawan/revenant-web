type RevenantMarkProps = {
  size?: "sm" | "md" | "lg" | "hero";
  className?: string;
  glow?: boolean;
};

const sizes = {
  sm: "h-9 w-9 text-base rounded-lg",
  md: "h-11 w-11 text-lg rounded-xl",
  lg: "h-14 w-14 text-2xl rounded-2xl",
  hero: "h-20 w-20 text-4xl rounded-2xl",
};

/** Placeholder mark — single “R” until final logo ships */
export function RevenantMark({ size = "md", className = "", glow = false }: RevenantMarkProps) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center bg-brand font-bold tracking-tight text-white ${sizes[size]} ${glow ? "auth-mark" : ""} ${className}`}
      aria-hidden
    >
      R
    </div>
  );
}
