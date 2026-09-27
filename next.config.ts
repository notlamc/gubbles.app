import type { NextConfig } from "next";

// Security headers that do not depend on a per-request nonce. The nonce-based
// Content-Security-Policy is set in src/proxy.ts.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    // Geolocation and camera are only ever requested by our own origin on an explicit user action.
    value: "geolocation=(self), camera=(self), microphone=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  // Lets the e2e suite run its own dev server alongside `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  reactStrictMode: true,
  // Native / wasm modules that must be loaded by Node at runtime, never bundled.
  serverExternalPackages: ["@node-rs/argon2", "sharp", "zxing-wasm", "@prisma/client", ".prisma/client"],
  async headers() {
    const headers = [...securityHeaders];
    if (process.env.NODE_ENV === "production") {
      headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" });
    }
    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
