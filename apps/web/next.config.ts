import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Our shared package is plain TypeScript source, so Next needs to compile it too.
  transpilePackages: ["@repo/shared"],

  // The Stride web app lives in public/app (built by scripts/build-web-app.mjs). It's a
  // single-page app: any /app address that isn't a real file opens its index.html, and the
  // app shows the right screen itself.
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [{ source: "/app/:path*", destination: "/app/index.html" }],
    };
  },

  async headers() {
    return [
      {
        // The service worker must always be checked for updates, and may look after all of /app.
        source: "/app/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache" },
          { key: "Service-Worker-Allowed", value: "/app" },
          { key: "Content-Type", value: "text/javascript; charset=utf-8" },
        ],
      },
      {
        source: "/app/maplibre-gl-worker.mjs",
        headers: [{ key: "Content-Type", value: "text/javascript; charset=utf-8" }],
      },
      {
        source: "/app/manifest.webmanifest",
        headers: [{ key: "Content-Type", value: "application/manifest+json" }],
      },
      {
        // App code files have a fingerprint in their name and never change: cache them for a year.
        source: "/app/_expo/static/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
