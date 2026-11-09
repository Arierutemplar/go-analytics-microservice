"use client";

import { ChevronsLeft, ChevronsRight, KeyRound, LayoutDashboard, Menu, ScrollText, SquareTerminal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "@/components/shared/logo-mark";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { useOrg } from "@/components/shared/org-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/api-keys", label: "API keys", icon: KeyRound },
  { href: "/playground", label: "Playground", icon: SquareTerminal },
  { href: "/logs", label: "Logs", icon: ScrollText },
] as const;

export function DashboardShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (localStorage.getItem("voke-sidebar") === "collapsed") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      localStorage.setItem("voke-sidebar", next ? "collapsed" : "open");
      return next;
    });
  }

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const current = NAV.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  return (
    <div className="relative flex min-h-screen">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-16 z-[60] border-t border-border/40" />
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-primary/20 bg-card/95 backdrop-blur transition-transform md:static md:translate-x-0",
          collapsed ? "md:w-[68px]" : "md:w-60",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-2 px-3">
          <Link href="/" className="flex items-center px-1" aria-label="Voke">
            <Logo size="md" wordClassName={collapsed ? "md:hidden" : undefined} />
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-2">
          {NAV.map((item) => {
            const active = current?.href === item.href;
            const Icon = item.icon;
            const link = (
              <Link
                href={item.href}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground transition-colors duration-300 hover:bg-primary/10 hover:text-foreground",
                  active && "bg-primary/15 text-primary shadow-[inset_2px_0_0_0_currentColor]",
                  collapsed && "md:justify-center md:px-0",
                )}
              >
                <Icon className={cn("size-4 shrink-0", active && "text-primary")} />
                {active ? (
                  <span className={cn("size-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]", collapsed && "md:hidden")} />
                ) : null}
                <span className={cn(collapsed && "md:hidden")}>{item.label}</span>
              </Link>
            );
            if (!collapsed) return <div key={item.href}>{link}</div>;
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" className="hidden md:block">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>
        <div className="hidden border-t border-border/40 p-2 md:block">
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={toggleCollapsed}>
            {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
            <span className={cn(collapsed && "md:hidden")}>Collapse</span>
          </Button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-3 px-4 md:px-6">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <Menu className="size-4" />
            </Button>
            <div>
              <p className="text-sm font-medium">{current?.label ?? "Console"}</p>
              <p className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
                Flat plan
                <span className="text-border/80">·</span>
                <span className="inline-flex items-center gap-1.5 text-primary">
                  <span className="relative flex size-1.5">
                    <span className="live-dot absolute inline-flex size-full rounded-full bg-primary" />
                    <span className="relative size-1.5 rounded-full bg-primary" />
                  </span>
                  live traffic
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <OrgSwitcher />
            <span className="grid size-8 place-items-center rounded-full border border-border/40 text-xs font-medium">
              AR
            </span>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}

function OrgSwitcher() {
  const { org, organizations, setOrgId } = useOrg();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-48">
          <span className="truncate">{org.name}</span>
          <Badge className="ml-1 border-primary/50 bg-primary/15 text-primary uppercase">{org.plan}</Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {organizations.map((item) => (
          <DropdownMenuItem key={item.id} onSelect={() => setOrgId(item.id)}>
            <span className="flex-1">{item.name}</span>
            <span className="ml-3 font-mono text-[10px] uppercase text-muted-foreground">{item.plan}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
