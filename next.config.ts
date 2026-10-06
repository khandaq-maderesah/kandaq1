import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  outputFileTracingRoot: __dirname,
  // Hide the floating "N" (Next.js DevTools) button in the bottom-left corner
  devIndicators: false,
  // firebase-admin (especially firebase-admin/auth) does not bundle cleanly into
  // serverless functions on Vercel, so keep it external and loaded at runtime.
  serverExternalPackages: ['firebase-admin'],
};

export default nextConfig;
