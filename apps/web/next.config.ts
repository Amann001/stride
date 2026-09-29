import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Our shared package is plain TypeScript source, so Next needs to compile it too.
  transpilePackages: ["@repo/shared"],
};

export default nextConfig;
