import { useEffect, useState } from "react";

/** Devuelve true durante `ms` milisegundos cada vez que `trigger` cambia (y no es null). */
export function useFlash(trigger: unknown, ms = 600): boolean {
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (trigger == null) return;
    setFlash(true);
    const t = window.setTimeout(() => setFlash(false), ms);
    return () => window.clearTimeout(t);
  }, [trigger, ms]);

  return flash;
}
