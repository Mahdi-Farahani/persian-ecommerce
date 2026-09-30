# Phase 01 — Foundation

## Objective

Create the complete technical foundation of the project.

---

## Tasks

### Repository

Create:

```text
apps/web
apps/api
packages
infra
phases
```

---

### Frontend

Initialize:

* Next.js latest stable
* TypeScript
* Tailwind CSS
* RTL support
* basic layout
* header
* footer
* responsive shell

---

### Backend

Initialize:

* NestJS latest stable
* TypeScript
* Prisma
* MariaDB connection
* Swagger
* validation
* configuration module
* health endpoints

---

### Database

Create initial Prisma configuration.

Create:

```text
migration system
seed system
```

---

### Docker

Create Dockerfiles for:

```text
web
api
```

Create:

```text
docker-compose.yml
```

with:

```text
web
api
mariadb
nginx
```

---

### Nginx

Configure:

```text
/
→ web

/api
→ api
```

---

### Quality

Implement:

* ESLint
* formatting
* TypeScript strict mode
* test framework
* environment configuration

---

## Verification

Run:

```text
lint
typecheck
tests
build
docker build
docker compose up
health checks
```

---

## Deliverables

At completion:

```text
Next.js application works
NestJS application works
MariaDB works
Nginx works
Docker Compose works
Swagger works
health endpoints work
```

Commit:

```text
feat: initialize ecommerce platform foundation
```

Push:

```text
origin/development
```
