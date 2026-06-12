import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray lockfile in the user home directory otherwise makes Next.js
  // infer the wrong workspace root.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
