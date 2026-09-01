import type { NextConfig } from "next";

/**
 * Chrome gates both WebMCP APIs behind the `tools` Permissions Policy, and
 * ships the feature to stable via a Chrome 149 origin trial. Declaring the
 * policy explicitly means the imperative and declarative APIs are available
 * on our own origin without relying on a default, and setting
 * `WEBMCP_ORIGIN_TRIAL_TOKEN` lets the deployed site work in stable Chrome
 * without asking a visitor to flip chrome://flags/#enable-webmcp-testing.
 *
 * Note: Next.js evaluates `headers()` at build time, so the token has to be
 * present in the build environment (e.g. a Vercel project env var), not only
 * at runtime.
 */
const originTrialToken = process.env.WEBMCP_ORIGIN_TRIAL_TOKEN;

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Permissions-Policy", value: "tools=(self)" },
          ...(originTrialToken
            ? [{ key: "Origin-Trial", value: originTrialToken }]
            : []),
        ],
      },
    ];
  },
  async rewrites() {
    return [
      // The partner demo is a plain static HTML page in public/ — served at a
      // clean URL so it reads as a real third-party site, not an app route.
      { source: "/partner", destination: "/partner/index.html" },
    ];
  },
};

export default nextConfig;
