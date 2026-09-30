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
