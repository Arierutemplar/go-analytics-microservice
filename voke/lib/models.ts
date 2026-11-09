import type { AIModel } from "@/types";

export const MODELS: readonly AIModel[] = [
  {
    id: "voke/auto",
    provider: "voke",
    name: "Voke Auto",
    contextWindow: 200_000,
    inputPerMillion: 1.5,
    outputPerMillion: 6,
    status: "operational",
    uptime30d: 99.98,
    p50Ms: 180,
    p95Ms: 420,
  },
  {
    id: "openai/gpt-4.1",
    provider: "openai",
    name: "GPT-4.1",
    contextWindow: 1_000_000,
    inputPerMillion: 2,
    outputPerMillion: 8,
    status: "operational",
    uptime30d: 99.95,
    p50Ms: 310,
    p95Ms: 890,
  },
  {
    id: "openai/gpt-4.1-mini",
    provider: "openai",
    name: "GPT-4.1 mini",
    contextWindow: 1_000_000,
    inputPerMillion: 0.4,
    outputPerMillion: 1.6,
    status: "operational",
    uptime30d: 99.99,
    p50Ms: 140,
    p95Ms: 360,
  },
  {
    id: "anthropic/claude-sonnet-4.5",
    provider: "anthropic",
    name: "Claude Sonnet 4.5",
    contextWindow: 200_000,
    inputPerMillion: 3,
    outputPerMillion: 15,
    status: "operational",
    uptime30d: 99.93,
    p50Ms: 420,
    p95Ms: 1100,
  },
  {
    id: "anthropic/claude-haiku-4.5",
    provider: "anthropic",
    name: "Claude Haiku 4.5",
    contextWindow: 200_000,
    inputPerMillion: 1,
    outputPerMillion: 5,
    status: "operational",
    uptime30d: 99.97,
    p50Ms: 160,
    p95Ms: 410,
  },
  {
    id: "google/gemini-2.5-pro",
    provider: "google",
    name: "Gemini 2.5 Pro",
    contextWindow: 1_000_000,
    inputPerMillion: 1.25,
    outputPerMillion: 10,
    status: "degraded",
    uptime30d: 99.12,
    p50Ms: 680,
    p95Ms: 2400,
  },
  {
    id: "google/gemini-2.5-flash",
    provider: "google",
    name: "Gemini 2.5 Flash",
    contextWindow: 1_000_000,
    inputPerMillion: 0.15,
    outputPerMillion: 0.6,
    status: "operational",
    uptime30d: 99.96,
    p50Ms: 120,
    p95Ms: 290,
  },
];

export const VOKE_FLAT = {
  name: "Flat",
  monthlyUsd: 49,
  includedTokens: 30_000_000,
  overagePerMillion: 0.9,
} as const;

export const VOKE_ENDPOINT = "https://api.voke.dev/v1/chat/completions";

export function findModel(id: string): AIModel | undefined {
  return MODELS.find((model) => model.id === id);
}
