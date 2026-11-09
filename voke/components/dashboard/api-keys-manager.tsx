"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Eye, EyeOff, MoreHorizontal, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useOrg } from "@/components/shared/org-provider";
import { Badge } from "@/components/ui/badge";
import { ShineBorder } from "@/components/ui/shine-border";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, createApiKey, listApiKeys, revokeApiKey, updateApiKeyLimits } from "@/lib/api";
import { formatDate, formatInteger, maskToken } from "@/lib/format";
import { parseAllowlist, parseOptionalCap, parsePositiveInt } from "@/lib/network";
import { cn } from "@/lib/utils";
import type { ApiKey, ApiKeyEnvironment, CreateApiKeyInput } from "@/types";

type DialogState =
  | { type: "create" }
  | { type: "created"; key: ApiKey }
  | { type: "limits"; key: ApiKey }
  | { type: "revoke"; key: ApiKey }
  | null;

interface KeyFormState {
  name: string;
  environment: ApiKeyEnvironment;
  rateLimitRpm: string;
  monthlyTokenCap: string;
  ipAllowlist: string;
}

const EMPTY_FORM: KeyFormState = {
  name: "",
  environment: "live",
  rateLimitRpm: "120",
  monthlyTokenCap: "",
  ipAllowlist: "",
};

function messageFrom(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Request failed.";
}

function parseForm(form: KeyFormState, requireName: boolean): { ok: true; value: CreateApiKeyInput } | { ok: false; message: string } {
  const rpm = parsePositiveInt(form.rateLimitRpm, "Requests per minute", 100_000);
  if (!rpm.ok) return rpm;
  const cap = parseOptionalCap(form.monthlyTokenCap);
  if (!cap.ok) return cap;
  const ips = parseAllowlist(form.ipAllowlist);
  if (!ips.ok) return ips;
  if (requireName && form.name.trim().length < 2) {
    return { ok: false, message: "Name must be between 2 and 48 characters." };
  }
  return {
    ok: true,
    value: {
      name: form.name,
      environment: form.environment,
      rateLimitRpm: rpm.value,
      monthlyTokenCap: cap.value,
      ipAllowlist: ips.value,
    },
  };
}

export function ApiKeysManager() {
  const { org } = useOrg();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [form, setForm] = useState<KeyFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const keys = useQuery({
    queryKey: ["api-keys", org.id],
    queryFn: async () => (await listApiKeys(org.id)).data,
  });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ["api-keys", org.id] });
  }

  const create = useMutation({
    mutationFn: (input: CreateApiKeyInput) => createApiKey(org.id, input),
    onSuccess: async (response) => {
      await invalidate();
      setDialog({ type: "created", key: response.data });
      setFormError(null);
    },
    onError: (error) => setFormError(messageFrom(error)),
  });

  const update = useMutation({
    mutationFn: (input: { id: string; body: CreateApiKeyInput }) =>
      updateApiKeyLimits(org.id, input.id, {
        rateLimitRpm: input.body.rateLimitRpm,
        monthlyTokenCap: input.body.monthlyTokenCap,
        ipAllowlist: input.body.ipAllowlist,
      }),
    onSuccess: async () => {
      await invalidate();
      setDialog(null);
      toast.success("Limits saved");
    },
    onError: (error) => setFormError(messageFrom(error)),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeApiKey(org.id, id),
    onSuccess: async () => {
      await invalidate();
      setDialog(null);
      toast.success("Key revoked");
    },
    onError: (error) => setFormError(messageFrom(error)),
  });

  async function copyToken(token: string, id: string) {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(id);
      toast.success("API key copied");
      window.setTimeout(() => setCopied((current) => (current === id ? null : current)), 1500);
    } catch {
      toast.error("Clipboard is not available in this browser");
    }
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialog({ type: "create" });
  }

  function openLimits(key: ApiKey) {
    setForm({
      name: key.name,
      environment: key.environment,
      rateLimitRpm: String(key.rateLimitRpm),
      monthlyTokenCap: key.monthlyTokenCap === null ? "" : String(key.monthlyTokenCap),
      ipAllowlist: key.ipAllowlist.join("\n"),
    });
    setFormError(null);
    setDialog({ type: "limits", key });
  }

  const rows = (keys.data ?? []).filter((key) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return key.name.toLowerCase().includes(needle) || key.prefix.toLowerCase().includes(needle);
  });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">API keys</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live keys call production models. Test keys are for CI. Limits and IP allowlists apply per key.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Create key
        </Button>
      </div>
      <div className="mt-5">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter by name or prefix"
          className="max-w-sm"
          aria-label="Filter keys"
        />
      </div>
      <div className="panel relative mt-4 overflow-hidden rounded-xl">
        <ShineBorder />
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Token</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Limits</th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">Last used</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {keys.isPending
              ? Array.from({ length: 4 }, (_, index) => (
                  <tr key={index} className="border-b border-border/40">
                    <td className="px-4 py-3" colSpan={5}>
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))
              : null}
            {keys.isError ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-sm text-muted-foreground">
                  {messageFrom(keys.error)}{" "}
                  <button type="button" className="underline" onClick={() => void keys.refetch()}>
                    Retry
                  </button>
                </td>
              </tr>
            ) : null}
            {!keys.isPending && !keys.isError && rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-sm text-muted-foreground">
                  No keys match this filter.
                </td>
              </tr>
            ) : null}
            {rows.map((key) => {
              const isRevealed = revealed[key.id] === true;
              return (
                <tr key={key.id} className="border-b border-border/40 transition-colors duration-300 last:border-0 hover:bg-primary/10">
                  <td className="px-4 py-3">
                    <div className="font-medium">{key.name}</div>
                    <div className="mt-1 flex gap-1.5">
                      <Badge className="uppercase">{key.environment}</Badge>
                      <Badge className={cn(key.status === "revoked" && "text-red-300")}>{key.status}</Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <code className="font-mono text-xs">{isRevealed ? key.token : maskToken(key.token)}</code>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={isRevealed ? "Hide token" : "Show token"}
                        onClick={() => setRevealed((current) => ({ ...current, [key.id]: !isRevealed }))}
                      >
                        {isRevealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Copy token" onClick={() => void copyToken(key.token, key.id)}>
                        {copied === key.id ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      </Button>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-xs text-muted-foreground md:table-cell">
                    {formatInteger(key.rateLimitRpm)} rpm
                    <div>{key.monthlyTokenCap === null ? "No token cap" : `${formatInteger(key.monthlyTokenCap)} tokens`}</div>
                    <div>{key.ipAllowlist.length === 0 ? "Any IP" : `${key.ipAllowlist.length} IPs`}</div>
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">
                    {key.lastUsedAt ? formatDate(key.lastUsedAt) : "Never"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Actions for ${key.name}`}>
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => void copyToken(key.token, key.id)}>Copy token</DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={key.status !== "active"}
                          onSelect={() => openLimits(key)}
                        >
                          Edit limits and IPs
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={key.status !== "active"}
                          className="text-red-300 focus:text-red-200"
                          onSelect={() => {
                            setFormError(null);
                            setDialog({ type: "revoke", key });
                          }}
                        >
                          Revoke
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={dialog !== null} onOpenChange={(open) => { if (!open) setDialog(null); }}>
        <DialogContent>
          {dialog?.type === "create" ? (
            <>
              <DialogHeader>
                <DialogTitle>Create an API key</DialogTitle>
                <DialogDescription>The full token is shown once in the next step. You can reveal it again from this console.</DialogDescription>
              </DialogHeader>
              <KeyFields form={form} setForm={setForm} includeName />
              {formError ? <p className="mt-3 text-sm text-red-300">{formError}</p> : null}
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
                <Button
                  disabled={create.isPending}
                  onClick={() => {
                    const parsed = parseForm(form, true);
                    if (!parsed.ok) {
                      setFormError(parsed.message);
                      return;
                    }
                    setFormError(null);
                    create.mutate(parsed.value);
                  }}
                >
                  {create.isPending ? "Creating…" : "Create key"}
                </Button>
              </div>
            </>
          ) : null}
          {dialog?.type === "created" ? (
            <>
              <DialogHeader>
                <DialogTitle>Key created</DialogTitle>
                <DialogDescription>Copy it into your secret manager. Requests start working immediately.</DialogDescription>
              </DialogHeader>
              <code className="block break-all rounded-md border border-border/40 bg-black/30 p-3 font-mono text-xs">
                {dialog.key.token}
              </code>
              <div className="mt-4 flex justify-end">
                <Button onClick={() => void copyToken(dialog.key.token, dialog.key.id)}>Copy token</Button>
              </div>
            </>
          ) : null}
          {dialog?.type === "limits" ? (
            <>
              <DialogHeader>
                <DialogTitle>Limits for {dialog.key.name}</DialogTitle>
                <DialogDescription>Empty allowlist means every IP. Empty token cap means no monthly ceiling.</DialogDescription>
              </DialogHeader>
              <KeyFields form={form} setForm={setForm} includeName={false} />
              {formError ? <p className="mt-3 text-sm text-red-300">{formError}</p> : null}
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
                <Button
                  disabled={update.isPending}
                  onClick={() => {
                    const parsed = parseForm(form, false);
                    if (!parsed.ok) {
                      setFormError(parsed.message);
                      return;
                    }
                    if (dialog.type !== "limits") return;
                    setFormError(null);
                    update.mutate({ id: dialog.key.id, body: parsed.value });
                  }}
                >
                  {update.isPending ? "Saving…" : "Save limits"}
                </Button>
              </div>
            </>
          ) : null}
          {dialog?.type === "revoke" ? (
            <>
              <DialogHeader>
                <DialogTitle>Revoke {dialog.key.name}?</DialogTitle>
                <DialogDescription>Calls using this token fail immediately. This does not delete historical logs.</DialogDescription>
              </DialogHeader>
              {formError ? <p className="text-sm text-red-300">{formError}</p> : null}
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setDialog(null)}>Keep key</Button>
                <Button variant="destructive" disabled={revoke.isPending} onClick={() => revoke.mutate(dialog.key.id)}>
                  {revoke.isPending ? "Revoking…" : "Revoke key"}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KeyFields({
  form,
  setForm,
  includeName,
}: {
  form: KeyFormState;
  setForm: (next: KeyFormState) => void;
  includeName: boolean;
}) {
  return (
    <div className="space-y-3">
      {includeName ? (
        <div className="space-y-1.5">
          <Label htmlFor="key-name">Name</Label>
          <Input
            id="key-name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="Production edge"
          />
        </div>
      ) : null}
      {includeName ? (
        <div className="space-y-1.5">
          <Label>Environment</Label>
          <div className="flex gap-2">
            {(["live", "test"] as const).map((environment) => (
              <Button
                key={environment}
                size="sm"
                variant={form.environment === environment ? "default" : "outline"}
                onClick={() => setForm({ ...form, environment })}
              >
                {environment}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="rpm">Requests / minute</Label>
          <Input
            id="rpm"
            inputMode="numeric"
            value={form.rateLimitRpm}
            onChange={(event) => setForm({ ...form, rateLimitRpm: event.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cap">Monthly token cap</Label>
          <Input
            id="cap"
            inputMode="numeric"
            placeholder="Unlimited"
            value={form.monthlyTokenCap}
            onChange={(event) => setForm({ ...form, monthlyTokenCap: event.target.value })}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ips">IP allowlist</Label>
        <Textarea
          id="ips"
          placeholder={"203.0.113.10\n203.0.113.0/24"}
          value={form.ipAllowlist}
          onChange={(event) => setForm({ ...form, ipAllowlist: event.target.value })}
        />
      </div>
    </div>
  );
}
