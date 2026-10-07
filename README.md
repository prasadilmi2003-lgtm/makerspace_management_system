# University of Ruhuna Makerspace Management System

A complete, full-stack Management System for the University of Ruhuna Faculty of Engineering Makerspace. 

This system handles user onboarding (liability signatures), request lifecycles, key handoffs, inventory checkout, physical floor allocations, penalty box enforcement, and public project showcases.

## System Architecture

The project is divided into a serverless backend and a React frontend:

- **Backend:** Supabase (PostgreSQL, PostgREST, Auth, Edge Functions, Realtime).
- **Frontend:** React + Vite, styled with Tailwind CSS, utilizing `@supabase/supabase-js`.

## Repository layout

```
frontend/   React + Vite app (npm run dev). Talks to the backend through @supabase/supabase-js.
backend/    Supabase project: database/ (migrations, seed), supabase/ (CLI config, edge functions), scripts/ (seed + tests)
docs/       Architecture, security, integration and deployment guides
```

Run everything from the repo root (`npm run dev`, `npm run db:start`, `npm run test:e2e`) or from inside `frontend/` / `backend/`.

## Documentation

The repository contains comprehensive documentation for developers:
- [Backend Architecture](docs/backend-architecture.md)
- [Backend Security & RLS](docs/backend-security.md)
- [Frontend API Integration](docs/frontend-integration.md)
- [Realtime Subscriptions](docs/realtime.md)
- [Deploy for free (Vercel + Supabase)](docs/free-deployment.md): step-by-step for a public site
- [Deployment Guide](docs/deployment.md): CLI details, edge functions, webhooks
- [Local Development Guide](docs/local-development.md)

## Quick Start (Local Full-Stack)

Requires Docker Desktop (running) and Node 20+.

```bash
npm run install:all         # installs backend/ (Supabase CLI + scripts) and frontend/
npm run db:start            # applies backend/database/migrations/* and starts Supabase in Docker
npm run db:seed-users       # demo accounts for every role + sample requests/projects; writes frontend/.env.local
npm run dev                 # starts the React app (same as: cd frontend && npm run dev)
```

Open the URL Vite prints and sign in with any seeded account (emails and the local-only password are in
`backend/scripts/seed_dev_users.mjs` and `backend/scripts/dev_config.mjs`): `admin@makerspace.ruh.ac.lk`, `kasun@eng.ruh.ac.lk` (Keyholder),
`ruwan@eng.ruh.ac.lk` (Keyholder in the penalty box), `shaminda@eng.ruh.ac.lk` (student), `imesha@eng.ruh.ac.lk` (pending signature).
Supabase Studio is at http://127.0.0.1:54323 and the confirmation-email inbox (Mailpit) at http://127.0.0.1:54324.

Other commands: `npm run db:reset` (wipe + re-apply migrations and seed, then re-run `db:seed-users`), `npm run db:stop`, `npm run db:status`.

> **Migrations.** `backend/database/migrations/*.sql` is the source of truth (`000_base_schema` then `001`…`011`).
> `npm run db:sync` copies them to `backend/supabase/migrations/` with the timestamped names the CLI expects (that folder is generated and git-ignored).
> `backend/database/schema.sql` is a single-file bundle of the same SQL for plain `psql` use.

### (Optional) Demo Mode
If you do not configure Supabase (no `frontend/.env.local`), the frontend will automatically boot into a **UI Preview Mode** with mock data and selectable Demo Roles.

## Testing & Diagnostics

```bash
npm run test:e2e        # resets the LOCAL database, seeds it, then runs ~40 checks as real signed-in users:
                        # RLS/privacy, request lifecycle, key handoff, penalty box, inventory, re-agreement, audit log
npm run test:backend    # original smoke tests (anonymous reads, immutability, authorization)
npm run diagnostics     # backend health check
```

## Team
- **Frontend / UI:** Implemented on the `Raven` branch.
- **Backend / Database:** Implemented on the `dilmi` branch.
- **Integration:** Branches unified successfully.