import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  const base = env.appUrl.replace(/\/+$/, '');
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/account',
          '/seller',
          '/checkout',
          '/cart',
          '/payment',
          '/login',
          '/register',
          '/forgot-password',
          '/reset-password',
          '/api/',
          '/search?',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
