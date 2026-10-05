# University of Ruhuna Makerspace Management System

A complete, full-stack Management System for the University of Ruhuna Faculty of Engineering Makerspace. 

This system handles user onboarding (liability signatures), request lifecycles, key handoffs, inventory checkout, physical floor allocations, penalty box enforcement, and public project showcases.

## System Architecture

The project is divided into a serverless backend and a React frontend:

- **Backend:** Supabase (PostgreSQL, PostgREST, Auth, Edge Functions, Realtime).
- **Frontend:** React + Vite, styled with Tailwind CSS, utilizing `@supabase/supabase-js`.

## Documentation

The repository contains comprehensive documentation for developers:
- [Backend Architecture](docs/backend-architecture.md)
- [Backend Security & RLS](docs/backend-security.md)
- [Frontend API Integration](docs/frontend-integration.md)
- [Realtime Subscriptions](docs/realtime.md)
- [Deployment Guide](docs/deployment.md)
- [Local Development Guide](docs/local-development.md)

## Quick Start (Local Full-Stack)

To run the entire system on your local machine:

### 1. Start the Backend
Requires Docker Desktop to be running.
```bash
npx supabase start
```
*This will spin up a local PostgreSQL database, apply all migrations, and expose the API and Studio endpoints.*

### 2. Configure the Frontend
Copy the environment variables:
```bash
cp frontend/.env.example frontend/.env.local
```
Update `.env.local` with the `API URL` and `anon key` outputted by `supabase start`.

### 3. Start the Frontend
```bash
cd frontend
npm install
npm run dev
```
Navigate to `http://localhost:5173`. 

### (Optional) Demo Mode
If you do not configure Supabase (`.env.local` is empty), the frontend will automatically boot into a **UI Preview Mode** with mock data and selectable Demo Roles.

## Testing & Diagnostics

To verify the backend health or run the automated API tests:
```bash
npm run test:backend
# Or manually:
node scripts/backend_diagnostics.js
node scripts/backend_tests.js
```

## Team
- **Frontend / UI:** Implemented on the `Raven` branch.
- **Backend / Database:** Implemented on the `dilmi` branch.
- **Integration:** Branches unified successfully.