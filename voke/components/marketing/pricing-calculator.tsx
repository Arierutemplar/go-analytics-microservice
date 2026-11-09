"use client";

import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { ShineBorder } from "@/components/ui/shine-border";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCompact, formatUsd } from "@/lib/format";
import { MODELS, VOKE_FLAT } from "@/lib/models";
import { estimateCost } from "@/lib/pricing";

export function PricingCalculator() {
  const [requests, setRequests] = useState(1_200_000);
  const [avgInput, setAvgInput] = useState(800);
  const [avgOutput, setAvgOutput] = useState(400);
  const [modelId, setModelId] = useState("anthropic/claude-sonnet-4.5");

  const estimate = useMemo(
    () => estimateCost({ requests, avgInputTokens: avgInput, avgOutputTokens: avgOutput, modelId }),
    [requests, avgInput, avgOutput, modelId],
  );

  const model = MODELS.find((item) => item.id === modelId);
  const savings = estimate ? estimate.paygUsd - estimate.flatUsd : 0;

  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 py-16">
      <div className="max-w-xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Calculator</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">Your tokens versus the Voke flat rate</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          List prices below are sample provider rates for comparison. Voke Flat is ${VOKE_FLAT.monthlyUsd}/month
          and includes {formatCompact(VOKE_FLAT.includedTokens)} tokens, then ${VOKE_FLAT.overagePerMillion} per
          extra million.
        </p>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="panel relative space-y-5 overflow-hidden rounded-xl p-5">
          <ShineBorder />
          <div className="space-y-2">
            <Label htmlFor="model">Comparison model</Label>
            <Select value={modelId} onValueChange={setModelId}>
              <SelectTrigger id="model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Slider label="Requests / month" value={requests} min={10_000} max={5_000_000} step={10_000} onChange={setRequests} />
          <Slider label="Average input tokens" value={avgInput} min={50} max={8_000} step={50} onChange={setAvgInput} />
          <Slider label="Average output tokens" value={avgOutput} min={20} max={4_000} step={20} onChange={setAvgOutput} />
          {model ? (
            <p className="font-mono text-[11px] text-muted-foreground">
              {model.name}: ${model.inputPerMillion} / ${model.outputPerMillion} per 1M input / output tokens
            </p>
          ) : null}
        </div>
        <div className="panel relative overflow-hidden rounded-xl p-5">
          <ShineBorder />
          {estimate ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Pay as you go</p>
                  <p className="mt-1 font-mono text-2xl">{formatUsd(estimate.paygUsd)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Voke Flat</p>
                  <p className="mt-1 font-mono text-2xl text-primary">{formatUsd(estimate.flatUsd)}</p>
                </div>
              </div>
              <div className="mt-6 space-y-2 text-sm">
                <Bar label="List price" width={estimate.paygUsd} max={Math.max(estimate.paygUsd, estimate.flatUsd, 1)} />
                <Bar label="Voke" width={estimate.flatUsd} max={Math.max(estimate.paygUsd, estimate.flatUsd, 1)} emphasize />
              </div>
              <p className="mt-6 text-sm">
                {savings > 1
                  ? `At this volume the flat rate is about ${formatUsd(savings)} cheaper this month.`
                  : savings < -1
                    ? `At this volume pay-as-you-go is about ${formatUsd(Math.abs(savings))} cheaper. The flat rate starts to win as traffic grows.`
                    : "The two options are nearly even at this volume."}
              </p>
              <p className="mt-3 font-mono text-[11px] text-primary">
                {formatCompact(estimate.totalTokens)} tokens · {formatCompact(estimate.overageTokens)} over the included pool
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Choose a model to estimate.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block space-y-2">
      <span className="flex items-center justify-between text-xs text-muted-foreground">
        {label}
        <span className="font-mono text-foreground">{formatCompact(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full"
      />
    </label>
  );
}

function Bar({ label, width, max, emphasize = false }: { label: string; width: number; max: number; emphasize?: boolean }) {
  const pct = Math.max(4, Math.round((width / max) * 100));
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
        <span>{label}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/8">
        <div
          className={emphasize ? "h-full rounded-full bg-linear-to-r from-primary to-accent" : "h-full rounded-full bg-white/20"}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
