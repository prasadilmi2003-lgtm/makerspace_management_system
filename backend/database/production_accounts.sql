-- Creates ONE ready-to-use Superadmin (administrator) account on a LIVE Supabase project.
--
-- HOW TO USE
--   1. Edit the PASSWORD, EMAIL, NAME and STUDENT ID below (the lines marked  <== EDIT).
--   2. Paste the whole file into Supabase Dashboard > SQL Editor and click Run.
--   3. Log in on your website with that email and password. You land on the Operations Dashboard
--      and the sidebar has an "Admin Panel" link.
--
-- Needs: all migrations applied (npm run db:push) and production_seed.sql already run.
-- Safe to run again: if the email already exists it is skipped.
-- The account is created already confirmed and with the liability agreement signed, so no email is needed.
-- AFTERWARDS clear the SQL Editor (it remembers your password in its history).
--
-- Keyholders and other users do not need a script: they register on the website, then you promote them
-- in Admin Panel > User Management.

DO $$
DECLARE
  v_password text := 'admin123456';                   -- <== EDIT: your admin password (8+ characters)
  v_email    text := 'admin@makerspace.ruh.ac.lk';              -- <== EDIT: your admin email (what you type to log in)
  v_name     text := 'Makerspace Admin';                         -- <== EDIT: display name
  v_student  text := 'STAFF/2026/001';                           -- <== EDIT: ID shown on the profile (must be unique)

  v_id uuid;
  v_proc uuid;
BEGIN
  IF v_password = 'CHANGE-THIS-PASSWORD' OR length(v_password) < 8 THEN
    RAISE EXCEPTION 'Set a real password (8+ characters) at the top of this script first.';
  END IF;

  SELECT id INTO v_proc FROM public.procedure_versions WHERE active = true;
  IF v_proc IS NULL THEN
    RAISE EXCEPTION 'No active procedure found. Run backend/database/production_seed.sql first.';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = lower(v_email)) THEN
    RAISE NOTICE 'Skipped % (already exists)', v_email;
    RETURN;
  END IF;

  v_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    lower(v_email), extensions.crypt(v_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', v_name, 'student_id', v_student,
                       'department', 'Mechanical & Manufacturing Engineering', 'academic_year', '2026'),
    now(), now(), '', '', '', '', '', '', '', ''
  );

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), v_id, v_id::text,
          jsonb_build_object('sub', v_id::text, 'email', lower(v_email), 'email_verified', true, 'phone_verified', false),
          'email', now(), now(), now());

  -- The signup trigger has already created public.users as Pending; promote it.
  UPDATE public.users SET role = 'Superadmin', status = 'Active' WHERE id = v_id;

  INSERT INTO public.liability_signatures (user_id, procedure_version_id, signed_name, signed_student_id, ip_address)
  VALUES (v_id, v_proc, v_name, v_student, 'created by admin script');

  INSERT INTO public.audit_log (actor_id, event_type, entity_type, entity_id, metadata)
  VALUES (NULL, 'ACCOUNT_CREATED', 'users', v_id, jsonb_build_object('role', 'Superadmin', 'via', 'production_accounts.sql'));

  RAISE NOTICE 'Created % (Superadmin)', v_email;
END
$$;

-- Check the result:
SELECT email, role, status FROM public.users ORDER BY role;
