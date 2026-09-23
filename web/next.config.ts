import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // npm workspace: the lockfile and hoisted node_modules live one level up.
  devIndicators: false,
  turbopack: { root: path.join(import.meta.dirname, "..") },
};

export default nextConfig;
