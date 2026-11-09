"use client";

import { Button } from "@/components/ui/button";

export function RouteError({
  title,
  error,
  reset,
}: {
  title: string;
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[40vh] max-w-md flex-col items-start justify-center px-2">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Error</p>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message || "The page failed to render."}</p>
      <Button className="mt-5" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
