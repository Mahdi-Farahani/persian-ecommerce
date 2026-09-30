import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Produces a self-contained server bundle for the Docker image.
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@pe/shared'],
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      // Product images served by the API/object storage through nginx.
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: '**' },
    ],
  },
  // Environment values consumed by the browser bundle are limited to NEXT_PUBLIC_*.
  env: {},
};

export default nextConfig;
