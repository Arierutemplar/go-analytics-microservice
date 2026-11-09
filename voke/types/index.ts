export type ProviderId = "openai" | "anthropic" | "google" | "voke";

export type ModelStatus = "operational" | "degraded" | "outage";

export type ApiKeyEnvironment = "live" | "test";

export type ApiKeyStatus = "active" | "revoked";

export type HttpStatus = 200 | 400 | 401 | 429 | 500;

export type PlanId = "flat" | "enterprise";

export type HeroLanguage = "javascript" | "python" | "curl";

export type PlaygroundLanguage = "curl" | "node" | "python" | "go";

export type MessageRole = "system" | "user" | "assistant";

export interface ApiResponse<T> {
  data: T;
  requestId: string;
}

export interface ApiErrorBody {
  code: "validation_error" | "not_found" | "rate_limited" | "upstream_error";
  message: string;
  requestId: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: PlanId;
}

export interface AIModel {
  id: string;
  provider: ProviderId;
  name: string;
  contextWindow: number;
  inputPerMillion: number;
  outputPerMillion: number;
  status: ModelStatus;
  uptime30d: number;
  p50Ms: number;
  p95Ms: number;
}

export interface ApiKey {
  id: string;
  name: string;
  environment: ApiKeyEnvironment;
  token: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  status: ApiKeyStatus;
  rateLimitRpm: number;
  monthlyTokenCap: number | null;
  ipAllowlist: string[];
}

export interface CreateApiKeyInput {
  name: string;
  environment: ApiKeyEnvironment;
  rateLimitRpm: number;
  monthlyTokenCap: number | null;
  ipAllowlist: string[];
}

export interface UpdateApiKeyLimitsInput {
  rateLimitRpm: number;
  monthlyTokenCap: number | null;
  ipAllowlist: string[];
}

export interface ChatMessage {
  role: MessageRole;
  content: string;
}

export interface PlaygroundDraft {
  model: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  system: string;
  prompt: string;
  apiKey: string;
}

export interface CompletionResult {
  content: string;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  requestId: string;
}

export interface RequestPayload {
  model: string;
  temperature: number;
  topP: number;
  messages: ChatMessage[];
}

export interface ResponsePayload {
  id: string;
  content: string | null;
  error: string | null;
}

export interface RequestLog {
  id: string;
  timestamp: string;
  method: "POST";
  path: "/v1/chat/completions";
  status: HttpStatus;
  model: string;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  apiKeyPrefix: string;
  ip: string;
  request: RequestPayload;
  response: ResponsePayload;
}

export interface UsagePoint {
  ts: string;
  label: string;
  requests: number;
  latencyMs: number;
  errors: number;
}

export interface ModelUsage {
  model: string;
  name: string;
  requests: number;
  tokens: number;
  share: number;
}

export interface UsageStats {
  requestsPerMinute: number;
  avgLatencyMs: number;
  errorRate: number;
  tokensToday: number;
  series: UsagePoint[];
  topModels: ModelUsage[];
}

export interface CostEstimate {
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  paygUsd: number;
  flatUsd: number;
  includedTokens: number;
  overageTokens: number;
}
