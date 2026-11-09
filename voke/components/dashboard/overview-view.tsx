"use client";

import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useOrg } from "@/components/shared/org-provider";
import { Button } from "@/components/ui/button";
import { ShineBorder } from "@/components/ui/shine-border";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, fetchUsage } from "@/lib/api";
import { formatCompact, formatMs, formatPercent } from "@/lib/format";

function messageFrom(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Could not load usage.";
}

export function OverviewView() {
  const { org } = useOrg();
  const usage = useQuery({
    queryKey: ["usage", org.id],
    queryFn: async () => (await fetchUsage(org.id)).data,
  });

  if (usage.isPending) {
    return (
      <div className="mx-auto grid max-w-6xl gap-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (usage.isError || !usage.data) {
    return (
      <div className="mx-auto max-w-6xl text-sm text-muted-foreground">
        {messageFrom(usage.error)}{" "}
        <Button variant="outline" size="sm" onClick={() => void usage.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const stats = usage.data;

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
      <p className="mt-1 text-sm text-muted-foreground">Last 24 hours for {org.name}. Figures refresh from the mock usage API.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Requests / min" value={formatCompact(stats.requestsPerMinute)} />
        <Metric label="Average latency" value={formatMs(stats.avgLatencyMs)} />
        <Metric label="Error rate" value={formatPercent(stats.errorRate)} />
        <Metric label="Tokens today" value={formatCompact(stats.tokensToday)} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Requests">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={stats.series}>
              <defs>
                <linearGradient id="requestsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d9b0ff" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#bf7bff" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis tick={{ fill: "var(--primary)", fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area dataKey="requests" stroke="#bf7bff" fill="url(#requestsFill)" strokeWidth={1.75} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Average latency">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={stats.series}>
              <defs>
                <linearGradient id="latencyFill" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#643d88" />
                  <stop offset="100%" stopColor="#d9b0ff" />
                </linearGradient>
                <linearGradient id="latencyArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#bf7bff" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#bf7bff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis tick={{ fill: "var(--primary)", fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area dataKey="latencyMs" stroke="url(#latencyFill)" fill="url(#latencyArea)" strokeWidth={1.75} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      <div className="panel relative mt-4 overflow-hidden rounded-xl p-4">
        <ShineBorder />
        <h2 className="text-sm font-medium">Most used models</h2>
        <ul className="mt-4 space-y-3">
          {stats.topModels.map((model) => (
            <li key={model.model}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span>{model.name}</span>
                <span className="font-mono text-xs text-primary">
                  {formatCompact(model.requests)} req · {formatPercent(model.share * 100, 0)}
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-linear-to-r from-primary to-accent"
                  style={{ width: `${Math.max(4, Math.round(model.share * 100))}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid color-mix(in srgb, var(--primary) 35%, transparent)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--foreground)",
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel relative overflow-hidden rounded-xl p-4">
      <ShineBorder />
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 font-mono text-2xl text-primary">{value}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="panel relative overflow-hidden rounded-xl p-4">
      <ShineBorder />
      <h2 className="mb-3 text-sm font-medium">{title}</h2>
      {children}
    </div>
  );
}
