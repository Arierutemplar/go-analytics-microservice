import type { IngestStats } from "../hooks/useIngest";
import type { ConnectionStatus } from "../types/analytics";

interface Props {
  dlqEvents: number | undefined; // solo si el backend lo transmite
  ingest: IngestStats;
  status: ConnectionStatus;
}

/**
 * Salud del flujo: eventos en la DLQ (si la transmisión los incluye) y rechazos
 * observados al enviar eventos de prueba desde este panel.
 */
export default function HealthIndicator({ dlqEvents, ingest, status }: Props) {
  const rejections = ingest.rateLimited + ingest.rejected + ingest.failed;
  const hasDlq = dlqEvents !== undefined;
  const dlqBad = hasDlq && dlqEvents > 0;
  const bad = dlqBad || ingest.rejected + ingest.failed > 0;
  const warn = !bad && (ingest.rateLimited > 0 || status === "disconnected");

  const tone = bad
    ? "border-red-500/40 bg-red-500/10"
    : warn
      ? "border-amber-500/40 bg-amber-500/10"
      : "border-slate-800 bg-slate-900";
  const title = bad ? "Atención: hay errores" : warn ? "Advertencias" : "Sin errores";

  return (
    <section className={`rounded-2xl border p-6 transition-colors ${tone}`} aria-live="polite">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-medium">
        <span
          className={`h-2.5 w-2.5 rounded-full ${bad ? "animate-pulse bg-red-400" : warn ? "bg-amber-400" : "bg-emerald-400"}`}
        />
        {title}
      </h2>
      <dl className="space-y-2 text-sm">
        <Line
          label="Dead Letter Queue"
          value={hasDlq ? dlqEvents.toLocaleString() : "no disponible"}
          danger={dlqBad}
          hint={hasDlq ? undefined : "el backend no lo incluye en la transmisión"}
        />
        <Line label="Rechazos 503 (cola llena / NATS)" value={ingest.rejected.toLocaleString()} danger={ingest.rejected > 0} />
        <Line label="Límite de peticiones 429" value={ingest.rateLimited.toLocaleString()} warn={ingest.rateLimited > 0} />
        <Line label="Errores de red / otros" value={ingest.failed.toLocaleString()} danger={ingest.failed > 0} />
      </dl>
      {rejections > 0 && ingest.lastError && (
        <p className="mt-3 truncate rounded bg-slate-950/60 px-2 py-1 font-mono text-xs text-slate-400" title={ingest.lastError}>
          último: {ingest.lastError}
        </p>
      )}
    </section>
  );
}

function Line({
  label,
  value,
  danger,
  warn,
  hint,
}: {
  label: string;
  value: string;
  danger?: boolean;
  warn?: boolean;
  hint?: string;
}) {
  const color = danger ? "text-red-400" : warn ? "text-amber-400" : "text-slate-200";
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-slate-400" title={hint}>
        {label}
      </dt>
      <dd className={`font-mono tabular-nums ${color}`}>{value}</dd>
    </div>
  );
}
