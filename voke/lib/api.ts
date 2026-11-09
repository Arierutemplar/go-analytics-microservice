import { findModel, MODELS } from "@/lib/models";
import type {
  ApiErrorBody,
  ApiKey,
  ApiResponse,
  CompletionResult,
  CreateApiKeyInput,
  Organization,
  PlaygroundDraft,
  RequestLog,
  UpdateApiKeyLimitsInput,
  UsageStats,
} from "@/types";

const organizations: Organization[] = [
  { id: "org_acme", name: "Acme Inc", slug: "acme", plan: "flat" },
  { id: "org_north", name: "Northwind", slug: "northwind", plan: "enterprise" },
];

export const ORGANIZATIONS: readonly Organization[] = organizations;

export class ApiError extends Error {
  readonly code: ApiErrorBody["code"];
  readonly requestId: string;

  constructor(code: ApiErrorBody["code"], message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.requestId = `req_${crypto.randomUUID().slice(0, 8)}`;
  }
}

function rid(): string {
  return `req_${crypto.randomUUID().slice(0, 8)}`;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function cloneKey(key: ApiKey): ApiKey {
  return { ...key, ipAllowlist: [...key.ipAllowlist] };
}

function mintToken(environment: ApiKey["environment"]): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let body = "";
  for (const byte of bytes) {
    body += alphabet[byte % alphabet.length] ?? "x";
  }
  return `voke_${environment}_${body}`;
}

function seedKeys(orgId: string): ApiKey[] {
  const live = orgId === "org_acme" ? "voke_live_8f3a1c9e2b7d4a60" : "voke_live_11ab90cd44ef1288";
  const test = orgId === "org_acme" ? "voke_test_c1e09b77aa2210df" : "voke_test_90aa11bc22de3344";
  const rows: ApiKey[] = [
    {
      id: `${orgId}_edge`,
      name: "Production edge",
      environment: "live",
      token: `${live}91ab`,
      prefix: live.slice(0, 16),
      createdAt: "2026-09-02T14:10:00.000Z",
      lastUsedAt: "2026-11-08T16:42:00.000Z",
      status: "active",
      rateLimitRpm: 600,
      monthlyTokenCap: 20_000_000,
      ipAllowlist: ["203.0.113.10", "203.0.113.0/24"],
    },
    {
      id: `${orgId}_ci`,
      name: "CI evals",
      environment: "test",
      token: `${test}77cd`,
      prefix: test.slice(0, 16),
      createdAt: "2026-10-18T09:00:00.000Z",
      lastUsedAt: "2026-11-07T11:05:00.000Z",
      status: "active",
      rateLimitRpm: 60,
      monthlyTokenCap: null,
      ipAllowlist: [],
    },
  ];
  if (orgId === "org_acme") {
    rows.push({
      id: `${orgId}_old`,
      name: "Staging (revoked)",
      environment: "live",
      token: "voke_live_revoked000111222",
      prefix: "voke_live_revok",
      createdAt: "2026-06-01T12:00:00.000Z",
      lastUsedAt: "2026-08-12T08:00:00.000Z",
      status: "revoked",
      rateLimitRpm: 120,
      monthlyTokenCap: 1_000_000,
      ipAllowlist: [],
    });
  }
  return rows;
}

const keyStore = new Map<string, ApiKey[]>();

function bucket(orgId: string): ApiKey[] {
  const existing = keyStore.get(orgId);
  if (existing) return existing;
  const seeded = seedKeys(orgId);
  keyStore.set(orgId, seeded);
  return seeded;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pick<T>(rand: () => number, items: readonly T[]): T {
  const item = items[Math.floor(rand() * items.length)];
  if (item === undefined) throw new Error("Cannot pick from an empty list");
  return item;
}

const PROMPTS = [
  "Summarize the last deploy for the on-call channel.",
  "Rewrite this SQL so it uses the tenant index.",
  "Draft a reply that declines a feature request without sounding cold.",
  "Explain why p95 moved after the cache change.",
  "Extract action items from the incident notes.",
] as const;

const STATUSES = [200, 200, 200, 200, 200, 200, 429, 500, 401, 400] as const;

export async function listApiKeys(orgId: string): Promise<ApiResponse<ApiKey[]>> {
  await wait(280);
  return { data: bucket(orgId).map(cloneKey), requestId: rid() };
}

export async function createApiKey(
  orgId: string,
  input: CreateApiKeyInput,
): Promise<ApiResponse<ApiKey>> {
  await wait(420);
  const name = input.name.trim();
  if (name.length < 2 || name.length > 48) {
    throw new ApiError("validation_error", "Name must be between 2 and 48 characters.");
  }
  if (name.toLowerCase() === "fail") {
    throw new ApiError("validation_error", "The key service rejected this name. Try another.");
  }
  const rows = bucket(orgId);
  if (rows.some((key) => key.status === "active" && key.name.toLowerCase() === name.toLowerCase())) {
    throw new ApiError("validation_error", "An active key already uses that name.");
  }
  const token = mintToken(input.environment);
  const key: ApiKey = {
    id: `key_${crypto.randomUUID()}`,
    name,
    environment: input.environment,
    token,
    prefix: token.slice(0, 16),
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    status: "active",
    rateLimitRpm: input.rateLimitRpm,
    monthlyTokenCap: input.monthlyTokenCap,
    ipAllowlist: [...input.ipAllowlist],
  };
  rows.unshift(key);
  return { data: cloneKey(key), requestId: rid() };
}

export async function updateApiKeyLimits(
  orgId: string,
  keyId: string,
  input: UpdateApiKeyLimitsInput,
): Promise<ApiResponse<ApiKey>> {
  await wait(320);
  const rows = bucket(orgId);
  const index = rows.findIndex((key) => key.id === keyId);
  const current = index >= 0 ? rows[index] : undefined;
  if (!current || current.status !== "active") {
    throw new ApiError("not_found", "That key is not active.");
  }
  const next: ApiKey = {
    ...current,
    rateLimitRpm: input.rateLimitRpm,
    monthlyTokenCap: input.monthlyTokenCap,
    ipAllowlist: [...input.ipAllowlist],
  };
  rows[index] = next;
  return { data: cloneKey(next), requestId: rid() };
}

export async function revokeApiKey(orgId: string, keyId: string): Promise<ApiResponse<ApiKey>> {
  await wait(300);
  const rows = bucket(orgId);
  const index = rows.findIndex((key) => key.id === keyId);
  const current = index >= 0 ? rows[index] : undefined;
  if (!current) throw new ApiError("not_found", "Key not found.");
  if (current.status === "revoked") {
    throw new ApiError("validation_error", "This key is already revoked.");
  }
  const next: ApiKey = { ...current, status: "revoked" };
  rows[index] = next;
  return { data: cloneKey(next), requestId: rid() };
}

export async function fetchUsage(orgId: string): Promise<ApiResponse<UsageStats>> {
  await wait(340);
  const rand = mulberry32(hashString(orgId) ^ 0x51a7);
  const now = Date.now();
  const series: UsageStats["series"] = [];
  for (let i = 23; i >= 0; i -= 1) {
    const ts = new Date(now - i * 60 * 60 * 1000);
    const requests = Math.round(180 + rand() * 900);
    series.push({
      ts: ts.toISOString(),
      label: ts.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
      requests,
      latencyMs: Math.round(140 + rand() * 280),
      errors: Math.round(rand() * 12),
    });
  }
  const last = series[series.length - 1];
  const avgLatencyMs = series.reduce((sum, point) => sum + point.latencyMs, 0) / series.length;
  const totalErrors = series.reduce((sum, point) => sum + point.errors, 0);
  const totalRequests = series.reduce((sum, point) => sum + point.requests, 0);
  const weights = MODELS.slice(0, 4).map((model, index) => ({
    model: model.id,
    name: model.name,
    requests: Math.round((0.42 - index * 0.08) * totalRequests),
    tokens: Math.round((0.42 - index * 0.08) * totalRequests * (600 + index * 80)),
    share: 0,
  }));
  const shareBase = weights.reduce((sum, row) => sum + row.requests, 0) || 1;
  const topModels = weights.map((row) => ({ ...row, share: row.requests / shareBase }));
  return {
    data: {
      requestsPerMinute: Math.round((last?.requests ?? 0) / 60),
      avgLatencyMs: Math.round(avgLatencyMs),
      errorRate: totalRequests === 0 ? 0 : (totalErrors / totalRequests) * 100,
      tokensToday: topModels.reduce((sum, row) => sum + row.tokens, 0),
      series,
      topModels,
    },
    requestId: rid(),
  };
}

export async function fetchLogs(orgId: string): Promise<ApiResponse<RequestLog[]>> {
  await wait(360);
  const rand = mulberry32(hashString(`logs:${orgId}`));
  const keys = bucket(orgId).filter((key) => key.status === "active");
  const fallbackPrefix = "voke_live_demo";
  const logs: RequestLog[] = [];
  const now = Date.now();
  for (let i = 0; i < 72; i += 1) {
    const model = pick(rand, MODELS);
    const status = pick(rand, STATUSES);
    const prompt = pick(rand, PROMPTS);
    const latencyMs = Math.round(80 + rand() * (status === 500 ? 2200 : 900));
    const promptTokens = 120 + Math.round(rand() * 1800);
    const completionTokens = status === 200 ? 40 + Math.round(rand() * 700) : 0;
    const key = keys.length > 0 ? pick(rand, keys) : undefined;
    const id = `req_${(hashString(orgId) + i).toString(16)}`;
    logs.push({
      id,
      timestamp: new Date(now - i * 47_000 - Math.round(rand() * 20_000)).toISOString(),
      method: "POST",
      path: "/v1/chat/completions",
      status,
      model: model.id,
      latencyMs,
      promptTokens,
      completionTokens,
      apiKeyPrefix: key?.prefix ?? fallbackPrefix,
      ip: `203.0.113.${1 + Math.floor(rand() * 40)}`,
      request: {
        model: model.id,
        temperature: Math.round((0.2 + rand() * 1.1) * 100) / 100,
        topP: Math.round((0.7 + rand() * 0.3) * 100) / 100,
        messages: [{ role: "user", content: prompt }],
      },
      response: {
        id: `chatcmpl_${id}`,
        content: status === 200 ? `Routed to ${model.name}. ${prompt}` : null,
        error:
          status === 200
            ? null
            : status === 429
              ? "Rate limit exceeded for this key."
              : status === 500
                ? "Upstream provider timed out."
                : status === 401
                  ? "API key was rejected."
                  : "The messages array is empty.",
      },
    });
  }
  return { data: logs, requestId: rid() };
}

export async function runCompletion(
  draft: PlaygroundDraft,
  options: {
    signal: AbortSignal;
    onDelta: (chunk: string) => void;
    simulateRateLimit: boolean;
  },
): Promise<CompletionResult> {
  await wait(220);
  if (options.signal.aborted) throw new DOMException("Aborted", "AbortError");
  if (options.simulateRateLimit) {
    throw new ApiError("rate_limited", "Rate limit exceeded for this key (429). Retry in a few seconds.");
  }
  const model = findModel(draft.model);
  if (!model) throw new ApiError("not_found", "Unknown model.");
  if (model.status === "outage") {
    throw new ApiError("upstream_error", `${model.name} is not accepting traffic.`);
  }
  const topic = draft.prompt.trim().slice(0, 220);
  const text = [
    `${model.name} accepted the request on the flat plan.`,
    "",
    topic ? `You asked: “${topic}”` : "The prompt was empty.",
    "",
    `Temperature ${draft.temperature.toFixed(2)} and top_p ${draft.topP.toFixed(2)} were forwarded as-is. Changing the model id is the only line you need to edit to compare providers.`,
    model.status === "degraded" ? "This model is degraded: p95 is elevated, but the request still completed." : "",
  ]
    .filter((line) => line !== "")
    .join("\n");

  let content = "";
  const parts = text.split(/(\s+)/);
  for (const part of parts) {
    if (options.signal.aborted) throw new DOMException("Aborted", "AbortError");
    await wait(14);
    content += part;
    options.onDelta(part);
  }
  const promptTokens = Math.max(1, Math.ceil((draft.system.length + draft.prompt.length) / 4));
  return {
    content,
    latencyMs: 220 + parts.length * 14,
    promptTokens,
    completionTokens: Math.max(1, Math.ceil(content.length / 4)),
    requestId: rid(),
  };
}
