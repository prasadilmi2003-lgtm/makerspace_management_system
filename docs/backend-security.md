# Backend Security & RLS Architecture

The Makerspace backend uses a strict **Least Privilege** model powered by PostgreSQL Row Level Security (RLS) and Security Definer RPCs.

## 1. Table Grants (The First Line of Defense)
As defined in Migration 009, API roles (`anon` and `authenticated`) only possess explicit `GRANT` privileges where necessary.
- **NO table** has `DELETE` granted to the API.
- **Immutable Tables** (`audit_log`, `liability_signatures`, `key_handoffs`, `inventory_events`) have NO write grants (`INSERT`/`UPDATE`/`DELETE`) for API roles. They are structurally immutable from the frontend.

## 2. Row Level Security (RLS) (The Logical Boundary)
RLS policies restrict *which* rows a user can interact with based on `auth.uid()` and their `role`.
- **User Segregation:** Users can only `SELECT` their own `requests`, `liability_signatures`, and `penalty_events`.
- **Role Elevation:** Keyholders and Superadmins receive elevated `SELECT` access to view the queue, inventory events, and key handoffs.
- **Admin Isolation:** Operations like `bulk_role_reset` or publishing procedures are locked to the `Superadmin` role via explicit checks (`IF role != 'Superadmin' THEN RAISE EXCEPTION;`).

## 3. Security Definer RPCs (Controlled State Transitions)
Because users do not have raw `UPDATE` access to critical tables like `requests` (to prevent arbitrary status spoofing), state transitions are handled exclusively through PostgreSQL functions.
- Functions execute as the `SECURITY DEFINER` (the database superuser).
- Functions validate the business logic (e.g., checking if the caller is the assigned Keyholder, verifying stock availability, ensuring positive integers).
- If validation passes, the function mutates the state and writes an unforgeable entry to the `audit_log`.

## 4. Webhook Security
The `process-notifications` Edge Function is protected by an explicit `x-webhook-secret` header check. It inherently fails closed if the secret is missing or misconfigured in the environment. It also bypasses JWT checks natively (`verify_jwt = false`) to ensure the Postgres HTTP trigger is not blocked by generic Auth layers.

## 5. Audit Logging
Every critical action (claiming a request, retrieving a key, penalizing a user, overriding a penalty) forces an insert into `audit_log`. This table is append-only for the superuser, and strictly read-only (and restricted to Superadmins) for the API.
