# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------------------
# Next.js web image (standalone output, pnpm workspace aware)
# Build from the repository root:
#   docker build -f apps/web/Dockerfile -t pe-web .
# ---------------------------------------------------------------------------
ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt \
    NEXT_TELEMETRY_DISABLED=1 \
    CI=true
COPY infra/docker/certs/ /usr/local/share/ca-certificates/extra/
RUN set -eu; \
  for cert in /usr/local/share/ca-certificates/extra/*.crt; do \
    [ -f "$cert" ] && cat "$cert" >> /etc/ssl/certs/ca-certificates.crt; \
  done; \
  corepack enable \
  && corepack prepare pnpm@10.33.0 --activate

# ---- dependencies ---------------------------------------------------------
FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@pe/web..."

# ---- build ----------------------------------------------------------------
FROM deps AS build
# Browser-facing API base URL is inlined at build time. It defaults to the
# same-origin path served by nginx so one image works for every hostname.
ARG NEXT_PUBLIC_API_URL=/api/v1
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @pe/shared build \
  && pnpm --filter @pe/web build

# ---- runtime --------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "apps/web/server.js"]
