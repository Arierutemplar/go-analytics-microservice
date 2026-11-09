"use client";

import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";

const SVG_NS = "http://www.w3.org/2000/svg";
const VIOLET = "#bf7bff";

type GridNode = {
  ox: number;
  oy: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  el: SVGCircleElement;
};

type Segment = {
  el: SVGLineElement;
  a: GridNode;
  b: GridNode;
};

type BackgroundGridProps = {
  className?: string;
  gridSize?: number;
  dotSize?: number;
  glowRadius?: number;
};

export function BackgroundGrid({
  className,
  gridSize = 80,
  dotSize = 1.6,
  glowRadius = 112,
}: BackgroundGridProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const glowId = useId().replace(/:/g, "");

  useEffect(() => {
    const host = hostRef.current;
    const svg = svgRef.current;
    if (!host || !svg) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nodes: GridNode[] = [];
    const segments: Segment[] = [];
    let cursorGlow: SVGCircleElement | null = null;
    const mouse = { x: 0, y: 0, active: false };
    let glow = 0;
    let frame = 0;
    let running = false;

    const clear = () => {
      nodes.length = 0;
      segments.length = 0;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
    };

    const build = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      clear();
      if (width < 1 || height < 1) return;

      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      const defs = document.createElementNS(SVG_NS, "defs");
      const gradient = document.createElementNS(SVG_NS, "radialGradient");
      gradient.setAttribute("id", glowId);
      const inner = document.createElementNS(SVG_NS, "stop");
      inner.setAttribute("offset", "0%");
      inner.setAttribute("stop-color", VIOLET);
      inner.setAttribute("stop-opacity", "0.2");
      const outer = document.createElementNS(SVG_NS, "stop");
      outer.setAttribute("offset", "70%");
      outer.setAttribute("stop-color", VIOLET);
      outer.setAttribute("stop-opacity", "0");
      gradient.append(inner, outer);
      defs.appendChild(gradient);
      svg.appendChild(defs);
      cursorGlow = document.createElementNS(SVG_NS, "circle");
      cursorGlow.setAttribute("r", String(glowRadius));
      cursorGlow.setAttribute("fill", `url(#${glowId})`);
      cursorGlow.setAttribute("opacity", "0");
      svg.appendChild(cursorGlow);
      const cols = Math.ceil(width / gridSize) + 1;
      const rows = Math.ceil(height / gridSize) + 1;
      const grid: GridNode[][] = [];

      for (let row = 0; row < rows; row += 1) {
        const line: GridNode[] = [];
        for (let col = 0; col < cols; col += 1) {
          const ox = col * gridSize;
          const oy = row * gridSize;
          const el = document.createElementNS(SVG_NS, "circle");
          el.setAttribute("cx", String(ox));
          el.setAttribute("cy", String(oy));
          el.setAttribute("r", String(dotSize));
          el.setAttribute("fill", VIOLET);
          el.setAttribute("fill-opacity", "0.28");
          svg.appendChild(el);
          const node: GridNode = { ox, oy, x: ox, y: oy, tx: ox, ty: oy, el };
          line.push(node);
          nodes.push(node);
        }
        grid.push(line);
      }

      const addSegment = (a: GridNode | undefined, b: GridNode | undefined) => {
        if (!a || !b) return;
        const el = document.createElementNS(SVG_NS, "line");
        el.setAttribute("x1", String(a.ox));
        el.setAttribute("y1", String(a.oy));
        el.setAttribute("x2", String(b.ox));
        el.setAttribute("y2", String(b.oy));
        el.setAttribute("stroke", VIOLET);
        el.setAttribute("stroke-opacity", "0.06");
        el.setAttribute("stroke-width", "1");
        svg.insertBefore(el, svg.firstChild);
        segments.push({ el, a, b });
      };

      for (const line of grid) {
        for (let col = 0; col < line.length - 1; col += 1) {
          addSegment(line[col], line[col + 1]);
        }
      }
      for (let col = 0; col < cols; col += 1) {
        for (let row = 0; row < rows - 1; row += 1) {
          addSegment(grid[row]?.[col], grid[row + 1]?.[col]);
        }
      }
    };

    const influence = (x: number, y: number) => {
      const dx = x - mouse.x;
      const dy = y - mouse.y;
      const dist = Math.hypot(dx, dy);
      const t = Math.max(0, 1 - dist / glowRadius);
      return { dx, dy, dist, falloff: t * t * (3 - 2 * t) };
    };

    const paint = () => {
      const ease = mouse.active ? 0.08 : 0.035;
      glow += ((mouse.active ? 1 : 0) - glow) * ease;
      let maxDelta = Math.abs((mouse.active ? 1 : 0) - glow);
      for (const node of nodes) {
        if (mouse.active) {
          const { dx, dy, dist, falloff } = influence(node.ox, node.oy);
          const length = dist || 1;
          const push = falloff * 10;
          node.tx = node.ox + (dx / length) * push;
          node.ty = node.oy + (dy / length) * push;
        } else {
          node.tx = node.ox;
          node.ty = node.oy;
        }
        node.x += (node.tx - node.x) * ease;
        node.y += (node.ty - node.y) * ease;
        maxDelta = Math.max(maxDelta, Math.abs(node.tx - node.x), Math.abs(node.ty - node.y));
        const { falloff } = influence(node.ox, node.oy);
        const hot = falloff * glow;
        node.el.setAttribute("cx", node.x.toFixed(2));
        node.el.setAttribute("cy", node.y.toFixed(2));
        node.el.setAttribute("r", (dotSize + hot * 1.8).toFixed(2));
        node.el.setAttribute("fill-opacity", (0.22 + hot * 0.78).toFixed(3));
      }

      for (const segment of segments) {
        segment.el.setAttribute("x1", segment.a.x.toFixed(2));
        segment.el.setAttribute("y1", segment.a.y.toFixed(2));
        segment.el.setAttribute("x2", segment.b.x.toFixed(2));
        segment.el.setAttribute("y2", segment.b.y.toFixed(2));
        const midX = (segment.a.ox + segment.b.ox) / 2;
        const midY = (segment.a.oy + segment.b.oy) / 2;
        const { falloff } = influence(midX, midY);
        segment.el.setAttribute("stroke-opacity", (0.06 + falloff * glow * 0.62).toFixed(3));
      }
      if (cursorGlow) {
        cursorGlow.setAttribute("cx", mouse.x.toFixed(2));
        cursorGlow.setAttribute("cy", mouse.y.toFixed(2));
        cursorGlow.setAttribute("opacity", glow.toFixed(3));
      }
      return maxDelta;
    };

    const stop = () => {
      running = false;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };

    const tick = () => {
      const maxDelta = paint();
      if (!mouse.active && maxDelta < 0.05) {
        stop();
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (running || reduced) return;
      running = true;
      frame = requestAnimationFrame(tick);
    };

    const onMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      mouse.x = event.clientX - rect.left;
      mouse.y = event.clientY - rect.top;
      const inside =
        mouse.x >= 0 && mouse.y >= 0 && mouse.x <= rect.width && mouse.y <= rect.height;
      mouse.active = inside;
      if (inside) start();
    };

    const onLeave = () => {
      mouse.active = false;
      start();
    };

    build();
    const observer = new ResizeObserver(build);
    observer.observe(host);

    if (!reduced) {
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("blur", onLeave);
      document.addEventListener("mouseleave", onLeave);
    }

    const onVisibility = () => {
      if (document.hidden) stop();
      else if (mouse.active) start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      observer.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("blur", onLeave);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      clear();
    };
  }, [dotSize, glowId, glowRadius, gridSize]);

  return (
    <div
      ref={hostRef}
      aria-hidden
      className={cn("pointer-events-none overflow-hidden bg-background", className)}
    >
      <svg ref={svgRef} className="h-full w-full" />
    </div>
  );
}
