-- Seed data for testing

-- Note: We do not insert directly into public.users if we are using Supabase Auth because
-- the trigger `on_auth_user_created` will create the user when an auth account is made.
-- For local testing, you may need to insert into auth.users first, or just bypass it for local dev.

-- Example Procedure Version
INSERT INTO procedure_versions (id, version_string, document_url, content, active)
VALUES (
    uuid_generate_v4(),
    'v1.0',
    'procedures/v1.0.pdf',
    '# Makerspace Operational Procedures...',
    true
);
