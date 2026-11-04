import { BURST_SIZE, type SimKind, type Toast, type ToastKind } from "../hooks/useTrafficSimulator";

interface Props {
  active: SimKind | null;
  progress: { done: number; total: number };
  toast: Toast | null;
  /** Bloqueo externo (p. ej. una carga de prueba en curso en otro panel). */
  locked?: boolean;
  onBurst: () => void;
  onFailure: () => void;
  onDismissToast: () => void;
}

const TOAST_STYLES: Record<ToastKind, string> = {
  info: "border-indigo-500/50 bg-indigo-950 text-indigo-100",
  success: "border-emerald-500/50 bg-emerald-950 text-emerald-100",
  warning: "border-amber-500/50 bg-amber-950 text-amber-100",
  error: "border-red-500/50 bg-red-950 text-red-100",
};

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="opacity-90" />
    </svg>
  );
}

export default function TrafficSimulator({ active, progress, toast, locked = false, onBurst, onFailure, onDismissToast }: Props) {
  const busy = active !== null;
  const disabled = busy || locked;
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <h2 className="text-lg font-medium">Simulador de Tráfico</h2>
      <p className="mb-4 mt-1 text-xs text-slate-500">
        Genera tráfico de prueba para ver el pico en el gráfico en tiempo real y el flujo de la Dead Letter Queue.
      </p>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={onBurst}
          disabled={disabled}
          aria-busy={active === "burst"}
          className="inline-flex items-center gap-2 rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {active === "burst" ? <Spinner /> : <span aria-hidden="true">⚡</span>}
          Simular Ráfaga ({BURST_SIZE} Eventos)
        </button>
        <button
          onClick={onFailure}
          disabled={disabled}
          aria-busy={active === "dlq"}
          className="inline-flex items-center gap-2 rounded-md border border-red-500/60 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {active === "dlq" ? <Spinner /> : <span aria-hidden="true">☠️</span>}
          Simular Fallo (DLQ)
        </button>
      </div>

      {active === "burst" && (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {progress.done} / {progress.total} ({pct}%)
          </p>
        </div>
      )}
      {locked && !busy && <p className="mt-3 text-xs text-slate-500">Hay una carga de prueba en curso; espera a que termine.</p>}
      <p className="mt-3 text-xs text-slate-600">
        El fallo envía un evento con un carácter <code>\u0000</code> que PostgreSQL rechaza en JSONB: con NATS activo termina en <code>analytics.dlq</code>{" "}
        sin reintentos. Sin NATS (modo directo) solo se registra el error en el log del backend.
      </p>

      <div aria-live="polite" className="pointer-events-none fixed bottom-6 right-6 z-50 max-w-sm">
        {toast && (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-xl ${TOAST_STYLES[toast.kind]}`}
            style={{ animation: "slideIn .25s ease-out" }}
          >
            {toast.kind === "info" && <Spinner />}
            <span className="flex-1">{toast.message}</span>
            {toast.kind !== "info" && (
              <button onClick={onDismissToast} aria-label="Cerrar" className="text-current opacity-60 hover:opacity-100">
                ✕
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
