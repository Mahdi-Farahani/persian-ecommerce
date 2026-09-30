# Performance notes

Measured on 2026-09-30 against the Docker Compose stack through nginx on a
single developer container (shared CPU, MariaDB 11.8 in Docker, seeded
catalogue of 14 products). Numbers are indicative, not a benchmark.

## Latency smoke (30 requests, 5 concurrent, warm)

| Target | p50 | p95 | Notes |
| --- | --- | --- | --- |
| `/` (home, SSR) | 110 ms | 180 ms | server-rendered with categories, discounted and latest products |
| `/products` (listing, SSR) | 151 ms | 190 ms | |
| `/products/samsung-galaxy-s25` (detail, SSR) | 148 ms | 197 ms | includes review summary and related products |
| `/search?q=سامسونگ` (SSR) | 102 ms | 180 ms | fulltext search |
| `GET /api/v1/products?limit=24` | 54 ms | 78 ms | Prisma count + page, product card include |
| `GET /api/v1/products/:slug` | 52 ms | 73 ms | |
| `GET /api/v1/search?q=…` | < 20 ms (cached) | | FULLTEXT candidates + Prisma hydration |
| `GET /api/v1/categories` | < 10 ms | | |

Requests in the run that exceeded the per-IP nginx rate limit were answered
with `429` in a few milliseconds; the limit was raised afterwards to
30 requests/s with a burst of 60 for `/api/` (authentication endpoints keep
5 requests/s, burst 10). Behind a CDN or load balancer, switch the zone key to
the forwarded client address, otherwise all users share one bucket.

## What keeps it fast

* **Database**: every hot query is index-backed (verified with `EXPLAIN`):
  category listing `(categoryId, status, minPrice)`, brand listing
  `(brandId, status)`, search FULLTEXT on `products.searchText`, orders
  `(userId, createdAt)`, `(status, createdAt)`, `(paidAt)`, payments
  `(provider, providerAuthority)`, reviews `(productId, status, createdAt)`,
  audit `(action, createdAt)`, wishlist `(userId, createdAt)`. Listing
  queries use `include` batches rather than N+1 loops; Prisma issues one
  query per relation.
* **Search**: candidate ids come from one FULLTEXT query (capped at 2000),
  relevance sorting happens on ids only, then a single hydration query for
  the page.
* **Caching**: anonymous catalogue and search responses carry
  `Cache-Control: public, max-age=60, stale-while-revalidate=300` so
  browsers and CDNs can reuse them; cookie/bearer requests are never cached.
  Uploads and Next.js static assets are served with immutable cache headers
  by nginx; gzip is enabled for text responses.
* **Frontend**: Server Components render listings and detail pages; client
  bundles are limited to interactive islands (cart, checkout, autocomplete,
  wishlist, forms). Images go through the Next.js optimizer (AVIF/WebP),
  uploads are pre-encoded to WebP ≤ 1600 px, the Vazirmatn font is
  self-hosted and preloaded, and the storefront ships no third-party
  scripts.
* **SEO**: every public page sets a canonical URL and Open Graph metadata,
  product pages emit `Product`/`Offer` JSON-LD with ratings, `/sitemap.xml`
  is generated per request from the live catalogue and `/robots.txt`
  excludes private areas.

## Known bottlenecks and next steps

* Product pages are fully dynamic because the review summary and wishlist
  state depend on the visitor; a cached variant of the anonymous page (ISR
  with per-user islands) would cut SSR cost under load.
* The relevance sort loads all matching ids into memory (bounded at 2000);
  very large catalogues should move relevance ranking into the database or
  a dedicated search engine.
* The dashboard runs ~20 aggregate queries per load; acceptable for admin
  traffic, but worth caching for a minute if many administrators use it.
* No Redis yet: sessions, throttling counters and rate limits are per
  process/nginx instance. Horizontal scaling of the API needs a shared
  throttler store.
* Image optimisation runs inside the web container; put a CDN in front of
  `/_next/image` and `/uploads` for production traffic.
