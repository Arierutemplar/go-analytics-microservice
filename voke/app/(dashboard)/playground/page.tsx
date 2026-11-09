import type { Metadata } from "next";
import { PlaygroundConsole } from "@/components/dashboard/playground-console";

export const metadata: Metadata = { title: "Playground" };

export default function PlaygroundPage() {
  return <PlaygroundConsole />;
}
