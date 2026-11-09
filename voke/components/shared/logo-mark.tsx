import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid size-8 place-items-center rounded-md border border-primary/40 bg-primary/15 text-sm font-black text-primary",
        className,
      )}
    >
      V
    </span>
  );
}

export function Logo({
  word = true,
  size = "lg",
  wordClassName,
}: {
  word?: boolean;
  size?: "md" | "lg";
  wordClassName?: string;
}) {
  return (
    <span className="animate-float relative isolate inline-flex items-center gap-2.5">
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-3 -z-10 rounded-full bg-[rgb(191,123,255)]/20 blur-xl"
      />
      <LogoMark />
      {word ? (
        <span
          className={cn(
            "relative inline-block bg-[linear-gradient(110deg,#ffffff_45%,#bf7bff_55%,#ffffff)] bg-[length:250%_100%] bg-clip-text font-black tracking-tight text-transparent animate-shimmer",
            size === "lg" ? "text-2xl" : "text-xl",
            wordClassName,
          )}
        >
          Voke
        </span>
      ) : null}
    </span>
  );
}
