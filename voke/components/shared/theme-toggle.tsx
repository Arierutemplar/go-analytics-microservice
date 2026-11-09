"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const dark = !mounted || resolvedTheme !== "light";

  return (
    <label className="ui-switch" aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}>
      <input
        type="checkbox"
        role="switch"
        checked={dark}
        onChange={(event) => setTheme(event.target.checked ? "dark" : "light")}
      />
      <span className="slider">
        <span className="circle" />
      </span>
    </label>
  );
}
