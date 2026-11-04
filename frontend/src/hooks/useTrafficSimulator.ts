import { useCallback, useEffect, useRef, useState } from "react";
import { postEvent, type Outcome, type TestEventInput } from "./useIngest";

export type SimKind = "burst" | "dlq";
export type ToastKind = "info" | "success" | "warning" | "error";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

export const BURST_SIZE = 50;
const BURST_CONCURRENCY = 5;
const MAX_RATE_LIMIT_RETRIES = 40;
const RETRY_DELAY_MS = 150;
const TOAST_MS = 5000;

const ACTIONS = ["click", "scroll", "hover", "submit", "navigate", "download"];
const rnd = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(arr: T[]): T => arr[rnd(arr.length)];

const randomActionEvent = (i: number): TestEventInput => ({
  event_type: "user_action",
  user_id: `sim-user-${rnd(50) + 1}`,
  payload: {
    action: pick(ACTIONS),
    seq: i,
    x: rnd(1920),
    y: rnd(1080),
    session: Math.random().toString(36).slice(2, 10),
  },
});

// Un "\u0000" dentro de un JSONB hace fallar el INSERT en PostgreSQL (SQLSTATE 22P05,
// clase 22 = error de datos): el consumer lo marca como permanente y lo envía a la DLQ.
const poisonEvent = (): TestEventInput => ({
  event_type: "user_action",
  user_id: "sim-dlq",
  payload: { unknown_type_fail: true, reason: "simulacion DLQ", poison: "\u0000" },
});

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const id = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (window.clearTimeout(id), resolve()), { once: true });
  });

/** Envía un evento reintentando los 429 del rate limiter para que la ráfaga llegue completa. */
async function postWithRetry(ev: TestEventInput, signal: AbortSignal): Promise<{ outcome: Outcome; error?: string }> {
  let res = await postEvent(ev, signal);
  for (let i = 0; i < MAX_RATE_LIMIT_RETRIES && res.outcome === "rateLimited" && !signal.aborted; i++) {
    await sleep(RETRY_DELAY_MS, signal);
    res = await postEvent(ev, signal);
  }
  return res;
}

interface Options {
  /** Se llama con el resultado final de cada evento para alimentar las estadísticas. */
  onResult?: (r: { outcome: Outcome; error?: string }) => void;
}

export function useTrafficSimulator({ onResult }: Options = {}) {
  const [active, setActive] = useState<SimKind | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [toast, setToast] = useState<Toast | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const runningRef = useRef(false); // evita doble clic antes de que React pinte `active`
  const toastId = useRef(0);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const show = useCallback((kind: ToastKind, message: string, autoDismiss = true) => {
    window.clearTimeout(timerRef.current);
    setToast({ id: ++toastId.current, kind, message });
    if (autoDismiss) timerRef.current = window.setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  const dismiss = useCallback(() => {
    window.clearTimeout(timerRef.current);
    setToast(null);
  }, []);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      window.clearTimeout(timerRef.current);
    },
    [],
  );

  const run = useCallback(
    async (kind: SimKind, events: TestEventInput[], concurrency: number) => {
      if (runningRef.current) return;
      runningRef.current = true;
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setActive(kind);
      setProgress({ done: 0, total: events.length });
      const label = kind === "burst" ? `ráfaga de ${events.length} eventos` : "evento de fallo (DLQ)";
      show("info", `Enviando ${label}…`, false);

      let next = 0;
      let done = 0;
      let accepted = 0;
      let lastError: string | undefined;
      const worker = async () => {
        while (!ctrl.signal.aborted) {
          const i = next++;
          if (i >= events.length) return;
          const res = await postWithRetry(events[i], ctrl.signal);
          if (ctrl.signal.aborted) return;
          if (res.outcome === "accepted") accepted++;
          else lastError = res.error;
          onResultRef.current?.(res);
          setProgress({ done: ++done, total: events.length });
        }
      };
      await Promise.all(Array.from({ length: Math.min(concurrency, events.length) }, worker));

      runningRef.current = false;
      abortRef.current = null;
      setActive(null);
      if (ctrl.signal.aborted) return; // desmontado: no hay UI que actualizar

      if (accepted === events.length) {
        show(
          "success",
          kind === "burst"
            ? `Ráfaga completada: ${accepted}/${events.length} eventos aceptados.`
            : "Evento de fallo aceptado: se enviará a la DLQ tras fallar su inserción.",
        );
      } else {
        show(
          accepted === 0 ? "error" : "warning",
          `${accepted}/${events.length} eventos aceptados${lastError ? ` · último error: ${lastError}` : ""}.`,
        );
      }
    },
    [show],
  );

  const simulateBurst = useCallback(
    () => run("burst", Array.from({ length: BURST_SIZE }, (_, i) => randomActionEvent(i)), BURST_CONCURRENCY),
    [run],
  );
  const simulateFailure = useCallback(() => run("dlq", [poisonEvent()], 1), [run]);

  return { active, progress, toast, dismiss, simulateBurst, simulateFailure };
}
