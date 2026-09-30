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
