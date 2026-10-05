# Backend Architecture

The Makerspace Management System relies on Supabase for a completely serverless PostgreSQL backend. 
There is no Node.js backend API (like Express or NestJS). Instead, the frontend communicates directly with the database via PostgREST.

## Core Pillars
1. **PostgreSQL** as the single source of truth.
2. **PostgREST** provides an instant RESTful API over the schema.
3. **Supabase Auth** handles user identity and JWT issuance.
4. **Row Level Security (RLS)** restricts data access directly at the query level.
5. **Security Definer RPCs (Stored Procedures)** encapsulate business logic and state transitions securely.
6. **Edge Functions** handle asynchronous third-party integrations (like email notifications).

## Schema Design
The schema uses `uuid` primary keys for all tables.

### Key Entities
- `users`: Core profile synced with Supabase Auth via triggers.
- `procedure_versions`: Safety/operational procedures that users must agree to.
- `liability_signatures`: Immutable record of a user agreeing to a procedure version.
- `requests`: Core lifecycle object representing a student's intent to use the space.
- `key_handoffs`: Log of physical keys being issued/returned.
- `inventory_items` & `inventory_events`: Track physical materials and tools.
- `floor_allocations`: Tracks physical space usage.
- `penalty_events`: Tracks rule violations.
- `projects`: Public repository of student projects.

## State Transitions
State transitions (e.g., Request `Pending` -> `Claimed`) are NEVER performed using standard `UPDATE` statements from the frontend. Instead, the frontend calls a specific RPC (e.g., `claim_request`). The RPC runs as the database superuser, enforces business constraints (e.g., "Is the caller a Keyholder?"), mutates the state, and writes an unforgeable entry to the `audit_log`.
