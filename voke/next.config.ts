import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["monaco-editor"],
  agentRules: false,
};

export default nextConfig;
