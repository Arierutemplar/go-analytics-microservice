import { typeColor } from "../lib/format";

interface EventTypeChartProps {
  data: Record<string, number> | null;
}

export default function EventTypeChart({ data }: EventTypeChartProps) {
  const rows = Object.entries(data ?? {}).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((acc, [, n]) => acc + n, 0);
  const max = rows[0]?.[1] ?? 1;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <h2 className="mb-4 text-lg font-medium">Eventos por tipo</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Sin datos todavía.</p>
      ) : (
        <>
          {/* Barra apilada con la proporción de cada tipo */}
          <div className="mb-5 flex h-3 overflow-hidden rounded-full bg-slate-800">
            {rows.map(([type, n]) => (
              <div
                key={type}
                title={`${type}: ${n}`}
                className={`${typeColor(type).bar} transition-all duration-500`}
                style={{ width: `${(n / total) * 100}%` }}
              />
            ))}
          </div>
          <ul className="space-y-3">
            {rows.map(([type, n]) => (
              <li key={type}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-300">
                    <span className={`h-2 w-2 rounded-full ${typeColor(type).dot}`} />
                    {type || "(sin tipo)"}
                  </span>
                  <span className="tabular-nums text-slate-400">
                    {n.toLocaleString()} · {((n / total) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full ${typeColor(type).bar} transition-all duration-500`}
                    style={{ width: `${(n / max) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
