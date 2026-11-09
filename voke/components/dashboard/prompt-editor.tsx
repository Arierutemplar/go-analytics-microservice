"use client";

import dynamic from "next/dynamic";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { ShineBorder } from "@/components/ui/shine-border";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <Skeleton className="h-[280px] w-full" />,
});

export function PromptEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <ErrorBoundary fallback={<FallbackEditor value={value} onChange={onChange} />}>
      <div className="console-glow relative overflow-hidden rounded-xl bg-background/80">
        <ShineBorder />
        <MonacoEditor
          height="280px"
          language="markdown"
          theme="vs-dark"
          value={value}
          onChange={(next) => onChange(next ?? "")}
          beforeMount={(monaco) => {
            monaco.editor.defineTheme("voke", {
              base: "vs-dark",
              inherit: true,
              rules: [],
              colors: {
                "editor.background": "#121214",
                "editorLineNumber.foreground": "#d9b0ff",
                "editorLineNumber.activeForeground": "#bf7bff",
              },
            });
          }}
          onMount={(_editor, monaco) => {
            monaco.editor.setTheme("voke");
          }}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            scrollBeyondLastLine: false,
            wordWrap: "on",
            padding: { top: 12, bottom: 12 },
            automaticLayout: true,
            overviewRulerLanes: 0,
          }}
        />
      </div>
    </ErrorBoundary>
  );
}

function FallbackEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-[280px]"
      aria-label="Prompt"
    />
  );
}
