import { useEffect, useRef, useState } from "react";
import { API_KEY, API_URL } from "../config";
import { isMetricSummary, type FeedItem, type MetricSummary } from "../types/analytics";

/** El WebSocket solo emite cuando hay eventos: carga el resumen actual al montar. */
export function useInitialSummary(): MetricSummary | null {
  const [summary, setSummary] = useState<MetricSummary | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`${API_URL}/api/metrics`, {
      signal: ctrl.signal,
      headers: API_KEY ? { "X-API-Key": API_KEY } : undefined,
    })
      .then((r) => (r.ok ? (r.json() as Promise<unknown>) : null))
      .then((s) => {
        if (isMetricSummary(s)) setSummary(s);
      })
      .catch(() => undefined); // si falla (backend caído, API key), basta con el WebSocket
    return () => ctrl.abort();
  }, []);

  return summary;
}

/**
 * Feed de los últimos eventos. El backend difunde el resumen con `last_event`, así que
 * se añade una entrada cada vez que el total cambia. Con ingesta por lotes (NATS) un
 * mismo mensaje puede cubrir varios eventos y solo se ve el último de cada lote.
 */
export function useEventFeed(metrics: MetricSummary | null, max = 30): FeedItem[] {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const lastTotal = useRef<number | null>(null);
  const seen = useRef(new Set<string>());
  const seq = useRef(0);

  useEffect(() => {
    if (!metrics) return;
    const changed = lastTotal.current !== metrics.total_events;
    lastTotal.current = metrics.total_events;
    if (!changed) return;

    // Preferir recent_events (todos los eventos nuevos); last_event como respaldo.
    const candidates = metrics.recent_events?.length
      ? [...metrics.recent_events].reverse()
      : metrics.last_event
        ? [metrics.last_event]
        : [];
    const fresh = candidates.filter((e) => !seen.current.has(e.id));
    if (fresh.length === 0) return;
    fresh.forEach((e) => seen.current.add(e.id));

    const now = Date.now();
    const items: FeedItem[] = fresh.map((event) => ({ seq: seq.current++, event, receivedAt: now }));
    setFeed((prev) => [...items.reverse(), ...prev].slice(0, max));
  }, [metrics, max]);

  return feed;
}

/** Eventos por segundo (ventana de `size` segundos) a partir del total acumulado. */
export function useThroughput(total: number, size = 60): number[] {
  const [samples, setSamples] = useState<number[]>(() => Array(size).fill(0));
  const latest = useRef(total);
  const prev = useRef(total);
  latest.current = total;

  useEffect(() => {
    const id = window.setInterval(() => {
      const delta = Math.max(0, latest.current - prev.current); // un reinicio del backend baja el total
      prev.current = latest.current;
      setSamples((s) => [...s.slice(1), delta]);
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  return samples;
}
