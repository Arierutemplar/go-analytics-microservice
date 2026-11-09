import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { DevToggle } from "@/components/shared/dev-toggle";
import { Providers } from "@/components/shared/providers";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: { default: "Voke API", template: "%s · Voke" },
  description: "One endpoint for every model. A flat monthly rate.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
        <DevToggle />
      </body>
    </html>
  );
}
