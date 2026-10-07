# ScholarBridge

A scholarship discovery and application workspace for students planning to study in the United States.

## Local development

Requirements: Node.js 20+ and npm 10+.

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

Open http://localhost:5173. The API and PostgreSQL provide account, profile, application, and contact services. Mailpit captures verification and contact messages locally at http://localhost:8025. Configure a production SMTP provider, sender address, and `CONTACT_EMAIL` before deploying. Set the four `VITE_SOCIAL_*` frontend variables to the official social profiles before launch; see the frontend and backend env examples. `npm run dev` starts the frontend and backend together so the federal university directory is available immediately.

## University directory

The directory uses the latest published Institutional Characteristics archive from the U.S. Department of Education's National Center for Education Statistics (IPEDS). Its bundled 2024 snapshot contains 5,992 active institutions, including 4,057 degree-granting schools. Search, state/territory, ownership, and degree filters run locally through the backend with pagination. Direct admissions links are provided where IPEDS has them; students complete applications on each school's own website.

Refresh the source snapshot with `npm run data:universities` from the repository root, or `npm run data:universities` in `backend/`. The importer downloads the official [IPEDS 2024 archive](https://nces.ed.gov/ipeds/datacenter/data/HD2024.zip) and records its year, source URL, and active-status filters with the data.

The bundled federal university directory can be browsed without a database. Rerun the import command when NCES publishes a newer IPEDS archive.

## Independent hosting

The repository root only coordinates local development. Each deployable application has its own `package.json`, lockfile, env example, and build context.

- **Vercel:** set Root Directory to `frontend/`, install with `npm ci`, build with `npm run build`, and set Output Directory to `dist`. Configure `VITE_API_URL` to the Railway API URL ending in `/api` (see `frontend/.env.example`).
- **Railway:** set Root Directory to `backend/` and deploy with its included `Dockerfile` (or use `npm ci`, `npm run build`, and `npm start`). Configure `DATABASE_URL`, a unique `JWT_SECRET`, `WEB_ORIGIN`, and SMTP settings (see `backend/.env.example`). Run `npm run db:deploy` as the pre-deploy migration command.
- **Local stack:** root `docker-compose.yml` provides PostgreSQL and Mailpit; the root `.env.example` is for this compose setup. The database schema, seed, IPEDS source data, and importer are all under `backend/`.

Before creating or migrating a database, read the [database design and security guide](docs/DATABASE_DESIGN.md). It documents current tables, the recommended production additions, sizing, access controls, and safe migration steps.

Scholarship listings are intentionally empty until verified opportunities are added; the site does not fabricate awards. Before launch, connect and operate a verified scholarship publishing workflow, configure managed storage and email delivery, add MFA for privileged accounts, finalize privacy and retention policies, and complete security testing and operational monitoring.