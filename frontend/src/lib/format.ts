export function formatPayload(p: unknown): string {
  if (p === undefined || p === null) return "—";
  return typeof p === "string" ? p : JSON.stringify(p);
}

const PALETTE = [
  { bar: "bg-indigo-500", dot: "bg-indigo-400", text: "text-indigo-300" },
  { bar: "bg-emerald-500", dot: "bg-emerald-400", text: "text-emerald-300" },
  { bar: "bg-amber-500", dot: "bg-amber-400", text: "text-amber-300" },
  { bar: "bg-sky-500", dot: "bg-sky-400", text: "text-sky-300" },
  { bar: "bg-fuchsia-500", dot: "bg-fuchsia-400", text: "text-fuchsia-300" },
  { bar: "bg-rose-500", dot: "bg-rose-400", text: "text-rose-300" },
];

/** Color estable por tipo de evento. */
export function typeColor(type: string) {
  let h = 0;
  for (let i = 0; i < type.length; i++) h = (h * 31 + type.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
