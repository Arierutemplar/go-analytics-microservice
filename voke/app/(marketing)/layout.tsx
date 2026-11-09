import Link from "next/link";
import { BackgroundGrid } from "@/components/ui/background-grid";
import { HeaderLamp } from "@/components/ui/header-lamp";
import { Logo } from "@/components/shared/logo-mark";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate min-h-screen">
      <BackgroundGrid className="fixed inset-0 -z-10" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-b from-transparent via-transparent to-background"
      />
      <div className="relative z-10">
      <header className="sticky top-0 z-30 bg-background/70 backdrop-blur">
        <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center" aria-label="Voke">
            <Logo />
          </Link>
          <div className="absolute inset-y-0 left-1/2 hidden -translate-x-1/2 sm:block">
            <nav className="flex h-full items-center gap-7">
              <a href="#models" className="text-base font-medium text-foreground transition-colors duration-300 hover:text-primary">
                Models
              </a>
              <a href="#pricing" className="text-base font-medium text-foreground transition-colors duration-300 hover:text-primary">
                Pricing
              </a>
              <Link href="/overview" className="text-base font-medium text-foreground transition-colors duration-300 hover:text-primary">
                Console
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/overview"
              className="neon-cta inline-flex h-8 items-center px-3 text-xs font-medium hover:scale-[1.02]"
            >
              Open dashboard
            </Link>
          </div>
        </div>
        <HeaderLamp />
      </header>
      <main>{children}</main>
      <footer className="border-t border-primary/20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 text-xs text-muted-foreground">
          <span>Voke API</span>
          <span>OpenAI-compatible. One monthly price.</span>
        </div>
      </footer>
      </div>
    </div>
  );
}
