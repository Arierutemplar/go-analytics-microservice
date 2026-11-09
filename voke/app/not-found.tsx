import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">That route is not on Voke.</h1>
      <Link href="/" className="mt-6 text-sm text-foreground underline underline-offset-4">
        Back to the homepage
      </Link>
    </main>
  );
}
