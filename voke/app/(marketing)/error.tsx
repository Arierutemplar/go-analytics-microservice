"use client";

import { RouteError } from "@/components/shared/route-error";

export default function MarketingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError title="The marketing page failed" error={error} reset={reset} />;
}
