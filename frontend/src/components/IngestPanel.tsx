import { useState } from "react";
import type { IngestStats, LoadProgress, TestEventInput } from "../hooks/useIngest";

const TYPES = ["click", "page_view", "purchase", "signup", "error"];
const LOADS = [50, 200, 1000];

interface Props {
  stats: IngestStats;
  progress: LoadProgress;
  sendOne: (ev: TestEventInput) => Promise<void>;
  sendLoad: (total: number, make: (i: number) => TestEventInput, concurrency?: number) => Promise<void>;
  cancel: () => void;
  reset: () => void;
  /** Bloqueo externo (p. ej. el Simulador de Tráfico está enviando). */
  locked?: boolean;
}

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export default function IngestPanel({ stats, progress, sendOne, sendLoad, cancel, reset, locked = false }: Props) {
  const [type, setType] = useState("click");
  const [user, setUser] = useState("user-1");
  const [payloadText, setPayloadText] = useState('{"button":"buy","page":"/home"}');
  const [mixed, setMixed] = useState(true);

  // Un payload JSON válido se envía como objeto; si no, como texto plano
  const parsePayload = (): unknown => {
    const t = payloadText.trim();
    if (!t) return undefined;
    try {
      return JSON.parse(t);
    } catch {
      return t;
    }
  };

  const payloadIsJson = (() => {
    try {
      JSON.parse(payloadText);
      return true;
    } catch {
      return false;
    }
  })();

  const makeLoadEvent = (i: number): TestEventInput => ({
    event_type: mixed ? pick(TYPES) : type,
    user_id: `load-${(i % 25) + 1}`,
    payload: i % 2 === 0 ? { n: i, nested: { ok: true } } : `carga-${i}`,
  });

  const busy = progress.running;
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <h2 className="mb-4 text-lg font-medium">Panel de pruebas de ingestión</h2>

      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void sendOne({ event_type: type, user_id: user, payload: parsePayload() });
        }}
      >
        <label className="text-xs text-slate-400">
          Tipo de evento
          <input
            list="event-types"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500"
          />
          <datalist id="event-types">
            {TYPES.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>
        <label className="text-xs text-slate-400">
          Usuario
          <input
            value={user}
            onChange={(e) => setUser(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500"
          />
        </label>
        <label className="text-xs text-slate-400 sm:col-span-2">
          Payload ({payloadText.trim() === "" ? "vacío" : payloadIsJson ? "JSON" : "texto"})
          <textarea
            value={payloadText}
            onChange={(e) => setPayloadText(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100 outline-none focus:border-indigo-500"
          />
        </label>

        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button
            type="submit"
            className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 active:scale-95"
          >
            Enviar evento
          </button>
          <button
            type="button"
            onClick={() => void sendOne({ event_type: "click", user_id: user, payload: { x: Math.round(Math.random() * 1920), y: Math.round(Math.random() * 1080) } })}
            className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 active:scale-95"
          >
            🖱️ Simular clic
          </button>
          <button
            type="button"
            onClick={() => void sendOne({ event_type: "page_view", user_id: user, payload: "/dashboard" })}
            className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 active:scale-95"
          >
            📄 Vista de página
          </button>
        </div>
      </form>

      <div className="mt-6 border-t border-slate-800 pt-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-300">Carga de prueba</h3>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input type="checkbox" checked={mixed} onChange={(e) => setMixed(e.target.checked)} />
            tipos variados
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {LOADS.map((n) => (
            <button
              key={n}
              disabled={busy || locked}
              onClick={() => void sendLoad(n, makeLoadEvent)}
              className="rounded-md border border-indigo-500/50 bg-indigo-500/10 px-4 py-2 text-sm text-indigo-300 hover:bg-indigo-500/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ⚡ {n.toLocaleString()} eventos
            </button>
          ))}
          {busy && (
            <button onClick={cancel} className="rounded-md border border-red-500/50 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10">
              Cancelar
            </button>
          )}
        </div>
        {(busy || progress.total > 0) && (
          <div className="mt-3">
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {progress.done.toLocaleString()} / {progress.total.toLocaleString()} ({pct}%)
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between rounded-lg bg-slate-950/60 px-3 py-2 text-xs text-slate-400">
        <span>
          enviados <b className="text-slate-200">{stats.sent}</b> · aceptados <b className="text-emerald-400">{stats.accepted}</b> ·
          rechazados <b className="text-red-400">{stats.rateLimited + stats.rejected + stats.failed}</b>
        </span>
        <button onClick={reset} className="text-slate-500 underline hover:text-slate-300">
          reiniciar
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-600">
        El backend limita a 20 req/s por IP (ráfaga 40): las cargas grandes mostrarán 429, es el comportamiento esperado.
      </p>
    </section>
  );
}
