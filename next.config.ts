import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: 'standalone' bundles only what's needed to run the app
  // into .next/standalone/ — no node_modules required in the Docker runner image.
  // This dramatically reduces the final image size.
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'dfdx9u0psdezh.cloudfront.net',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
