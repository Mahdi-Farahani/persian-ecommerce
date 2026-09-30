# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------------------
# NestJS API image (multi-stage, pnpm workspace aware)
# Build from the repository root:
#   docker build -f apps/api/Dockerfile -t pe-api .
# ---------------------------------------------------------------------------
ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt \
    CI=true
# Optional extra CA certificates (corporate TLS-inspecting proxies). The
# directory is normally empty; drop *.crt files into infra/docker/certs.
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
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@pe/api..."

# ---- build ----------------------------------------------------------------
FROM deps AS build
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @pe/shared build \
  && cd apps/api \
  && pnpm prisma generate \
  && pnpm build

# ---- production dependencies ---------------------------------------------
FROM deps AS prod-deps
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter "@pe/api..."

# ---- runtime --------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production \
    API_PORT=4000
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY apps/api/package.json apps/api/prisma.config.ts ./apps/api/
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
  && mkdir -p /app/apps/api/uploads \
  && chown -R node:node /app
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4000/health/ready || exit 1
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
