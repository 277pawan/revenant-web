export const REVENANT_LOGO_SRC = "/revenant_logo.svg";

type RevenantMarkProps = {
  size?: "xs" | "sm" | "md" | "lg" | "hero";
  className?: string;
  glow?: boolean;
  alt?: string;
};

const heights: Record<NonNullable<RevenantMarkProps["size"]>, string> = {
  xs: "h-7",
  sm: "h-9",
  md: "h-11",
  lg: "h-14",
  hero: "h-24",
};

export function RevenantMark({
  size = "md",
  className = "",
  glow = false,
  alt = "Revenant",
}: RevenantMarkProps) {
  return (
    <img
      src={REVENANT_LOGO_SRC}
      alt={alt}
      className={`w-auto shrink-0 object-contain ${heights[size]} ${
        glow ? "auth-mark rounded-2xl" : "rounded-xl"
      } ${className}`}
    />
  );
}
