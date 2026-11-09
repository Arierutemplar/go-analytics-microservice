"use client";

import type { CSSProperties, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const VIOLET_SHINE = ["#d9b0ff", "#bf7bff", "#643d88"];

type ShineBorderProps = HTMLAttributes<HTMLDivElement> & {
  borderWidth?: number;
  duration?: number;
  shineColor?: string | string[];
};

export function ShineBorder({
  borderWidth = 1,
  duration = 12,
  shineColor = VIOLET_SHINE,
  className,
  style,
  ...props
}: ShineBorderProps) {
  return (
    <div
      style={
        {
          "--border-width": `${borderWidth}px`,
          "--duration": `${duration}s`,
          backgroundImage: `radial-gradient(transparent, transparent, ${
            Array.isArray(shineColor) ? shineColor.join(",") : shineColor
          }, transparent, transparent)`,
          ...style,
        } as CSSProperties
      }
      className={cn(
        "shine-border pointer-events-none absolute inset-0 size-full rounded-[inherit] will-change-[background-position] motion-safe:animate-shine",
        className,
      )}
      {...props}
    />
  );
}
