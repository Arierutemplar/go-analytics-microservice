import { findModel, VOKE_FLAT } from "@/lib/models";
import type { CostEstimate } from "@/types";

export interface EstimateInput {
  requests: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  modelId: string;
}

export function estimateCost(input: EstimateInput): CostEstimate | null {
  const model = findModel(input.modelId);
  if (!model) return null;
  if (input.requests < 0 || input.avgInputTokens < 0 || input.avgOutputTokens < 0) return null;

  const inputTokens = input.requests * input.avgInputTokens;
  const outputTokens = input.requests * input.avgOutputTokens;
  const totalTokens = inputTokens + outputTokens;
  const paygUsd =
    (inputTokens / 1_000_000) * model.inputPerMillion +
    (outputTokens / 1_000_000) * model.outputPerMillion;
  const overageTokens = Math.max(0, totalTokens - VOKE_FLAT.includedTokens);
  const flatUsd = VOKE_FLAT.monthlyUsd + (overageTokens / 1_000_000) * VOKE_FLAT.overagePerMillion;

  return {
    modelId: model.id,
    inputTokens,
    outputTokens,
    totalTokens,
    paygUsd,
    flatUsd,
    includedTokens: VOKE_FLAT.includedTokens,
    overageTokens,
  };
}
