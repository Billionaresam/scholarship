# Architecture

Frontend and backend are intentionally independent applications.

## Frontend
React/Vite/TypeScript. The complete Vercel project root is `frontend/`, including its own package manifest, lockfile, env example, and Vite config. It communicates with the API through `src/lib/api.ts`.

## Backend
Express REST API. The complete Railway project root is `backend/`, including its Dockerfile, package manifest, lockfile, env example, Prisma schema/seed, and bundled IPEDS directory. JWT authentication, RBAC, validation, rate limiting, Helmet, Prisma data access and audit logging live here.

## Database
PostgreSQL via Prisma. The schema separates identity, student profiles, universities, programs, scholarships, documents, applications, reviews and audit events.

## Recommended production integrations
- S3-compatible private object storage for documents
- Transactional email provider for verification, password reset and notifications
- Background worker/queue for email, matching and document processing
- Search engine when opportunity volume requires it
- Observability platform for logs, metrics and traces
- Managed PostgreSQL with encrypted backups
