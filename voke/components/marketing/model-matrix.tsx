import { formatMs, formatPercent } from "@/lib/format";
import { MODELS } from "@/lib/models";
import { ShineBorder } from "@/components/ui/shine-border";
import { cn } from "@/lib/utils";
import type { ModelStatus } from "@/types";

const STATUS_LABEL: Record<ModelStatus, string> = {
  operational: "Operational",
  degraded: "Degraded",
  outage: "Outage",
};

export function ModelMatrix() {
  return (
    <section id="models" className="mx-auto max-w-6xl px-4 py-16">
      <div className="max-w-xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Status</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">Model uptime and p95</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Rolling 30-day figures from the Voke edge. Degraded means the provider is up, but tail latency is outside its usual band.
        </p>
      </div>
      <div className="panel relative mt-8 overflow-hidden rounded-xl">
        <ShineBorder />
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Model</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Uptime</th>
              <th className="px-4 py-3 font-medium">p50</th>
              <th className="px-4 py-3 font-medium">p95</th>
            </tr>
          </thead>
          <tbody>
            {MODELS.map((model) => (
              <tr key={model.id} className="border-b border-border/40 transition-colors duration-300 last:border-0 hover:bg-primary/10">
                <td className="px-4 py-3">
                  <div className="font-medium">{model.name}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">{model.id}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-2">
                    <span className="relative flex size-1.5">
                      {model.status === "operational" ? (
                        <span className="live-dot absolute inline-flex size-full rounded-full bg-primary" />
                      ) : null}
                      <span
                        className={cn(
                          "relative size-1.5 rounded-full",
                          model.status === "operational" && "bg-primary",
                          model.status === "degraded" && "bg-[#d9b0ff]",
                          model.status === "outage" && "bg-red-400",
                        )}
                      />
                    </span>
                    {STATUS_LABEL[model.status]}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{formatPercent(model.uptime30d)}</td>
                <td className="px-4 py-3 font-mono text-xs">{formatMs(model.p50Ms)}</td>
                <td className="px-4 py-3 font-mono text-xs text-primary">{formatMs(model.p95Ms)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
