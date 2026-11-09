import type { Metadata } from "next";
import { ApiKeysManager } from "@/components/dashboard/api-keys-manager";

export const metadata: Metadata = { title: "API keys" };

export default function ApiKeysPage() {
  return <ApiKeysManager />;
}
