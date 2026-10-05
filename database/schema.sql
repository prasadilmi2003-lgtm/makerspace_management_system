-- ... (Previous setup code, I will write the full schema file again) ...
-- Makerspace Management System - Supabase PostgreSQL Schema

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Custom Types (Enums)
CREATE TYPE user_role AS ENUM ('Superadmin', 'Keyholder', 'User', 'Alumni', 'Pending');
CREATE TYPE user_status AS ENUM ('Active', 'Pending_Signature', 'Requires_Reagreement', 'Suspended');
CREATE TYPE request_status AS ENUM ('Pending', 'Claimed', 'Key_Retrieved', 'Active', 'Overdue', 'Completed', 'Cancelled');

-- 3. Tables

CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    student_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    academic_year TEXT,
    department TEXT,
    role user_role NOT NULL DEFAULT 'Pending',
    status user_status NOT NULL DEFAULT 'Pending_Signature',
    penalty_box BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE procedure_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_string TEXT NOT NULL UNIQUE,
    document_url TEXT NOT NULL,
    content TEXT,
    active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE liability_signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    procedure_version_id UUID NOT NULL REFERENCES procedure_versions(id) ON DELETE RESTRICT,
    signed_name TEXT NOT NULL,
    signed_student_id TEXT NOT NULL,
    ip_address TEXT,
    agreed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

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

CREATE TABLE penalty_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    keyholder_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    cleared_at TIMESTAMP WITH TIME ZONE,
    clearing_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reason TEXT
);

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    condition TEXT NOT NULL DEFAULT 'Good',
    status TEXT NOT NULL DEFAULT 'Available',
    last_checked TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE inventory_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    request_id UUID REFERENCES requests(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE floor_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    zone TEXT NOT NULL,
    bench TEXT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 4. Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedure_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE liability_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE penalty_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE floor_allocations ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- Users: Anyone can view profiles. Users can only update specific non-privileged fields (not role, status, penalty_box).
CREATE POLICY "Users can view all users" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own non-privileged profile data" ON users FOR UPDATE USING (auth.uid() = id) WITH CHECK (
    -- This ensures they can't change their role or status through a standard update
    role = (SELECT role FROM users WHERE id = auth.uid()) AND
    status = (SELECT status FROM users WHERE id = auth.uid()) AND
    penalty_box = (SELECT penalty_box FROM users WHERE id = auth.uid())
);

-- Procedures: Anyone can view active versions.
CREATE POLICY "Anyone can view active procedure versions" ON procedure_versions FOR SELECT USING (active = true);

-- Liability Signatures: Users can view their own. No direct inserts (handled by RPC).
CREATE POLICY "Users can view own signatures" ON liability_signatures FOR SELECT USING (auth.uid() = user_id);

-- Audit Log: Superadmin reads. No direct inserts/updates/deletes.
CREATE POLICY "Superadmin can read audit log" ON audit_log FOR SELECT USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'Superadmin'
);

-- 6. Functions and Triggers

-- Trigger: New Auth User -> public.users sync
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, full_name, student_id, email, academic_year, department, role, status)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'student_id',
    new.email,
    new.raw_user_meta_data->>'academic_year',
    new.raw_user_meta_data->>'department',
    'Pending',
    'Pending_Signature'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- RPC: Sign Liability Agreement
-- This securely inserts the signature, logs the audit event, and activates the user.
CREATE OR REPLACE FUNCTION sign_liability(
    p_procedure_version_id UUID,
    p_signed_name TEXT,
    p_signed_student_id TEXT,
    p_ip_address TEXT
) RETURNS void
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_actual_name TEXT;
    v_actual_student_id TEXT;
    v_proc_version TEXT;
    v_user_role user_role;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Verify user data
    SELECT full_name, student_id, role INTO v_actual_name, v_actual_student_id, v_user_role
    FROM users WHERE id = v_user_id;

    IF v_actual_name != p_signed_name THEN
        RAISE EXCEPTION 'Signed name does not match registered name';
    END IF;

    IF v_actual_student_id != p_signed_student_id THEN
        RAISE EXCEPTION 'Signed student ID does not match registered ID';
    END IF;

    -- Verify procedure is active
    SELECT version_string INTO v_proc_version
    FROM procedure_versions
    WHERE id = p_procedure_version_id AND active = true;

    IF v_proc_version IS NULL THEN
        RAISE EXCEPTION 'Invalid or inactive procedure version';
    END IF;

    -- Insert signature
    INSERT INTO liability_signatures (user_id, procedure_version_id, signed_name, signed_student_id, ip_address)
    VALUES (v_user_id, p_procedure_version_id, p_signed_name, p_signed_student_id, p_ip_address);

    -- Upgrade status
    UPDATE users SET status = 'Active' WHERE id = v_user_id;

    -- If role is pending, upgrade to User (if Superadmin hasn't set them to Keyholder yet, etc)
    IF v_user_role = 'Pending' THEN
        UPDATE users SET role = 'User' WHERE id = v_user_id;
    END IF;

    -- Insert audit log
    INSERT INTO audit_log (actor_id, event_type, entity_type, entity_id, metadata)
    VALUES (
        v_user_id,
        'SIGNATURE_CAPTURED',
        'liability_signatures',
        v_user_id,
        jsonb_build_object('version', v_proc_version, 'ip', p_ip_address)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Immutability Triggers
-- Prevent liability_signatures modification
CREATE OR REPLACE FUNCTION prevent_liability_modification()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Liability signatures cannot be modified or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_liability_update
BEFORE UPDATE ON liability_signatures
FOR EACH ROW EXECUTE PROCEDURE prevent_liability_modification();

CREATE TRIGGER prevent_liability_delete
BEFORE DELETE ON liability_signatures
FOR EACH ROW EXECUTE PROCEDURE prevent_liability_modification();

-- Prevent audit_log modification
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
