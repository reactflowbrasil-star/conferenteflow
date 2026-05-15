import { cn } from "@/lib/utils";

type LogoSurface = "dark" | "light";

export function Logo({
  compact = false,
  surface = "dark",
  className,
}: {
  compact?: boolean;
  surface?: LogoSurface;
  className?: string;
}) {
  const src = compact
    ? surface === "light"
      ? "/brand/conferflow-square-light.png"
      : "/brand/conferflow-square-dark.png"
    : surface === "light"
      ? "/brand/conferflow-wide-light.png"
      : "/brand/conferflow-wide-dark.png";

  return (
    <img
      src={src}
      alt="ConferFlow"
      className={cn(
        "block select-none object-contain",
        compact ? "h-10 w-10 rounded-xl" : "h-auto w-44 max-w-full",
        className,
      )}
      draggable={false}
    />
  );
}
