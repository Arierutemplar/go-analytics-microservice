import type { ConnectionStatus } from "../types/analytics";

const STYLES: Record<ConnectionStatus, { box: string; dot: string; label: string }> = {
  connected: { box: "bg-emerald-500/10 text-emerald-400", dot: "bg-emerald-400", label: "Conectado" },
  connecting: { box: "bg-amber-500/10 text-amber-400", dot: "bg-amber-400", label: "Conectando…" },
  disconnected: { box: "bg-red-500/10 text-red-400", dot: "bg-red-400", label: "Desconectado" },
};

interface Props {
  status: ConnectionStatus;
  retries: number;
  onReconnect: () => void;
}

export default function ConnectionBadge({ status, retries, onReconnect }: Props) {
  const s = STYLES[status];
  return (
    <div className="flex items-center gap-3">
      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${s.box}`} role="status">
        <span className="relative flex h-2.5 w-2.5">
          {status !== "disconnected" && (
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${s.dot}`} />
          )}
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${s.dot}`} />
        </span>
        {s.label}
        {status === "disconnected" && retries > 0 && <span className="text-xs opacity-70">· reintento {retries}</span>}
      </span>
      {status === "disconnected" && (
        <button
          onClick={onReconnect}
          className="rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
        >
          Reconectar ahora
        </button>
      )}
    </div>
  );
}
