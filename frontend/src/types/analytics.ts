/** Evento tal y como lo serializa el backend. */
export interface AnalyticsEvent {
  id: string;
  event_type: string;
  user_id: string;
  tenant_id?: string;
  payload?: unknown; // JSON arbitrario
  timestamp: string; // ISO 8601
}

/** Resumen que el backend difunde por WebSocket tras cada evento procesado. */
export interface MetricSummary {
  total_events: number;
  events_by_type: Record<string, number> | null;
  last_event: AnalyticsEvent | null;
  /** Últimos eventos, el más reciente primero. */
  recent_events?: AnalyticsEvent[] | null;
  /** Eventos enviados a la DLQ por la instancia del backend. */
  dlq_events?: number;
}

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface FeedItem {
  seq: number;
  event: AnalyticsEvent;
  receivedAt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAnalyticsEvent(value: unknown): value is AnalyticsEvent {
  return isRecord(value) && typeof value.id === "string" && typeof value.event_type === "string";
}

/** Valida en runtime la forma de un resumen recibido por red (WebSocket o REST). */
export function isMetricSummary(value: unknown): value is MetricSummary {
  if (!isRecord(value) || typeof value.total_events !== "number") return false;
  const { events_by_type: byType, last_event: last, recent_events: recent, dlq_events: dlq } = value;
  if (byType !== null && !isRecord(byType)) return false;
  if (last !== null && !isAnalyticsEvent(last)) return false;
  if (recent != null && !(Array.isArray(recent) && recent.every(isAnalyticsEvent))) return false;
  return dlq === undefined || typeof dlq === "number";
}

/** Interpreta un mensaje de texto del WebSocket; devuelve null si no es un resumen válido. */
export function parseSummaryMessage(raw: string): MetricSummary | null {
  try {
    const data: unknown = JSON.parse(raw);
    return isMetricSummary(data) ? data : null;
  } catch {
    return null;
  }
}
