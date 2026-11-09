"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Square } from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { PromptEditor } from "@/components/dashboard/prompt-editor";
import { useOrg } from "@/components/shared/org-provider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ShineBorder } from "@/components/ui/shine-border";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, listApiKeys, runCompletion } from "@/lib/api";
import { formatInteger, formatMs } from "@/lib/format";
import { MODELS } from "@/lib/models";
import { playgroundSnippet } from "@/lib/snippets";
import type { CompletionResult, PlaygroundLanguage } from "@/types";

const LANGUAGES: { id: PlaygroundLanguage; label: string }[] = [
  { id: "curl", label: "cURL" },
  { id: "node", label: "Node.js" },
  { id: "python", label: "Python" },
  { id: "go", label: "Go" },
];

function messageFrom(error: unknown): string {
  if (error instanceof ApiError) return `${error.message} · ${error.requestId}`;
  if (error instanceof Error) return error.message;
  return "The request failed.";
}

export function PlaygroundConsole() {
  const { org } = useOrg();
  const keys = useQuery({
    queryKey: ["api-keys", org.id],
    queryFn: async () => (await listApiKeys(org.id)).data,
  });
  const activeKeys = (keys.data ?? []).filter((key) => key.status === "active");
  const [keyId, setKeyId] = useState<string>("");
  const selectedKey = activeKeys.find((key) => key.id === keyId) ?? activeKeys[0];

  const [model, setModel] = useState("anthropic/claude-sonnet-4.5");
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(1);
  const [maxTokens, setMaxTokens] = useState(512);
  const [system, setSystem] = useState("You are a precise infrastructure assistant.");
  const [prompt, setPrompt] = useState("Explain the difference between p95 and p99 latency to an on-call engineer.");
  const [simulateRateLimit, setSimulateRateLimit] = useState(false);
  const [output, setOutput] = useState("");
  const [result, setResult] = useState<CompletionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const draft = useMemo(
    () => ({
      model,
      temperature,
      topP,
      maxTokens,
      system,
      prompt,
      apiKey: selectedKey?.token ?? "voke_live_your_key",
    }),
    [model, temperature, topP, maxTokens, system, prompt, selectedKey?.token],
  );

  async function run() {
    if (!prompt.trim()) {
      setError("Write a user prompt before running.");
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setOutput("");
    setResult(null);
    setError(null);
    try {
      const completion = await runCompletion(draft, {
        signal: controller.signal,
        simulateRateLimit,
        onDelta: (chunk) => setOutput((current) => current + chunk),
      });
      setResult(completion);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(messageFrom(caught));
    } finally {
      setRunning(false);
    }
  }

  function stop() {
    abortRef.current?.abort();
    setRunning(false);
  }

  async function copySnippet(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Snippet copied");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Clipboard is not available");
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Playground</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Same payload the proxy accepts at <span className="font-mono">/v1/chat/completions</span>. The response is simulated locally until the live API is wired.
          </p>
        </div>
        <div className="flex gap-2">
          {running ? (
            <Button variant="outline" onClick={stop}>
              <Square className="size-3.5" />
              Stop
            </Button>
          ) : (
            <Button onClick={() => void run()}>Run</Button>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="panel relative space-y-4 overflow-hidden rounded-xl p-4">
          <ShineBorder />
          <Field label="Model">
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="API key">
            {keys.isPending ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select value={selectedKey?.id ?? ""} onValueChange={setKeyId}>
                <SelectTrigger>
                  <SelectValue placeholder="No active keys" />
                </SelectTrigger>
                <SelectContent>
                  {activeKeys.map((key) => (
                    <SelectItem key={key.id} value={key.id}>
                      {key.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <Range label="Temperature" value={temperature} min={0} max={2} step={0.1} onChange={setTemperature} />
          <Range label="top_p" value={topP} min={0} max={1} step={0.05} onChange={setTopP} />
          <Range label="Max tokens" value={maxTokens} min={64} max={4096} step={64} onChange={setMaxTokens} digits={0} />
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Simulate 429</span>
            <Switch checked={simulateRateLimit} onCheckedChange={setSimulateRateLimit} />
          </label>
        </div>

        <div className="space-y-3">
          <Field label="System">
            <Textarea value={system} onChange={(event) => setSystem(event.target.value)} className="min-h-16" />
          </Field>
          <Field label="User prompt">
            <PromptEditor value={prompt} onChange={setPrompt} />
          </Field>
          <div className="panel console-glow relative min-h-40 overflow-hidden rounded-xl p-4">
            <ShineBorder />
            <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>Response</span>
              {result ? (
                <span className="font-mono text-primary">
                  {formatMs(result.latencyMs)} · {formatInteger(result.promptTokens)} in · {formatInteger(result.completionTokens)} out
                </span>
              ) : null}
            </div>
            {error ? <p className="text-sm text-red-300">{error}</p> : null}
            {!error && output.length === 0 ? (
              <p className="text-sm text-muted-foreground">Run a prompt to stream a completion.</p>
            ) : (
              <pre className="whitespace-pre-wrap font-mono text-sm leading-6">{output}</pre>
            )}
          </div>
        </div>
      </div>

      <div className="panel console-glow relative mt-6 overflow-hidden rounded-xl">
        <ShineBorder />
        <Tabs defaultValue="curl">
          <div className="flex items-center justify-between gap-3 border-b border-border/40 px-3 py-2">
            <TabsList>
              {LANGUAGES.map((language) => (
                <TabsTrigger key={language.id} value={language.id}>
                  {language.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {LANGUAGES.map((language) => {
            const snippet = playgroundSnippet(language.id, draft);
            return (
              <TabsContent key={language.id} value={language.id} className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-3 top-3"
                  onClick={() => void copySnippet(snippet)}
                >
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  Copy
                </Button>
                <pre className="overflow-x-auto p-4 pr-24 font-mono text-xs leading-6 text-foreground/80">{snippet}</pre>
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Range({
  label,
  value,
  min,
  max,
  step,
  digits = 2,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  digits?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex justify-between text-xs text-muted-foreground">
        {label}
        <span className="font-mono text-foreground">{value.toFixed(digits)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full"
      />
    </label>
  );
}
