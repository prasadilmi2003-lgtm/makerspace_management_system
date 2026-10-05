# Local Development Guide

This guide explains how to spin up the Makerspace Management System backend locally for development.

## 1. Prerequisites
- Docker (must be running)
- Supabase CLI (`npm install -g supabase`)
- Node.js & npm (for frontend and scripts)

## 2. Start Supabase Locally
Navigate to the root of the repository (where the `supabase` folder is located) and run:
```bash
supabase start
```
This will download and run the Postgres, PostgREST, Auth, and Storage containers. 
Once running, it will output your local credentials (API URL, `anon` key, `service_role` key, DB connection string).

## 3. Apply Migrations and Seed Data
Supabase automatically applies everything in `supabase/migrations` (if using the standard directory structure) or you can manually apply our custom SQL files:

```bash
# If running manually against a local or remote instance:
psql -h localhost -p 5432 -d postgres -U postgres -f database/schema.sql
psql -h localhost -p 5432 -d postgres -U postgres -f database/seed.sql
```
*(Password is usually `postgres` locally).*

## 4. Edge Functions
We use an Edge Function for processing the notification queue.
To serve it locally:
```bash
supabase functions serve --env-file supabase/.env.local
```
*(Make sure to create `supabase/.env.local` with your dummy `RESEND_API_KEY` and `WEBHOOK_SECRET` for testing).*

## 5. Environment Variables
Copy the example frontend env file:
```bash
cp frontend/.env.example frontend/.env.local
```
Fill in the `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` with the local values provided by `supabase start`. **Never commit `.env.local`**.

## 6. Testing
To run the automated backend tests:
```bash
node scripts/backend_tests.js
```
To run the health diagnostic script:
```bash
node scripts/backend_diagnostics.js
```
*(Both scripts rely on `frontend/.env.local` to know where to connect).*
