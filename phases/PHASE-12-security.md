# Phase 12 — Security Hardening

## Objective

Perform a production-oriented security review.

---

## Review

Check:

* authentication
* authorization
* RBAC
* input validation
* SQL injection
* XSS
* CSRF
* rate limiting
* session handling
* cookies
* CORS
* security headers
* file uploads
* secrets
* error handling

---

## Dependency Security

Audit dependencies.

Remove unnecessary dependencies.

Update vulnerable packages when compatible.

---

## API Security

Ensure:

* protected endpoints are actually protected
* admin endpoints enforce authorization
* seller data cannot leak across sellers
* users cannot access other users' private data

---

## Tests

Add security regression tests.

Do not use destructive penetration testing against external infrastructure.

Test the application locally.

---

## Deliverable

Create:

```text
SECURITY.md
```

documenting:

* security architecture
* threat model
* known limitations
* operational recommendations

Commit:

```text
security: harden ecommerce platform
```

Push to development.
