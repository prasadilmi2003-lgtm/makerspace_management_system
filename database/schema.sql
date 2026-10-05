-- Makerspace Management System - Supabase PostgreSQL Schema

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Custom Types (Enums)
CREATE TYPE user_role AS ENUM ('Superadmin', 'Keyholder', 'User', 'Alumni', 'Pending');
CREATE TYPE user_status AS ENUM ('Active', 'Pending_Signature', 'Requires_Reagreement', 'Suspended');
CREATE TYPE request_status AS ENUM ('Pending', 'Claimed', 'Key_Retrieved', 'Active', 'Overdue', 'Completed', 'Cancelled');

-- 3. Tables

-- users table extending auth.users (handled via trigger)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    student_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'Pending',
    status user_status NOT NULL DEFAULT 'Pending_Signature',
    penalty_box BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- procedure_versions
CREATE TABLE procedure_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_string TEXT NOT NULL UNIQUE,
    document_url TEXT NOT NULL, -- Reference to Supabase Storage path
    content TEXT, -- Optional text content for quick search/rendering
    active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- liability_signatures
CREATE TABLE liability_signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    procedure_version_id UUID NOT NULL REFERENCES procedure_versions(id) ON DELETE RESTRICT,
    signed_name TEXT NOT NULL,
    signed_student_id TEXT NOT NULL,
    ip_address TEXT,
    agreed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- requests
CREATE TABLE requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    description TEXT,
    preferred_date DATE NOT NULL,
    estimated_duration_mins INTEGER NOT NULL,
    status request_status NOT NULL DEFAULT 'Pending',
    assigned_keyholder_id UUID REFERENCES users(id) ON DELETE SET NULL,
    claimed_at TIMESTAMP WITH TIME ZONE,
    estimated_end_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- key_handoffs
CREATE TABLE key_handoffs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE RESTRICT,
    keyholder_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    retrieved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now()),
    retrieved_from_officer TEXT NOT NULL,
    returned_at TIMESTAMP WITH TIME ZONE,
    returned_to_officer TEXT,
    was_overdue BOOLEAN DEFAULT false
);

-- penalty_events
CREATE TABLE penalty_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    keyholder_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    cleared_at TIMESTAMP WITH TIME ZONE,
    clearing_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reason TEXT
);

-- audit_log
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- 4. Initial RLS Configuration
-- RLS must be enabled for all operational tables.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedure_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE liability_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE penalty_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Note: specific RLS policies will be implemented as they are needed for endpoints.

-- 5. Trigger for new auth user -> public.users sync
-- This function runs automatically on signup via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, full_name, student_id, email, role, status)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'student_id',
    new.email,
    'Pending',
    'Pending_Signature'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 6. Trigger for audit log immutability
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Audit log records cannot be modified or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_audit_log_update
BEFORE UPDATE ON audit_log
FOR EACH ROW EXECUTE PROCEDURE prevent_audit_log_modification();

CREATE TRIGGER prevent_audit_log_delete
BEFORE DELETE ON audit_log
FOR EACH ROW EXECUTE PROCEDURE prevent_audit_log_modification();

