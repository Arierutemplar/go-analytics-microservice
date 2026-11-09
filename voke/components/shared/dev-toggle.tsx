"use client";

import { useEffect } from "react";

const LIGHT_SHADOW = `
  0 15px 25px -4px rgba(0, 0, 0, 0.5),
  inset 0 -3px 4px -1px rgba(0, 0, 0, 0.2),
  0 -10px 15px -1px rgba(255, 255, 255, 0.6),
  inset 0 3px 4px -1px rgba(255, 255, 255, 0.2),
  inset 0 0 5px 1px rgba(255, 255, 255, 0.8),
  inset 0 20px 30px 0 rgba(255, 255, 255, 0.2)
`;

const LIGHT_PRESSED = `
  0 12px 25px -4px rgba(0, 0, 0, 0.4),
  inset 0 -8px 30px 1px rgba(255, 255, 255, 0.9),
  0 -10px 15px -1px rgba(255, 255, 255, 0.6),
  inset 0 8px 25px 0 rgba(0, 0, 0, 0.4),
  inset 0 0 10px 1px rgba(255, 255, 255, 0.6)
`;

const DARK_SHADOW = `
  8px 8px 16px rgba(0, 0, 0, 0.72),
  -4px -4px 12px rgba(255, 255, 255, 0.05),
  inset 0 1px 0 rgba(255, 255, 255, 0.08),
  inset 0 -10px 16px rgba(0, 0, 0, 0.55)
`;

const DARK_PRESSED = `
  inset 6px 6px 12px rgba(0, 0, 0, 0.72),
  inset -3px -3px 8px rgba(255, 255, 255, 0.04)
`;

function toggleCss(dark: boolean): string {
  const face = dark ? "#18181b" : "#e8e8e8";
  const shadow = dark ? DARK_SHADOW : LIGHT_SHADOW;
  const pressed = dark ? DARK_PRESSED : LIGHT_PRESSED;

  return `
[data-next-badge="true"] {
  width: 56px !important;
  height: 56px !important;
  padding: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  overflow: visible !important;
}

#next-logo.toggle,
#next-logo {
  position: relative;
  width: 56px !important;
  height: 56px !important;
  min-width: 56px;
  padding: 0 !important;
  margin: 0 !important;
  border: 0 !important;
  border-radius: 9999px !important;
  background: ${face} !important;
  background-image: none !important;
  box-shadow: ${shadow} !important;
  color: #d9b0ff !important;
  display: grid !important;
  place-items: center;
  cursor: pointer;
  overflow: hidden !important;
  transition: box-shadow 300ms cubic-bezier(0.23, 1, 0.32, 1), filter 300ms cubic-bezier(0.23, 1, 0.32, 1);
}

#next-logo svg,
#next-logo > * {
  display: none !important;
}

#next-logo::before {
  content: none !important;
  display: none !important;
}

#next-logo::after {
  content: "N";
  color: #d9b0ff;
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-weight: 700;
  font-size: 18px;
  line-height: 1;
  letter-spacing: -0.04em;
  text-shadow: 0 0 6px rgba(191, 123, 255, 0.7);
  pointer-events: none;
}

#next-logo:hover::after {
  text-shadow:
    0 0 6px rgba(191, 123, 255, 0.7),
    0 0 12px rgba(191, 123, 255, 0.55);
}

#next-logo:active {
  filter: blur(0.5px);
  box-shadow: ${pressed} !important;
}

@media (prefers-reduced-motion: reduce) {
  #next-logo,
  #next-logo:active {
    transition: none;
    filter: none;
  }
}
${dark ? MENU_DARK_CSS : ""}
`;
}

const MENU_DARK_CSS = `
#nextjs-dev-tools-menu {
  background-color: #18181b !important;
  color: #f4f4f5 !important;
  border-color: #27272a !important;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45) !important;
}

#nextjs-dev-tools-menu .dev-tools-indicator-footer {
  background: #18181b !important;
  border-top-color: #27272a !important;
}

#nextjs-dev-tools-menu .dev-tools-indicator-item[data-selected="true"] {
  background-color: #27272a !important;
}

#nextjs-dev-tools-menu .dev-tools-indicator-label {
  color: #f4f4f5 !important;
}

#nextjs-dev-tools-menu .dev-tools-indicator-value {
  color: #a1a1aa !important;
}

#nextjs-dev-tools-menu .dev-tools-indicator-value svg path {
  fill: #a1a1aa !important;
}

#nextjs-dev-tools-menu kbd {
  background: #27272a !important;
  color: #f4f4f5 !important;
  border-color: #3f3f46 !important;
}
`;

export function DevToggle() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    let shadowObserver: MutationObserver | null = null;

    const apply = () => {
      const root = document.querySelector("nextjs-portal")?.shadowRoot;
      if (!root) return;
      root.querySelector("#next-logo")?.classList.add("toggle");
      let style = root.querySelector<HTMLStyleElement>("#voke-dev-toggle");
      if (!style) {
        style = document.createElement("style");
        style.id = "voke-dev-toggle";
        root.append(style);
      }
      const dark = document.documentElement.classList.contains("dark");
      const next = toggleCss(dark);
      if (style.textContent !== next) style.textContent = next;
      if (!shadowObserver) {
        shadowObserver = new MutationObserver(apply);
        shadowObserver.observe(root, { childList: true });
      }
    };

    apply();
    const bodyObserver = new MutationObserver(apply);
    bodyObserver.observe(document.body, { childList: true });
    const themeObserver = new MutationObserver(apply);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      shadowObserver?.disconnect();
      bodyObserver.disconnect();
      themeObserver.disconnect();
      const root = document.querySelector("nextjs-portal")?.shadowRoot;
      root?.querySelector("#voke-dev-toggle")?.remove();
      root?.querySelector("#next-logo")?.classList.remove("toggle");
    };
  }, []);

  return null;
}
