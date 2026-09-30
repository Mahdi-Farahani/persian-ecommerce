import type { NextConfig } from 'next';

/** Origin of the API as seen from the Next.js server (rewrites are resolved at build time). */
function apiOrigin(): string {
  const url = process.env.API_INTERNAL_URL ?? 'http://localhost:4000/api/v1';
  return new URL(url).origin;
}

const nextConfig: NextConfig = {
  // Produces a self-contained server bundle for the Docker image.
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@pe/shared'],
  images: {
    formats: ['image/avif', 'image/webp'],
    // Uploaded images are referenced by same-origin relative paths (see rewrites).
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  async rewrites() {
    return [
      // Stored uploads live on the API; expose them on the web origin so the
      // image optimizer (and the browser in development) can load them.
      { source: '/uploads/:path*', destination: `${apiOrigin()}/uploads/:path*` },
    ];
  },
  // Environment values consumed by the browser bundle are limited to NEXT_PUBLIC_*.
  env: {},
};

export default nextConfig;
