import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: 'standalone' bundles only what's needed to run the app
  // into .next/standalone/ — no node_modules required in the Docker runner image.
  // This dramatically reduces the final image size.
  output: "standalone",
  poweredByHeader: false,
  // Allow LiveKit egress agent to access dev server for recording
  allowedDevOrigins: ["webhook.pugly.in"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "dfdx9u0psdezh.cloudfront.net",
        pathname: "/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // 'same-origin' (not 'no-referrer') because the /api/server/* routes
          // rely on same-origin Referer/Origin as a CSRF-style check, while
          // still preventing referrer leakage to external sites.
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Permissions-Policy", value: "geolocation=(), payment=()" },
        ],
      },
      {
        // Meeting pages may be embedded by SDK consumers; everything else
        // must not be frameable.
        source: "/((?!meet/).*)",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
    ];
  },
};

export default nextConfig;
