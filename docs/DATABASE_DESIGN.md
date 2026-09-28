# ScholarBridge Database Design

## Recommendation

Use managed PostgreSQL as the source of truth, with Prisma migrations checked into `backend/prisma/migrations/`. The current schema contains **10 tables**. For the planned account, scholarship, and application workflows, use an **18-table production baseline**. Add **2 MFA tables** before enabling admin, reviewer, or finance accounts, for **20 tables total**.

A table count does not determine capacity or security. Clear ownership, constraints, indexes, managed storage, backups, and access controls do. Do not store uploaded file contents in PostgreSQL; store files in private object storage and store only metadata and opaque object keys in the database.

## Current Tables (10)

| Table | Purpose |
| --- | --- |
| `User` | Login identity, normalized unique email, password hash, and account role. |
| `Student` | One-to-one student profile and current study/funding preferences. |
| `EmailVerificationToken` | Hashed, expiring, single-use verification codes. |
| `University` | Institutions and their verification state. |
| `Program` | Programs belonging to an institution. |
| `Scholarship` | Published opportunity details, criteria, deadlines, and verification state. |
| `Application` | One student's application to one scholarship; unique student/scholarship pair. |
| `Review` | Reviewer decisions and notes for an application. |
| `Document` | Private document metadata and object-storage key, not the file bytes. |
| `AuditLog` | Security- and operations-relevant events. |

The current definitions are in [backend/prisma/schema.prisma](../backend/prisma/schema.prisma). The bundled IPEDS JSON is a read-only directory snapshot, not a relational table. Do not duplicate it into PostgreSQL unless the product needs user-managed edits, joins, or a database-backed import workflow.

## Production Baseline (18)

Keep the 10 existing tables above and add these 8 tables as their features are implemented:

| New table | Purpose and key constraints |
| --- | --- |
| `AuthSession` | Refresh/session lifecycle. Store only a hash of a high-entropy refresh token; unique hash, user FK, expiry, revocation time, rotation/reuse metadata. Revoke on logout, password change, and suspicious activity. |
| `PasswordResetToken` | Single-use password reset token hash, user FK, expiry, and used time. Never store or return the raw token. |
| `StudentEducation` | Zero-to-many schools/degrees per student, with dates and current/completed state. A separate table avoids limiting a student to one education record. |
| `ScholarshipSource` | One or more authoritative source URLs and source owner per scholarship, plus last checked time and source status. Keep source evidence distinct from the public scholarship text. |
| `ApplicationQuestion` | Versioned question definitions for a scholarship/application form. Preserve the question text/type used when an application was started. |
| `ApplicationAnswer` | Answers for one application/question pair. Unique `(applicationId, questionId)`; use typed columns for common answer types and JSON only for genuinely variable structured fields. |
| `ApplicationStatusHistory` | Append-only status transitions: application, old/new status, actor, timestamp, and reason. Do not rely on the current status alone as an audit trail. |
| `EmailOutbox` | Durable transactional email queue: recipient, template/type, safe payload, status, attempt count, next attempt, sent time, and idempotency key. Keep credentials and raw auth tokens out of logs/payloads. |

Add these **2 security tables before privileged roles can sign in**:

| Table | Purpose and key constraints |
| --- | --- |
| `MfaFactor` | Enrolled authenticator/WebAuthn factor. Encrypt any secret at the application layer; record factor type, label, created/last-used/revoked timestamps. |
| `MfaRecoveryCode` | Hashed, one-use recovery codes. Unique hash, consumed timestamp; show plaintext only once at generation. |

Optional later tables, not required for the first release: `Notification` for an in-app inbox, `ScholarshipEligibilityRule` for complex machine-readable criteria, `UniversityMembership` for institution staff, and `DocumentScan` if scan attempts/results need a durable history. Add them only when the product feature needs them.

## Relationships and Data Rules

- `User` owns one `Student` profile and many sessions/tokens. Deleting a user should cascade personal profile and token/session rows, subject to retention/legal policy.
- `Student` has many education records, documents, and applications.
- `University` has many programs and scholarships. Scholarship links to a university/program are optional when the funding provider is independent.
- `Application` belongs to one student and one scholarship. Keep the unique `(studentId, scholarshipId)` constraint.
- Answers, reviews, and status history belong to an application. Never allow a client to choose another student's `studentId`; derive it from the authenticated user on the server.
- Every privileged status change records the actor and reason in an append-only history/audit record in the same database transaction as the change.
- Store canonical emails in lowercase and apply a unique constraint to the canonical value. Store timestamps as UTC `timestamptz` where practical; display in the user's chosen timezone.
- Use foreign keys, `NOT NULL`, `UNIQUE`, `CHECK`, and enum constraints for invariants. Validate at the API boundary too; database constraints remain the final guard against invalid state.

## Index Plan

Create indexes for actual query patterns and verify them with `EXPLAIN (ANALYZE, BUFFERS)` against representative data. Start with:

- Unique `User.email` (canonical lowercase).
- `EmailVerificationToken(userId, expiresAt)` and `PasswordResetToken(userId, expiresAt)`; unique token hashes.
- `AuthSession(userId, expiresAt)` and unique token hash.
- `StudentEducation(studentId)`, `Document(studentId, uploadedAt)`, and `Application(studentId, createdAt)`.
- `Application(scholarshipId, status)`, `ApplicationStatusHistory(applicationId, createdAt)`, and `Review(applicationId, createdAt)`.
- `Scholarship(verificationStatus, deadline)` and any filter columns proven frequently used.
- `ScholarshipSource(scholarshipId, lastCheckedAt)` and `EmailOutbox(status, nextAttemptAt)`.
- `AuditLog(createdAt)`, plus actor/action indexes used by the admin console.

Avoid indexing every column: each index consumes storage and slows writes. Do not use a plain B-tree for arbitrary long-text search; use PostgreSQL full-text search or a dedicated search service when measured query volume warrants it.

## Capacity and Growth

Estimate storage from measured row sizes and indexes, not from the number of tables:

`required database storage ≈ rows × measured average row size + indexes + migration/maintenance headroom`

Plan at least 30% free space for normal growth, index rebuilds, and maintenance. For a first production environment, choose a managed PostgreSQL plan with automated storage growth if available, alerts around 70% and 85% utilization, and a tested upgrade path. Benchmark with realistic application answers, audit volume, and indexes before selecting a fixed disk size.

Documents dominate storage if placed in the database: at 100,000 users with two 5 MB files each, files alone would be about 1 TB. Put document bytes in private S3-compatible object storage; PostgreSQL holds metadata, a non-public object key, size, MIME type, checksum, scan state, and timestamps. Serve files only through short-lived signed URLs after checking ownership/authorization.

Keep operational/audit history under a retention policy. At high volume, partition large append-only tables such as `AuditLog`, `EmailOutbox`, or status history by time only after measurements show a need. Archive old records before deleting them where compliance requires retention.

## Security Requirements

No database can be guaranteed immune to attackers. Use defense in depth:

1. Use managed PostgreSQL with private networking; do not expose port 5432 to the public internet. Restrict inbound connections to the backend/deployment network and developer VPN/IP allowlist.
2. Require TLS for database connections (`sslmode=require` or the provider's stricter setting). Keep production `DATABASE_URL`, JWT secrets, SMTP credentials, and object-storage keys in Railway's secret manager, never in source control, browser variables, logs, or screenshots.
3. Use separate database roles: a migration role with DDL privileges and a runtime role limited to required CRUD operations. The runtime API must not connect as the PostgreSQL superuser or table owner.
4. Use Prisma's parameterized queries. Never concatenate user input into SQL or use unsafe raw-query methods with user-controlled strings. Validate request bodies with allowlisted schemas; do not mass-assign client-supplied roles, IDs, verification status, or ownership fields.
5. Hash passwords with a dedicated password-hashing algorithm and parameters appropriate to current hardware. Keep verification/reset/session tokens high entropy, store hashes only, expire them, make them one-use, rate-limit issue/verify endpoints, and revoke sessions after password changes.
6. Enforce authorization in every API query and mutation. A valid token is not proof that the caller owns a student, application, or document. Consider PostgreSQL row-level security as an additional defense for tenant isolation, not a replacement for API authorization.
7. Encrypt backups and object storage, restrict backup access, retain point-in-time recovery, and regularly test restoration. Define deletion/export/retention rules for student personal data and documents.
8. Keep security/audit logs append-only for application roles. Exclude passwords, raw tokens, document contents, and unnecessary personal data from logs. Alert on unusual login/reset failures, privilege changes, data exports, and repeated authorization failures.
9. Run schema migrations through reviewed deployment steps. Never use `prisma db push` against production. Back up before destructive migrations and test migrations against a disposable database with production-like volume.
10. Add MFA for administrators/reviewers/finance before enabling those accounts. Review grants, secrets, dependency alerts, backups, and access logs periodically; perform security testing before launch.

## Database Creation and Migration Workflow

1. Provision PostgreSQL with a dedicated database, private networking, TLS, backups, and separate migration/runtime credentials.
2. Set `DATABASE_URL` and the other backend secrets using the provider's secret settings. Do not commit a real `.env` file.
3. For a brand-new empty database, run `npm run db:deploy` from `backend/` (or as Railway's pre-deploy command). This applies checked-in SQL under `backend/prisma/migrations/`.
4. For an existing database, stop and compare its actual schema/data with the migration history before applying anything. The initial migration is for a new database; do not blindly apply it to tables that already exist. Baseline an existing database deliberately and keep a verified backup.
5. Test signup, email verification, login, profile ownership, application creation/submission, reviewer authorization, and document access against a disposable database before production.
6. Monitor connection count, query latency, slow queries, disk usage, table/index bloat, backup success, and failed migrations. Use a connection pooler when the hosting/runtime model opens many short-lived connections.

The checked-in initial migration creates the current 10-table schema. Add each additional table through a new Prisma schema change and migration; do not edit a migration already applied to a shared environment.
