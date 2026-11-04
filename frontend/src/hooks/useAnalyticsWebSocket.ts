import { useCallback, useEffect, useRef, useState } from "react";
import { parseSummaryMessage, type ConnectionStatus, type MetricSummary } from "../types/analytics";

const INITIAL_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

export interface AnalyticsWebSocket {
  metrics: MetricSummary | null;
  status: ConnectionStatus;
  isConnected: boolean;
  /** Intentos de reconexión consecutivos desde la última conexión exitosa. */
  retries: number;
  reconnect: () => void;
}

/**
 * Mantiene una conexión WebSocket con reconexión automática (backoff exponencial
 * con jitter, tope de 30 s). Reconecta de inmediato al volver la red o la pestaña.
 * Al desmontar o cambiar `url` se cancelan el temporizador, los listeners del
 * navegador y los handlers del socket, de modo que no quedan referencias vivas.
 */
export function useAnalyticsWebSocket(url: string): AnalyticsWebSocket {
  const [metrics, setMetrics] = useState<MetricSummary | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [retries, setRetries] = useState(0);

  const reconnectNow = useRef<() => void>(() => undefined);

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;
    let timer: number | undefined;
    let attempt = 0;

    const detach = (ws: WebSocket) => {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
    };

    const connect = () => {
      window.clearTimeout(timer);
      if (disposed || (socket && socket.readyState <= WebSocket.OPEN)) return;

      setStatus("connecting");
      const ws = new WebSocket(url);
      socket = ws;

      ws.onopen = () => {
        attempt = 0;
        setRetries(0);
        setStatus("connected");
      };

      ws.onmessage = (ev: MessageEvent<string>) => {
        const summary = parseSummaryMessage(ev.data);
        if (summary) setMetrics(summary);
      };

      ws.onerror = () => ws.close();

      ws.onclose = () => {
        if (socket !== ws) return; // socket obsoleto, ya reemplazado
        socket = null;
        if (disposed) return;
        setStatus("disconnected");
        const base = Math.min(INITIAL_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
        attempt += 1;
        setRetries(attempt);
        timer = window.setTimeout(connect, base * (0.75 + Math.random() * 0.5));
      };
    };

    const wake = () => {
      if (document.visibilityState === "visible" && !socket) {
        attempt = 0;
        connect();
      }
    };

    reconnectNow.current = () => {
      attempt = 0;
      if (socket) {
        detach(socket);
        socket.close();
        socket = null;
      }
      connect();
    };

    connect();
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", wake);
      if (socket) {
        detach(socket);
        socket.close();
        socket = null;
      }
      reconnectNow.current = () => undefined;
    };
  }, [url]);

  const reconnect = useCallback(() => reconnectNow.current(), []);

  return { metrics, status, isConnected: status === "connected", retries, reconnect };
}
