import { useCallback, useRef, useState } from "react";
import { API_URL, ingestHeaders } from "../config";

export interface TestEventInput {
  event_type: string;
  user_id: string;
  payload?: unknown;
}

export interface IngestStats {
  sent: number;
  accepted: number;
  rateLimited: number; // 429
  rejected: number; // 503 (cola llena o NATS no disponible)
  failed: number; // red u otros estados
  lastError: string | null;
}

export interface LoadProgress {
  running: boolean;
  done: number;
  total: number;
}

const EMPTY: IngestStats = { sent: 0, accepted: 0, rateLimited: 0, rejected: 0, failed: 0, lastError: null };

export type Outcome = "accepted" | "rateLimited" | "rejected" | "failed";

export async function postEvent(ev: TestEventInput, signal?: AbortSignal): Promise<{ outcome: Outcome; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/events`, {
      method: "POST",
      headers: ingestHeaders(),
      body: JSON.stringify({
        id: crypto.randomUUID(),
        event_type: ev.event_type,
        user_id: ev.user_id,
        payload: ev.payload,
        timestamp: new Date().toISOString(),
      }),
      signal,
    });
    if (res.status === 202) return { outcome: "accepted" };
    const detail = (await res.text()).trim().slice(0, 120);
    if (res.status === 429) return { outcome: "rateLimited", error: "429 límite de peticiones" };
    if (res.status === 503) return { outcome: "rejected", error: `503 ${detail}` };
    return { outcome: "failed", error: `${res.status} ${detail}` };
  } catch (err) {
    if (signal?.aborted) return { outcome: "failed", error: "cancelado" };
    return { outcome: "failed", error: err instanceof Error ? err.message : "error de red" };
  }
}

export function useIngest() {
  const [stats, setStats] = useState<IngestStats>(EMPTY);
  const [progress, setProgress] = useState<LoadProgress>({ running: false, done: 0, total: 0 });
  const abortRef = useRef<AbortController | null>(null);

  const record = useCallback((o: { outcome: Outcome; error?: string }) => {
    setStats((s) => ({
      ...s,
      sent: s.sent + 1,
      [o.outcome]: s[o.outcome] + 1,
      lastError: o.outcome === "accepted" ? s.lastError : (o.error ?? s.lastError),
    }));
  }, []);

  const sendOne = useCallback(async (ev: TestEventInput) => record(await postEvent(ev)), [record]);

  /** Envía `total` eventos con `concurrency` peticiones en vuelo. */
  const sendLoad = useCallback(
    async (total: number, makeEvent: (i: number) => TestEventInput, concurrency = 5) => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setProgress({ running: true, done: 0, total });

      let next = 0;
      let done = 0;
      const worker = async () => {
        while (!ctrl.signal.aborted) {
          const i = next++;
          if (i >= total) return;
          record(await postEvent(makeEvent(i), ctrl.signal));
          setProgress({ running: true, done: ++done, total });
        }
      };
      await Promise.all(Array.from({ length: concurrency }, worker));
      setProgress((p) => ({ ...p, running: false }));
      abortRef.current = null;
    },
    [record],
  );

  const cancel = useCallback(() => abortRef.current?.abort(), []);
  const reset = useCallback(() => setStats(EMPTY), []);

  return { stats, progress, sendOne, sendLoad, cancel, reset, record };
}
