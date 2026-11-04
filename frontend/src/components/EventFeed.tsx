import { formatPayload, typeColor } from "../lib/format";
import type { FeedItem } from "../types/analytics";

interface EventFeedProps {
  items: FeedItem[];
}

export default function EventFeed({ items }: EventFeedProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-medium">Feed en tiempo real</h2>
        <span className="text-xs text-slate-500">últimos {items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">Esperando eventos…</p>
      ) : (
        <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
          {items.map((it, i) => (
            <li
              key={it.seq}
              className={`rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm ${
                i === 0 ? "[animation:slideIn_0.5s_ease-out]" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className={`flex items-center gap-2 font-medium ${typeColor(it.event.event_type).text}`}>
                  <span className={`h-2 w-2 rounded-full ${typeColor(it.event.event_type).dot}`} />
                  {it.event.event_type || "(sin tipo)"}
                </span>
                <time className="text-xs text-slate-500">{new Date(it.receivedAt).toLocaleTimeString()}</time>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-slate-400">
                <span>
                  usuario <span className="font-mono text-slate-300">{it.event.user_id || "—"}</span>
                </span>
                <span className="truncate">
                  id <span className="font-mono text-slate-300">{it.event.id || "—"}</span>
                </span>
              </div>
              <p className="mt-1 truncate font-mono text-xs text-slate-500" title={formatPayload(it.event.payload)}>
                {formatPayload(it.event.payload)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
