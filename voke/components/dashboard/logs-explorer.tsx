"use client";

import { useQuery } from "@tanstack/react-query";
import { flexRender, type SortingState } from "@tanstack/react-table";
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useLegacyTable,
  type LegacyColumnDef,
} from "@tanstack/react-table/legacy";
import { useEffect, useMemo, useRef, useState } from "react";
import { useOrg } from "@/components/shared/org-provider";
import { Badge } from "@/components/ui/badge";
import { ShineBorder } from "@/components/ui/shine-border";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, fetchLogs } from "@/lib/api";
import { formatDateTime, formatInteger, formatMs } from "@/lib/format";
import { MODELS } from "@/lib/models";
import { cn } from "@/lib/utils";
import type { HttpStatus, RequestLog } from "@/types";

type StatusFilter = "all" | `${HttpStatus}`;
type LatencyFilter = "all" | "fast" | "typical" | "slow";

const STATUSES: StatusFilter[] = ["all", "200", "400", "401", "429", "500"];

function messageFrom(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Could not load logs.";
}

function matchesLatency(ms: number, filter: LatencyFilter): boolean {
  if (filter === "fast") return ms < 250;
  if (filter === "typical") return ms >= 250 && ms <= 1000;
  if (filter === "slow") return ms > 1000;
  return true;
}

export function LogsExplorer() {
  const { org } = useOrg();
  const logs = useQuery({
    queryKey: ["logs", org.id],
    queryFn: async () => (await fetchLogs(org.id)).data,
  });
  const [status, setStatus] = useState<StatusFilter>("all");
  const [model, setModel] = useState("all");
  const [latency, setLatency] = useState<LatencyFilter>("all");
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "timestamp", desc: true }]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (logs.data ?? []).filter((row) => {
      if (status !== "all" && String(row.status) !== status) return false;
      if (model !== "all" && row.model !== model) return false;
      if (!matchesLatency(row.latencyMs, latency)) return false;
      if (!needle) return true;
      const prompt = row.request.messages.map((message) => message.content).join(" ").toLowerCase();
      return row.id.toLowerCase().includes(needle) || row.apiKeyPrefix.toLowerCase().includes(needle) || prompt.includes(needle);
    });
  }, [logs.data, status, model, latency, search]);

  const columns = useMemo<LegacyColumnDef<RequestLog>[]>(
    () => [
      {
        id: "timestamp",
        accessorFn: (row) => row.timestamp,
        header: "Time",
        cell: ({ getValue }) => <span className="font-mono text-xs">{formatDateTime(String(getValue()))}</span>,
      },
      {
        id: "status",
        accessorFn: (row) => row.status,
        header: "Status",
        cell: ({ getValue }) => <StatusCode code={Number(getValue())} />,
      },
      {
        id: "model",
        accessorFn: (row) => row.model,
        header: "Model",
        cell: ({ getValue }) => <span className="font-mono text-xs">{String(getValue())}</span>,
      },
      {
        id: "latencyMs",
        accessorFn: (row) => row.latencyMs,
        header: "Latency",
        cell: ({ getValue }) => <span className="font-mono text-xs text-primary">{formatMs(Number(getValue()))}</span>,
      },
      {
        id: "tokens",
        accessorFn: (row) => row.promptTokens + row.completionTokens,
        header: "Tokens",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {formatInteger(row.original.promptTokens)} / {formatInteger(row.original.completionTokens)}
          </span>
        ),
      },
      {
        id: "apiKeyPrefix",
        accessorFn: (row) => row.apiKeyPrefix,
        header: "Key",
        cell: ({ getValue }) => <span className="font-mono text-xs">{String(getValue())}</span>,
      },
    ],
    [],
  );

  const table = useLegacyTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageIndex: 0, pageSize: 12 } },
    getRowId: (row) => row.id,
  });

  const tableRef = useRef(table);
  tableRef.current = table;
  useEffect(() => {
    tableRef.current.setPageIndex(0);
  }, [status, model, latency, search]);

  const selected = filtered.find((row) => row.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-6xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Request logs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Filter by status, model, and latency. Select a row to inspect the payload.
        </p>
      </div>
      <div className="mt-5 grid gap-2 md:grid-cols-4">
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search id, key, prompt" aria-label="Search logs" />
        <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
          <SelectTrigger aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((item) => (
              <SelectItem key={item} value={item}>
                {item === "all" ? "All statuses" : item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={model} onValueChange={setModel}>
          <SelectTrigger aria-label="Model">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All models</SelectItem>
            {MODELS.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={latency} onValueChange={(value) => setLatency(value as LatencyFilter)}>
          <SelectTrigger aria-label="Latency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any latency</SelectItem>
            <SelectItem value="fast">Fast, under 250 ms</SelectItem>
            <SelectItem value="typical">250 ms – 1 s</SelectItem>
            <SelectItem value="slow">Slow, over 1 s</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="panel relative overflow-hidden rounded-xl">
          <ShineBorder />
          {logs.isPending ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} className="h-8 w-full" />
              ))}
            </div>
          ) : null}
          {logs.isError ? (
            <p className="p-4 text-sm text-muted-foreground">
              {messageFrom(logs.error)}{" "}
              <button type="button" className="underline" onClick={() => void logs.refetch()}>
                Retry
              </button>
            </p>
          ) : null}
          {!logs.isPending && !logs.isError ? (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border/40 text-xs text-muted-foreground">
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id}>
                    {group.headers.map((header) => (
                      <th key={header.id} className="px-3 py-2 font-medium">
                        {header.isPlaceholder ? null : (
                          <button type="button" className="inline-flex items-center gap-1" onClick={header.column.getToggleSortingHandler()}>
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            <SortMark sorted={header.column.getIsSorted()} />
                          </button>
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="px-3 py-8 text-sm text-muted-foreground">
                      No requests match these filters.
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      tabIndex={0}
                      onClick={() => setSelectedId(row.original.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedId(row.original.id);
                        }
                      }}
                      className={cn(
                        "cursor-pointer border-b border-border/40 transition-colors duration-300 last:border-0 hover:bg-primary/10 hover:shadow-[inset_3px_0_0_0_rgba(191,123,255,0.7)]",
                        selectedId === row.original.id && "bg-primary/10",
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-3 py-2">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : null}
          <div className="flex items-center justify-between border-t border-border/40 px-3 py-2 text-xs text-muted-foreground">
            <span>
              {filtered.length} requests · page {table.getState().pagination.pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
                Previous
              </Button>
              <Button size="sm" variant="outline" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
                Next
              </Button>
            </div>
          </div>
        </div>
        <aside className="panel relative overflow-hidden rounded-xl p-4">
          <ShineBorder />
          {selected ? <Inspector log={selected} /> : <p className="text-sm text-muted-foreground">Select a request to inspect its payload.</p>}
        </aside>
      </div>
    </div>
  );
}

function SortMark({ sorted }: { sorted: false | "asc" | "desc" }) {
  if (sorted === "asc") return <span aria-hidden>↑</span>;
  if (sorted === "desc") return <span aria-hidden>↓</span>;
  return null;
}

function StatusCode({ code }: { code: number }) {
  return (
    <Badge
      className={cn(
        "font-mono",
        code === 200 && "text-emerald-300",
        code === 429 && "text-primary",
        code >= 500 && "text-red-300",
      )}
    >
      {code}
    </Badge>
  );
}

function Inspector({ log }: { log: RequestLog }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <StatusCode code={log.status} />
          <span className="font-mono text-xs text-muted-foreground">{formatMs(log.latencyMs)}</span>
        </div>
        <p className="mt-2 font-mono text-xs">{log.id}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {log.method} {log.path} · {log.ip}
        </p>
      </div>
      <Payload title="Request" value={log.request} />
      <Payload title="Response" value={log.response} />
    </div>
  );
}

function Payload({ title, value }: { title: string; value: unknown }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{title}</p>
      <pre className="mt-1 max-h-64 overflow-auto rounded-md border border-border/40 bg-black/30 p-2 font-mono text-[11px] leading-5">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
