# Phase 14 — Production Deployment

## Objective

Make the application deployable to a real Linux server using Docker Compose and Nginx.

---

# Production Stack

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

# Tasks

Implement and verify:

* production Dockerfiles
* Docker Compose
* Nginx
* environment configuration
* database migrations
* health checks
* logging
* backup documentation
* TLS configuration
* deployment documentation

---

# Deployment

Document:

```bash
git pull
docker compose build
docker compose up -d
```

---

# Health

Verify:

```text
/
 /api/v1
 /health
 /health/ready
```

---

# Production Security

Verify:

* HTTPS
* secure headers
* no debug mode
* no secrets in Git
* no exposed database
* no unnecessary ports
* restricted admin access where appropriate

---

# Backup

Document:

* database backup
* restore
* retention
* disaster recovery

---

# Final Validation

Run the complete test suite.

Build all Docker images.

Start production-like Docker environment.

Run E2E smoke tests.

---

# Completion

Update:

```text
README.md
DEPLOYMENT.md
SECURITY.md
```

Commit:

```text
chore: prepare ecommerce platform for production
```

Push:

```text
origin/development
```

Provide final engineering report.
