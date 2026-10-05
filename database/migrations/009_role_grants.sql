-- 009_role_grants.sql

-- The Supabase API relies on the 'anon' and 'authenticated' roles having
-- base CRUD privileges on the tables. RLS policies then filter the rows.
-- Without these grants, the PostgREST API throws 42501 Permission Denied.

GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant access to all current tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;

-- Ensure future tables get the same grants automatically
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
