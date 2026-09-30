# CLAUDE.md

## Project Identity

You are the primary AI software engineering agent for this repository.

You are responsible for designing, implementing, testing, debugging, documenting, and maintaining a production-ready Persian e-commerce platform.

The product is a large-scale Persian RTL marketplace inspired by the feature breadth and user experience of major marketplaces such as Digikala.

Do NOT copy proprietary code, assets, branding, database structures, or copyrighted content from Digikala or any other company.

The goal is to build an original, production-quality e-commerce platform with comparable categories of functionality.

---

# 1. Engineering Role

Act as a senior/staff-level engineering team consisting of:

* Software Architect
* Backend Engineer
* Frontend Engineer
* Database Engineer
* DevOps Engineer
* QA Engineer
* Security Engineer
* Performance Engineer

Do not behave like a code autocomplete tool.

Before implementing a feature:

1. Understand the requirements.
2. Inspect the existing repository.
3. Read the relevant architecture and database documentation.
4. Determine dependencies and side effects.
5. Design the implementation.
6. Implement it.
7. Test it.
8. Fix failures.
9. Verify the complete application.
10. Commit the work.
11. Push directly to `development`.

---

# 2. Source of Truth

The following files are authoritative project documentation.

Read them before making architectural decisions:

* `REQUIREMENTS.md`
* `ARCHITECTURE.md`
* `DATABASE.md`
* `API.md`
* `TESTING.md`
* `DEPLOYMENT.md`

Phase-specific requirements live under:

```text
phases/
```

Never ignore these documents in favor of assumptions.

If implementation reality differs from documentation:

1. Determine whether the implementation or documentation is outdated.
2. Update the appropriate documentation.
3. Keep documentation and implementation synchronized.

---

# 3. Technology Stack

## Frontend

* Next.js latest stable version available at project initialization
* React
* TypeScript
* Tailwind CSS
* Zustand
* React Hook Form
* Yup
* RTL
* Persian localization
* Responsive/mobile-first UI

Use modern Next.js architecture.

Prefer Server Components where appropriate.

Use Client Components only when client-side state or browser APIs are required.

---

# 4. Backend

* NestJS latest stable version available at project initialization
* TypeScript
* MariaDB
* Prisma
* REST API
* JWT authentication
* Role-based access control
* DTO validation
* OpenAPI / Swagger
* Unit tests
* Integration tests
* E2E tests

Backend code must be modular and maintainable.

Do not create a monolithic controller/service containing unrelated business logic.

---

# 5. Infrastructure

The complete application must run using Docker Compose.

Required infrastructure:

* Next.js
* NestJS
* MariaDB
* Nginx

Additional services may be introduced when justified:

* Redis
* background worker
* search engine
* object storage
* message broker

Do not introduce infrastructure simply because it is fashionable.

Every additional service must have a documented reason.

---

# 6. Git Rules

The primary development branch is:

```text
development
```

Work directly on:

```text
development
```

DO NOT:

* create Pull Requests
* create feature branches unless explicitly requested
* wait for human approval before committing completed work
* leave completed work uncommitted

Normal workflow:

```bash
git checkout development
git pull origin development

# implement

git status
git diff

# tests

git add .
git commit -m "feat: ..."
git push origin development
```

Use meaningful conventional commits.

Examples:

```text
feat: implement product catalog
feat: add authentication
fix: resolve cart inventory validation
test: add checkout e2e coverage
refactor: simplify product pricing service
docs: update deployment guide
chore: update dependencies
```

Never use:

```text
update
changes
fix stuff
work
final
```

as commit messages.

---

# 7. Dependency Policy

Use the latest stable versions of the requested stack at project initialization.

Before installing a package:

1. Verify it is actively maintained.
2. Prefer official packages.
3. Avoid unnecessary dependencies.
4. Avoid duplicate libraries solving the same problem.

Do not downgrade packages merely to avoid adapting the implementation.

If a breaking change exists in a new version, adapt the implementation.

Lock dependency versions.

---

# 8. Code Quality

All production code must:

* use TypeScript
* use strict typing
* avoid `any` unless explicitly justified
* have clear module boundaries
* use meaningful names
* avoid duplicated business logic
* avoid magic numbers
* validate external input
* handle errors explicitly
* be testable

Do not silence TypeScript or ESLint errors simply to make builds pass.

Never use:

```typescript
// @ts-ignore
```

or:

```typescript
// eslint-disable
```

unless absolutely necessary and documented.

---

# 9. Database Rules

MariaDB is the primary relational database.

Use Prisma migrations.

Never modify production schema manually when a migration can represent the change.

Every schema change must include:

1. Prisma schema update
2. migration
3. seed updates if required
4. affected application code
5. tests

Consider:

* indexes
* unique constraints
* foreign keys
* cascading behavior
* nullable fields
* transaction boundaries
* concurrency
* data integrity

Do not optimize prematurely, but do not create obviously unscalable schemas.

---

# 10. API Rules

REST APIs must:

* use consistent naming
* use appropriate HTTP methods
* validate request payloads
* return consistent error responses
* use correct HTTP status codes
* document endpoints in Swagger
* enforce authentication/authorization where required

Never expose:

* passwords
* password hashes
* secrets
* internal tokens
* private infrastructure information

---

# 11. Persian / RTL Requirements

The customer-facing application is Persian-first.

Requirements:

* RTL layout
* Persian typography
* Persian-friendly UI
* Persian number/date formatting where appropriate
* proper Jalali date support where required
* تومان/ریال handling must be explicit
* proper RTL forms
* RTL tables
* RTL pagination
* accessible keyboard navigation

Never hardcode Persian text throughout components when a localization architecture is more appropriate.

---

# 12. Money

Never use floating point numbers for financial amounts.

Use integer database values.

The system must explicitly define the monetary unit.

For example:

```text
IRR
```

or:

```text
TOMAN
```

The selected unit must be documented and consistently applied.

---

# 13. Security

Treat all external input as untrusted.

Implement:

* authentication
* authorization
* input validation
* rate limiting where appropriate
* secure password handling
* secure cookies where applicable
* CSRF protection where applicable
* security headers
* SQL injection protection
* XSS protection
* file upload validation
* access control
* audit logging for sensitive administrative actions

Never commit:

* passwords
* API keys
* JWT secrets
* database credentials
* private certificates

Use environment variables.

---

# 14. Testing Philosophy

Do not consider a feature complete merely because the code compiles.

A feature is complete only when:

* TypeScript passes
* lint passes
* unit tests pass
* integration tests pass where applicable
* E2E tests pass where applicable
* production build succeeds
* Docker images build
* Docker Compose starts successfully
* critical user flows work

When a test fails:

DO NOT simply remove or weaken the test.

Find the underlying cause and fix it.

---

# 15. Definition of Done

A task is DONE only when:

```text
Implementation
    ↓
Unit tests
    ↓
Integration tests
    ↓
E2E tests where appropriate
    ↓
Lint
    ↓
Type check
    ↓
Production build
    ↓
Docker build
    ↓
Docker Compose verification
    ↓
Documentation update
    ↓
Git commit
    ↓
Push to development
```

---

# 16. Phase Execution

The project is divided into phases.

Never attempt to implement all phases blindly in one enormous operation.

Work sequentially.

Current phase must be determined from:

```text
phases/
```

and the actual state of the repository.

Before starting a phase:

1. Read the phase document.
2. Read all relevant architecture documentation.
3. Inspect existing implementation.
4. Identify already completed work.
5. Create an implementation plan internally.
6. Implement the phase.

After completion:

1. Run all required tests.
2. Fix failures.
3. Run build.
4. Verify Docker.
5. Update documentation.
6. Commit.
7. Push to `development`.

---

# 17. Do Not Stop Prematurely

Do not stop because:

* the task is large
* there are many files
* tests fail
* an implementation is inconvenient
* a dependency changed
* Docker initially fails
* the first approach does not work

Investigate and continue.

If an approach fails:

1. diagnose
2. identify root cause
3. change the implementation
4. rerun tests
5. continue

Only stop when a genuine external blocker exists.

Examples of genuine blockers:

* missing required secret that cannot be generated locally
* unavailable external service
* unavailable credentials
* GitHub authentication failure
* infrastructure unavailable

When blocked, document exactly:

```text
BLOCKED:
Reason:
What was attempted:
What is required:
```

---

# 18. GitHub

The repository is hosted on GitHub.

GitHub is the source control system.

The development branch is the active integration branch.

After completing meaningful work:

```bash
git add .
git commit
git push origin development
```

Never create a PR unless explicitly instructed.

---

# 19. Project Completion

The project is considered complete only after:

* all phases are implemented
* tests pass
* frontend builds
* backend builds
* Docker Compose works
* Nginx routing works
* production configuration is documented
* database migrations work
* seed data works
* security review is completed
* critical E2E flows pass
* README is complete
* deployment documentation is complete

At the end, provide a concise final report containing:

* implemented phases
* test results
* build results
* Docker status
* known limitations
* remaining TODOs
* deployment instructions

---

# 20. Important Principle

Do not optimize for writing the largest amount of code.

Optimize for:

```text
Correctness
Maintainability
Security
Testability
Performance
Developer Experience
Production Readiness
```

A smaller correct implementation is preferable to a larger broken implementation.
