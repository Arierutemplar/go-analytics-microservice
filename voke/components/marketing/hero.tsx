"use client";

import { useState } from "react";
import { MODELS } from "@/lib/models";
import { heroSample } from "@/lib/snippets";
import { ShineBorder } from "@/components/ui/shine-border";
import { cn } from "@/lib/utils";
import type { HeroLanguage } from "@/types";

const LANGUAGES: { id: HeroLanguage; label: string }[] = [
  { id: "javascript", label: "JavaScript" },
  { id: "python", label: "Python" },
  { id: "curl", label: "cURL" },
];

export function Hero() {
  const [language, setLanguage] = useState<HeroLanguage>("javascript");
  const [modelId, setModelId] = useState("anthropic/claude-sonnet-4.5");
  const source = heroSample(language, modelId);

  return (
    <section className="mx-auto grid max-w-6xl gap-12 px-4 py-16 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:py-24">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Flat monthly rate
        </p>
        <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight text-balance md:text-5xl">
          One endpoint. Every model. One line to switch.
        </h1>
        <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
          Voke is an OpenAI-compatible proxy. Point your SDK at a single URL, pick a model id, and stop
          reconciling four invoices at the end of the month.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="#pricing" className="neon-cta inline-flex h-10 items-center px-4 text-sm font-medium hover:scale-[1.02]">
            Compare the flat rate
          </a>
          <a
            href="/playground"
            className="neon-cta inline-flex h-10 items-center px-4 text-sm font-medium hover:scale-[1.02]"
          >
            Open the playground
          </a>
        </div>
      </div>
      <div className="panel console-glow relative overflow-hidden rounded-xl">
        <ShineBorder />
        <div className="flex items-center justify-between gap-3 border-b border-border/40 px-3 py-2">
          <div className="flex gap-1">
            {LANGUAGES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setLanguage(item.id)}
                className={cn(
                  "cursor-pointer select-none rounded-sm px-2 py-1 font-mono text-[11px] text-muted-foreground transition-all duration-200",
                  language === item.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-purple-900/30 hover:text-[#d9b0ff] hover:shadow-[0_0_10px_rgba(191,123,255,0.4)]",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">model id only</span>
        </div>
        <div className="flex gap-1 overflow-x-auto border-b border-border/40 px-3 py-2">
          {MODELS.map((model) => (
            <button
              key={model.id}
              type="button"
              onClick={() => setModelId(model.id)}
              className={cn(
                "shrink-0 cursor-pointer select-none rounded-full border border-border/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground transition-all duration-200",
                modelId === model.id
                  ? "border-primary/70 bg-primary/10 text-primary"
                  : "hover:bg-purple-900/30 hover:text-[#d9b0ff] hover:shadow-[0_0_10px_rgba(191,123,255,0.4)]",
              )}
            >
              {model.id}
            </button>
          ))}
        </div>
        <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-6 text-foreground/80">
          {source.split("\n").map((line, index) => (
            <div
              key={`${index}-${line}`}
              className={
                line.includes(modelId)
                  ? "-mx-4 border-l-2 border-primary bg-primary/10 px-4 text-primary shadow-[inset_0_0_28px_color-mix(in_srgb,var(--primary)_22%,transparent)]"
                  : undefined
              }
            >
              {line.length > 0 ? line : " "}
            </div>
          ))}
        </pre>
      </div>
    </section>
  );
}
