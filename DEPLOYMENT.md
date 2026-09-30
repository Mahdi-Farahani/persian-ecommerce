# Deployment

## Target

The initial production deployment should work on a single Linux server.

Minimum architecture:

```text
Internet
    ↓
Nginx
    ↓
Next.js
    ↓
NestJS
    ↓
MariaDB
```

---

# 1. Requirements

Server:

* Linux
* Docker
* Docker Compose
* sufficient CPU/RAM/SSD

---

# 2. Environment

Production secrets must be provided through environment variables.

Never commit:

```text
.env
.env.production
credentials
private keys
```

Commit:

```text
.env.example
```

---

# 3. Docker Compose

The application must support:

```bash
docker compose up -d
```

Required services:

```text
nginx
web
api
mariadb
```

Additional services may be introduced when required.

---

# 4. Health Checks

Every important service should expose health status.

Backend:

```text
GET /health
GET /health/ready
GET /api/v1          # identity, version and links (JSON)
```

Docker health checks should be used where practical.

---

# 5. Nginx

Example routing:

```text
https://example.com
        ↓
      Nginx
        ↓
      Next.js

https://example.com/api/*
        ↓
      Nginx
        ↓
      NestJS
```

---

# 6. TLS

Production must use HTTPS.

Nginx should redirect:

```text
HTTP → HTTPS
```

TLS certificates should not be committed to Git.

---

# 7. Database

Before deployment:

```text
backup
↓
migration
↓
application startup
↓
health check
```

Database migrations must be deterministic.

---

# 8. Deployment Procedure

Example:

```bash
git checkout development
git pull origin development

docker compose build
docker compose up -d

docker compose ps
docker compose logs
```

Then:

```text
health check
API smoke test
frontend smoke test
database verification
```

---

# 9. Rollback

Document a rollback process.

At minimum:

```text
previous application image
previous database migration strategy
database backup
```

Never assume database rollback is automatically safe.

---

# 10. Production Configuration

Production should use:

```text
NODE_ENV=production
```

Disable:

* verbose debug output
* development-only endpoints
* exposed stack traces

---

# 11. Logging

Logs must be accessible with:

```bash
docker compose logs
```

Prefer structured logs.

---

# 12. Backup

Production database backups are mandatory.

Document:

* backup frequency
* retention
* restore procedure

---

# 13. Future Scaling

The architecture should allow future migration to:

```text
Load Balancer
    ↓
Multiple Next.js instances
    ↓
Multiple NestJS instances
    ↓
Redis
    ↓
MariaDB cluster / managed DB
```

But do not implement this complexity during the initial single-server deployment unless required.

---

# 14. Compose Stack (as built)

`docker-compose.yml` defines four services on two internal networks:

| Service   | Image                     | Notes                                                        |
| --------- | ------------------------- | ------------------------------------------------------------ |
| `mariadb` | `mariadb:11`              | `backend` network only, named volume `mariadb-data`, healthcheck |
| `api`     | built from `apps/api`     | runs migrations (+ optional seed) on start, healthcheck `/health/ready` |
| `web`     | built from `apps/web`     | Next.js standalone server, healthcheck `/healthz`            |
| `nginx`   | `nginx:1.29-alpine`       | the only service publishing ports (`NGINX_HTTP_PORT`, `NGINX_HTTPS_PORT`) |

Required `.env` keys: `MARIADB_ROOT_PASSWORD`, `MARIADB_PASSWORD`, `APP_URL`,
`CORS_ORIGINS`, `SEED_ADMIN_PASSWORD` (first start). See `.env.example`.

Runtime switches on the API container:

* `RUN_MIGRATIONS_ON_START` (default `true`) — apply pending migrations.
* `SEED_ON_START` (default `true`) — idempotent seed of roles/permissions/admin.
* `SWAGGER_ENABLED` (default `false` in production).

Payments (see `docs/payments/README.md`):

* `PAYMENT_ENCRYPTION_KEY` (required, ≥32 chars) encrypts gateway credentials
  at rest. Generate with
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
  Rotating it requires re-entering credentials in the admin panel.
* `API_PUBLIC_URL` — absolute API base gateways call back to (defaults to
  `APP_URL/api/v1`). Register `<API_PUBLIC_URL>/payments/<provider>/callback`
  with each provider.
* `ORDER_PAYMENT_TIMEOUT_MINUTES` (default 30).
* `PAYMENT_MOCK_ENABLED` / `PAYMENT_MOCK_DEFAULT` — development only; the mock
  gateway is refused whenever the API runs with `NODE_ENV=production`. A local
  Compose stack that should exercise checkout end-to-end sets
  `API_NODE_ENV=development` in `.env`; a real deployment keeps the default
  (`production`).
* Optional bootstrap of a provider on first boot, e.g. `ZARINPAL_ENABLED`,
  `ZARINPAL_ENVIRONMENT`, `ZARINPAL_MERCHANT_ID`. Afterwards configure
  gateways at `/admin/settings/payment-gateways`.

## Deployment procedure (as built)

First deployment on a fresh Linux host (Docker Engine ≥ 24 with Compose v2):

```bash
git clone <repository> /srv/persian-ecommerce && cd /srv/persian-ecommerce
git checkout development
cp .env.example .env
# edit .env: MARIADB_ROOT_PASSWORD, MARIADB_PASSWORD, JWT_ACCESS_SECRET,
# PAYMENT_ENCRYPTION_KEY, SEED_ADMIN_PASSWORD, APP_URL=https://shop.example.com,
# CORS_ORIGINS=https://shop.example.com, COOKIE_SECURE=true,
# NGINX_HTTP_PORT=80, NGINX_HTTPS_PORT=443
cp infra/nginx/conf.d/tls.conf.example infra/nginx/conf.d/default.conf   # set server_name
# place fullchain.pem / privkey.pem in infra/nginx/certs/
docker compose build
docker compose up -d
docker compose ps                      # every service "healthy"
```

Every later release:

```bash
cd /srv/persian-ecommerce
infra/scripts/backup-db.sh /srv/backups   # always before a migration
git pull origin development
docker compose build
docker compose up -d                       # api applies migrations, then web/nginx roll
docker compose ps
docker compose logs --since 5m api
```

Post-deployment smoke (replace the origin):

```bash
curl -fsS https://shop.example.com/health/ready     # {"status":"ok",...,"database":{"status":"up"}}
curl -fsS https://shop.example.com/api/v1           # API identity and version
curl -fsS -o /dev/null -w '%{http_code}\n' https://shop.example.com/            # 200
curl -fsS -o /dev/null -w '%{http_code}\n' https://shop.example.com/products    # 200
curl -fsS 'https://shop.example.com/api/v1/products?limit=1' | head -c 200      # catalogue JSON
docker compose exec api npx prisma migrate status   # "Database schema is up to date"
```

Then log in to `/admin` and check the dashboard loads. Rotate the bootstrap
admin password on first login.

## Rollback (as built)

Images are tagged with `IMAGE_TAG` (default `latest`); build releases with an
explicit tag so the previous one stays available:

```bash
IMAGE_TAG=2026.09.30 docker compose build
IMAGE_TAG=2026.09.30 docker compose up -d
```

To roll back the application, redeploy the previous tag with migrations
disabled so the older code never runs against a schema it does not know
about:

```bash
RUN_MIGRATIONS_ON_START=false IMAGE_TAG=2026.09.29 docker compose up -d api web
```

Migrations are additive whenever possible (new nullable columns, new
tables), so the previous release usually keeps working on the newer schema.
When a migration is destructive the release notes must say so; in that case
rollback means restoring the pre-deployment dump with
`infra/scripts/restore-db.sh` (which stops `api`/`web`, restores, and starts
them again) and then starting the previous images. Never assume a schema can
be rolled back without a backup.

## Logging (as built)

All services log to stdout/stderr through Docker's `json-file` driver with
rotation (`10m` × 5 files per container, set once in `docker-compose.yml`).
Read them with `docker compose logs -f [service]`. The API uses the Nest
logger with `LOG_LEVEL` (`error`, `warn`, `log`, `debug`, `verbose`); each
request carries the nginx `X-Request-Id`, which is echoed in error envelopes
so a user report can be matched to the log line. Nginx access logs include the
upstream time; `/health*` and `/uploads/` are not access-logged. Ship the
json files with a collector (Promtail, Filebeat, Vector) when centralised
logs are needed; nothing in the stack writes log files to disk.

## Production checklist (as built)

Before exposing a deployment:

- [ ] `NODE_ENV` of the API container is `production` (do not set
      `API_NODE_ENV` in `.env`), `SWAGGER_ENABLED=false`,
      `PAYMENT_MOCK_ENABLED=false`, `LOG_LEVEL=log` or `warn`.
- [ ] TLS configured (`tls.conf.example`), HTTP redirects to HTTPS, HSTS
      on, `COOKIE_SECURE=true`, `APP_URL`/`API_PUBLIC_URL`/`CORS_ORIGINS` set
      to the public HTTPS origin.
- [ ] Secrets only in `.env` on the host (mode `600`) or a secrets manager;
      `git status` shows no `.env`.
- [ ] Only nginx publishes ports (`docker compose config | grep -A2 ports`);
      MariaDB and the API are reachable solely on the internal networks.
- [ ] `/admin` restricted at the network level (IP allow-list or VPN in the
      nginx server block) in addition to RBAC.
- [ ] Bootstrap admin password rotated, named admin accounts created.
- [ ] Payment gateways configured with production credentials at
      `/admin/settings/payment-gateways`; callback URLs registered with the
      providers; the `contractDocsConfirmed` setting left unset until the
      BNPL adapters are verified against contract documents.
- [ ] Backup cron installed and one restore rehearsed.
- [ ] Smoke checks above green, `pnpm audit --prod` clean at build time.

## TLS

Copy `infra/nginx/conf.d/tls.conf.example` over `default.conf`, place
`fullchain.pem`/`privkey.pem` in `infra/nginx/certs/` (git-ignored) and
`docker compose restart nginx`. HTTP requests are redirected to HTTPS and HSTS
is enabled.

## Builds behind a TLS-inspecting proxy

Drop the proxy CA (`*.crt`) into `infra/docker/certs/` before
`docker compose build`; the Dockerfiles trust it for package downloads. The
directory is git-ignored.

## Backup and restore (as built)

* **Backup**: `infra/scripts/backup-db.sh [dir]` runs `mariadb-dump
  --single-transaction` inside the `mariadb` container and writes a gzipped
  SQL file named `<database>-<UTC timestamp>.sql.gz` (default `./backups`).
  Schedule it from cron on the host, e.g. daily at 03:00:
  `0 3 * * * cd /srv/persian-ecommerce && infra/scripts/backup-db.sh /srv/backups >> /var/log/pe-backup.log 2>&1`.
* **Retention**: the script keeps the newest 30 files locally; copy the
  directory to off-site object storage (e.g. `rclone sync`) for longer
  retention. Recommended: 30 daily, 12 monthly, and a copy before every
  deployment (`git pull && infra/scripts/backup-db.sh`).
* **Uploads**: product images live in the `api-uploads` volume; back it up
  with `docker run --rm -v persian-ecommerce_api-uploads:/data -v $PWD/backups:/out alpine tar czf /out/uploads-$(date -u +%Y%m%dT%H%M%SZ).tgz -C /data .`.
* **Restore**: `infra/scripts/restore-db.sh <file.sql.gz>` stops `api` and
  `web`, streams the dump into MariaDB and starts them again. Migrations are
  idempotent, so a restored database from an older release is upgraded on the
  next API start (`RUN_MIGRATIONS_ON_START=true`).
* **Disaster recovery**: provision a host with Docker, clone the repository at
  the deployed tag, restore `.env` from the secrets store (never from git),
  `docker compose up -d mariadb`, restore the latest dump and the uploads
  archive, then `docker compose up -d`. Verify `/health/ready`, `/`, a
  product page and an admin login. Rotate `JWT_ACCESS_SECRET` if the old
  host may be compromised; gateway credentials stay valid because they are
  encrypted with `PAYMENT_ENCRYPTION_KEY`, which must be restored verbatim.
* **Test restores** quarterly on a staging host; a backup that has never been
  restored is not a backup.
