"use client";

import { RouteError } from "@/components/shared/route-error";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError title="This view failed to load" error={error} reset={reset} />;
}
