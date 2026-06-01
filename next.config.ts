import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
