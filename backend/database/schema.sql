-- Makerspace Management System: complete schema (base + migrations 001-011 bundled).
-- Prefer database/migrations/ for incremental changes; this file is a convenience bundle for psql.

-- Makerspace Management System - Supabase PostgreSQL Schema

-- 1. Enable UUID Extension
-- gen_random_uuid() is built into Postgres 13+, so no uuid-ossp extension is needed (it lives in a schema the hosted migration runner does not search).

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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_string TEXT NOT NULL UNIQUE,
    document_url TEXT NOT NULL,
    content TEXT,
    active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE liability_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    procedure_version_id UUID NOT NULL REFERENCES procedure_versions(id) ON DELETE RESTRICT,
    signed_name TEXT NOT NULL,
    signed_student_id TEXT NOT NULL,
    ip_address TEXT,
    agreed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE RESTRICT,
    keyholder_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    retrieved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now()),
    retrieved_from_officer TEXT NOT NULL,
    returned_at TIMESTAMP WITH TIME ZONE,
    returned_to_officer TEXT,
    was_overdue BOOLEAN DEFAULT false
);

CREATE TABLE penalty_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyholder_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    cleared_at TIMESTAMP WITH TIME ZONE,
    clearing_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reason TEXT
);

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    condition TEXT NOT NULL DEFAULT 'Good',
    status TEXT NOT NULL DEFAULT 'Available',
    last_checked TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE inventory_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    request_id UUID REFERENCES requests(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE floor_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- 001_request_lifecycle.sql

-- RLS for requests
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own requests" ON requests
    FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Keyholders and Admins can view all requests" ON requests
    FOR SELECT USING (
        (SELECT role FROM users WHERE id = auth.uid()) IN ('Keyholder', 'Superadmin')
    );

CREATE POLICY "Users can insert own requests" ON requests
    FOR INSERT WITH CHECK (
        auth.uid() = student_id AND
        (SELECT status FROM users WHERE id = auth.uid()) = 'Active'
    );

-- Users can update their own request only if it's pending (e.g. to cancel it)
CREATE POLICY "Users can cancel own pending requests" ON requests
    FOR UPDATE USING (
        auth.uid() = student_id AND status = 'Pending'
    ) WITH CHECK (
        status = 'Cancelled'
    );

-- RPC for Claiming a Request
CREATE OR REPLACE FUNCTION claim_request(p_request_id UUID)
RETURNS void
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_role user_role;
    v_penalty BOOLEAN;
    v_req_status request_status;
BEGIN
    -- Verify user
    SELECT role, penalty_box INTO v_role, v_penalty
    FROM users WHERE id = v_user_id;

    IF v_role NOT IN ('Keyholder', 'Superadmin') THEN
        RAISE EXCEPTION 'Only Keyholders or Superadmins can claim requests';
    END IF;

    IF v_penalty = true THEN
        RAISE EXCEPTION 'Keyholder is in the penalty box and cannot claim requests';
    END IF;

    -- Verify request
    SELECT status INTO v_req_status
    FROM requests WHERE id = p_request_id FOR UPDATE; -- lock row

    IF v_req_status != 'Pending' THEN
        RAISE EXCEPTION 'Request is not in Pending state';
    END IF;

    -- Update Request
    UPDATE requests
    SET status = 'Claimed', assigned_keyholder_id = v_user_id, claimed_at = now()
    WHERE id = p_request_id;

    -- Audit Log
    INSERT INTO audit_log (actor_id, event_type, entity_type, entity_id, metadata)
    VALUES (v_user_id, 'REQUEST_CLAIMED', 'requests', p_request_id, '{}'::jsonb);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC for Cancelling a Request (by Keyholder/Admin)
CREATE OR REPLACE FUNCTION cancel_request(p_request_id UUID, p_reason TEXT)
RETURNS void
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_role user_role;
    v_req_status request_status;
BEGIN
    SELECT role INTO v_role FROM users WHERE id = v_user_id;
    
    IF v_role NOT IN ('Keyholder', 'Superadmin') THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    SELECT status INTO v_req_status FROM requests WHERE id = p_request_id FOR UPDATE;

    IF v_req_status IN ('Completed', 'Cancelled') THEN
        RAISE EXCEPTION 'Request cannot be cancelled from current state';
    END IF;

    UPDATE requests SET status = 'Cancelled' WHERE id = p_request_id;

    INSERT INTO audit_log (actor_id, event_type, entity_type, entity_id, metadata)
    VALUES (v_user_id, 'REQUEST_CANCELLED', 'requests', p_request_id, jsonb_build_object('reason', p_reason));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 002_key_management.sql

-- RPC for Retrieve Key
CREATE OR REPLACE FUNCTION retrieve_key(p_request_id UUID, p_officer_name TEXT)
RETURNS void
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_req_status request_status;
    v_assigned_id UUID;
    v_duration INTEGER;
BEGIN
    SELECT status, assigned_keyholder_id, estimated_duration_mins
    INTO v_req_status, v_assigned_id, v_duration
    FROM requests WHERE id = p_request_id FOR UPDATE;

    IF v_req_status != 'Claimed' THEN
        RAISE EXCEPTION 'Request must be Claimed to retrieve key';
    END IF;

    IF v_assigned_id != v_user_id THEN
        RAISE EXCEPTION 'Only the assigned Keyholder can retrieve the key';
    END IF;

    -- Update request
    UPDATE requests
    SET status = 'Active', estimated_end_time = now() + (v_duration || ' minutes')::interval
    WHERE id = p_request_id;

    -- Insert handoff record
    INSERT INTO key_handoffs (request_id, keyholder_id, retrieved_from_officer)
    VALUES (p_request_id, v_user_id, p_officer_name);

    -- Audit Log
    INSERT INTO audit_log (actor_id, event_type, entity_type, entity_id, metadata)
    VALUES (v_user_id, 'KEY_RETRIEVED', 'requests', p_request_id, jsonb_build_object('officer', p_officer_name));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC for Return Key
CREATE OR REPLACE FUNCTION return_key(p_request_id UUID, p_officer_name TEXT)
RETURNS void
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_req_status request_status;
    v_assigned_id UUID;
    v_handoff_id UUID;
    v_is_overdue BOOLEAN := false;
BEGIN
    SELECT status, assigned_keyholder_id
    INTO v_req_status, v_assigned_id
    FROM requests WHERE id = p_request_id FOR UPDATE;

    IF v_req_status NOT IN ('Active', 'Overdue') THEN
        RAISE EXCEPTION 'Key cannot be returned for this request state';
    END IF;

    IF v_assigned_id != v_user_id AND (SELECT role FROM users WHERE id = v_user_id) != 'Superadmin' THEN
        RAISE EXCEPTION 'Only the assigned Keyholder or Superadmin can return the key';
    END IF;

    IF v_req_status = 'Overdue' THEN
        v_is_overdue := true;
    END IF;

    SELECT id INTO v_handoff_id FROM key_handoffs WHERE request_id = p_request_id AND returned_at IS NULL;

    UPDATE key_handoffs
    SET returned_at = now(), returned_to_officer = p_officer_name, was_overdue = v_is_overdue
    WHERE id = v_handoff_id;

    UPDATE requests SET status = 'Completed' WHERE id = p_request_id;

    INSERT INTO audit_log (actor_id, event_type, entity_type, entity_id, metadata)
    VALUES (v_user_id, 'KEY_RETURNED', 'requests', p_request_id, jsonb_build_object('officer', p_officer_name, 'was_overdue', v_is_overdue));

    -- Clear penalty box if they have no other overdue requests
    IF v_is_overdue THEN
        IF NOT EXISTS (
            SELECT 1 FROM requests
            WHERE assigned_keyholder_id = v_assigned_id AND status = 'Overdue'
        ) THEN
            UPDATE users SET penalty_box = false WHERE id = v_assigned_id;
            INSERT INTO audit_log (actor_id, event_type, entity_type, entity_id, metadata)
            VALUES (v_user_id, 'PENALTY_CLEARED', 'users', v_assigned_id, '{"reason": "Key returned"}'::jsonb);
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS for key_handoffs
CREATE POLICY "Keyholders and Admins can view key handoffs" ON key_handoffs
    FOR SELECT USING (
        (SELECT role FROM users WHERE id = auth.uid()) IN ('Keyholder', 'Superadmin')
    );
-- 003_penalty_box.sql

-- Function to check for overdue requests and penalize Keyholders
-- This should be run by pg_cron or an Edge Function frequently (e.g. every 5 minutes)
CREATE OR REPLACE FUNCTION check_overdue_requests()
RETURNS void
SET search_path = public
AS $$
DECLARE
    r RECORD;
    v_grace_period_mins INTEGER := 120; -- Configurable, e.g. 2 hours
BEGIN
    FOR r IN
        SELECT id, assigned_keyholder_id, estimated_end_time
        FROM requests
        WHERE status = 'Active' 
        AND estimated_end_time + (v_grace_period_mins || ' minutes')::interval < now()
    LOOP
        -- Mark request overdue
        UPDATE requests SET status = 'Overdue' WHERE id = r.id;
        
        -- Penalize Keyholder
        UPDATE users SET penalty_box = true WHERE id = r.assigned_keyholder_id;

        -- Record Penalty Event
        INSERT INTO penalty_events (keyholder_id, reason)
        VALUES (r.assigned_keyholder_id, 'Overdue key for request ' || r.id);

        -- Audit Log
        INSERT INTO audit_log (actor_id, event_type, entity_type, entity_id, metadata)
        VALUES (r.assigned_keyholder_id, 'PENALTY_TRIGGERED', 'users', r.assigned_keyholder_id, jsonb_build_object('request_id', r.id));
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC for Admin Override
CREATE OR REPLACE FUNCTION override_penalty(p_keyholder_id UUID, p_reason TEXT)
RETURNS void
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID := auth.uid();
BEGIN
    IF (SELECT role FROM users WHERE id = v_admin_id) != 'Superadmin' THEN
        RAISE EXCEPTION 'Only Superadmins can override penalties';
    END IF;

    IF trim(p_reason) = '' THEN
        RAISE EXCEPTION 'Override reason is mandatory';
    END IF;

    -- Clear penalty
    UPDATE users SET penalty_box = false WHERE id = p_keyholder_id;

    -- Update penalty event
    UPDATE penalty_events
    SET cleared_at = now(), clearing_admin_id = v_admin_id, reason = reason || ' | Override: ' || p_reason
    WHERE keyholder_id = p_keyholder_id AND cleared_at IS NULL;

    -- Audit Log
    INSERT INTO audit_log (actor_id, event_type, entity_type, entity_id, metadata)
    VALUES (v_admin_id, 'PENALTY_CLEARED_OVERRIDE', 'users', p_keyholder_id, jsonb_build_object('reason', p_reason));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS for penalty_events
CREATE POLICY "Users can view own penalty events" ON penalty_events
    FOR SELECT USING (auth.uid() = keyholder_id);

CREATE POLICY "Superadmins can view all penalty events" ON penalty_events
    FOR SELECT USING (
        (SELECT role FROM users WHERE id = auth.uid()) = 'Superadmin'
    );
-- 004_admin_functions.sql

-- RPC for Publishing a new Procedure Version
CREATE OR REPLACE FUNCTION publish_procedure_version(p_version_string TEXT, p_document_url TEXT, p_content TEXT)
RETURNS void
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_new_id UUID;
BEGIN
    IF (SELECT role FROM users WHERE id = v_admin_id) != 'Superadmin' THEN
        RAISE EXCEPTION 'Only Superadmins can publish procedures';
    END IF;

    -- Deactivate old versions
    UPDATE procedure_versions SET active = false WHERE active = true;

    -- Insert new version
    INSERT INTO procedure_versions (version_string, document_url, content, active)
    VALUES (p_version_string, p_document_url, p_content, true)
    RETURNING id INTO v_new_id;

    -- Force re-agreement for all Active users
    UPDATE users SET status = 'Requires_Reagreement' WHERE status = 'Active';

    -- Audit Log
    INSERT INTO audit_log (actor_id, event_type, entity_type, entity_id, metadata)
    VALUES (v_admin_id, 'PROCEDURE_PUBLISHED', 'procedure_versions', v_new_id, jsonb_build_object('version', p_version_string));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC for Bulk Role Reset (e.g. End of Year)
CREATE OR REPLACE FUNCTION bulk_role_reset(p_user_ids UUID[], p_new_role user_role)
RETURNS void
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID := auth.uid();
BEGIN
    IF (SELECT role FROM users WHERE id = v_admin_id) != 'Superadmin' THEN
        RAISE EXCEPTION 'Only Superadmins can reset roles';
    END IF;

    -- Update roles
    UPDATE users SET role = p_new_role WHERE id = ANY(p_user_ids);

    -- Audit Log
    INSERT INTO audit_log (actor_id, event_type, entity_type, entity_id, metadata)
    VALUES (v_admin_id, 'BULK_ROLE_RESET', 'users', v_admin_id, jsonb_build_object('user_count', array_length(p_user_ids, 1), 'new_role', p_new_role));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 005_inventory.sql

-- RLS for Inventory
CREATE POLICY "Anyone can view inventory" ON inventory_items
    FOR SELECT USING (true);

-- RLS for Inventory Events
CREATE POLICY "Keyholders and Admins can view inventory events" ON inventory_events
    FOR SELECT USING (
        (SELECT role FROM users WHERE id = auth.uid()) IN ('Keyholder', 'Superadmin')
    );

-- RPC for Checking Out Inventory
CREATE OR REPLACE FUNCTION checkout_inventory(p_item_id UUID, p_request_id UUID, p_quantity INTEGER)
RETURNS void
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_role user_role;
    v_current_qty INTEGER;
BEGIN
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity must be positive';
    END IF;

    SELECT role INTO v_role FROM users WHERE id = v_user_id;
    IF v_role NOT IN ('Keyholder', 'Superadmin') THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    SELECT quantity INTO v_current_qty FROM inventory_items WHERE id = p_item_id FOR UPDATE;

    IF v_current_qty < p_quantity THEN
        RAISE EXCEPTION 'Insufficient quantity available';
    END IF;

    UPDATE inventory_items
    SET quantity = quantity - p_quantity, status = CASE WHEN quantity - p_quantity = 0 THEN 'Checked Out' ELSE 'Available' END
    WHERE id = p_item_id;

    INSERT INTO inventory_events (item_id, request_id, event_type)
    VALUES (p_item_id, p_request_id, 'checkout');

    INSERT INTO audit_log (actor_id, event_type, entity_type, entity_id, metadata)
    VALUES (v_user_id, 'INVENTORY_CHECKOUT', 'inventory_items', p_item_id, jsonb_build_object('request_id', p_request_id, 'quantity', p_quantity));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC for Returning Inventory
CREATE OR REPLACE FUNCTION return_inventory(p_item_id UUID, p_request_id UUID, p_quantity INTEGER)
RETURNS void
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_role user_role;
BEGIN
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity must be positive';
    END IF;

    SELECT role INTO v_role FROM users WHERE id = v_user_id;
    IF v_role NOT IN ('Keyholder', 'Superadmin') THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    UPDATE inventory_items
    SET quantity = quantity + p_quantity, status = 'Available'
    WHERE id = p_item_id;

    INSERT INTO inventory_events (item_id, request_id, event_type)
    VALUES (p_item_id, p_request_id, 'return');

    INSERT INTO audit_log (actor_id, event_type, entity_type, entity_id, metadata)
    VALUES (v_user_id, 'INVENTORY_RETURN', 'inventory_items', p_item_id, jsonb_build_object('request_id', p_request_id, 'quantity', p_quantity));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC for Reporting Inventory Issue
CREATE OR REPLACE FUNCTION report_inventory_issue(p_item_id UUID, p_condition TEXT)
RETURNS void
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_role user_role;
BEGIN
    SELECT role INTO v_role FROM users WHERE id = v_user_id;
    IF v_role NOT IN ('Keyholder', 'Superadmin') THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    IF p_condition NOT IN ('Normal', 'Damaged', 'Missing', 'Needs Maintenance') THEN
        RAISE EXCEPTION 'Invalid condition';
    END IF;

    UPDATE inventory_items
    SET condition = p_condition, last_checked = now()
    WHERE id = p_item_id;

    INSERT INTO inventory_events (item_id, event_type)
    VALUES (p_item_id, p_condition);

    INSERT INTO audit_log (actor_id, event_type, entity_type, entity_id, metadata)
    VALUES (v_user_id, 'INVENTORY_ISSUE_REPORTED', 'inventory_items', p_item_id, jsonb_build_object('condition', p_condition));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 006_floor_allocations.sql

CREATE POLICY "Anyone can view floor allocations" ON floor_allocations
    FOR SELECT USING (true);

-- RPC to allocate floor
CREATE OR REPLACE FUNCTION allocate_floor(p_request_id UUID, p_zone TEXT, p_bench TEXT, p_start_time TIMESTAMP WITH TIME ZONE, p_end_time TIMESTAMP WITH TIME ZONE)
RETURNS void
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_role user_role;
    v_student_id UUID;
BEGIN
    SELECT role INTO v_role FROM users WHERE id = v_user_id;
    IF v_role NOT IN ('Keyholder', 'Superadmin') THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    -- Get student associated with request
    SELECT student_id INTO v_student_id FROM requests WHERE id = p_request_id;

    -- Prevent overlap
    -- Condition handles: specific bench overlap, or if either allocation is for the whole zone (bench IS NULL)
    IF EXISTS (
        SELECT 1 FROM floor_allocations
        WHERE zone = p_zone 
        AND (bench = p_bench OR bench IS NULL OR p_bench IS NULL)
        AND start_time < p_end_time AND end_time > p_start_time
    ) THEN
        RAISE EXCEPTION 'Floor allocation overlaps with an existing allocation';
    END IF;

    INSERT INTO floor_allocations (request_id, user_id, zone, bench, start_time, end_time)
    VALUES (p_request_id, v_student_id, p_zone, p_bench, p_start_time, p_end_time);

    INSERT INTO audit_log (actor_id, event_type, entity_type, entity_id, metadata)
    VALUES (v_user_id, 'FLOOR_ALLOCATED', 'floor_allocations', p_request_id, jsonb_build_object('zone', p_zone, 'bench', p_bench));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 007_project_repository.sql

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active',
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_urls TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view projects" ON projects
    FOR SELECT USING (true);

CREATE POLICY "Users can create projects" ON projects
    FOR INSERT WITH CHECK (
        auth.uid() = owner_id AND
        (SELECT status FROM users WHERE id = auth.uid()) = 'Active'
    );

CREATE POLICY "Superadmin can update projects" ON projects
    FOR UPDATE USING (
        (SELECT role FROM users WHERE id = auth.uid()) = 'Superadmin'
    );
-- 008_realtime_notifications.sql

-- Enable realtime for specified tables
-- This ensures Supabase Realtime picks up changes on these tables
ALTER PUBLICATION supabase_realtime ADD TABLE requests;
ALTER PUBLICATION supabase_realtime ADD TABLE inventory_items;
ALTER PUBLICATION supabase_realtime ADD TABLE floor_allocations;
ALTER PUBLICATION supabase_realtime ADD TABLE penalty_events;

-- Notifications Architecture
-- For true email delivery, Supabase Edge Functions + Database Webhooks are recommended.
-- We will create a notifications log table that a webhook could listen to.

CREATE TABLE notification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

-- Deny all direct access to the queue except by Postgres functions / superadmin
CREATE POLICY "Superadmin can manage notification queue" ON notification_queue
    FOR ALL USING ((SELECT role FROM users WHERE id = auth.uid()) = 'Superadmin');

-- Example trigger function to queue notification on new request
CREATE OR REPLACE FUNCTION notify_keyholders_on_request()
RETURNS trigger
SET search_path = public
AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT email FROM users WHERE role = 'Keyholder' AND penalty_box = false LOOP
        INSERT INTO notification_queue (recipient_email, subject, body)
        VALUES (r.email, 'New Makerspace Request: ' || NEW.title, 'A new request has been submitted and awaits claiming.');
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER queue_new_request_notification
AFTER INSERT ON requests
FOR EACH ROW EXECUTE PROCEDURE notify_keyholders_on_request();

-- 009_role_grants.sql

-- The Supabase API relies on the 'anon' and 'authenticated' roles having
-- base CRUD privileges on the tables. RLS policies then filter the rows.
-- Without these grants, the PostgREST API throws 42501 Permission Denied.

GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant access to all current tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;

-- Ensure future tables get the same grants automatically
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;


-- 010_fix_user_trigger.sql
-- Fixes missing email column in handle_new_user trigger

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, full_name, student_id, email)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'student_id',
    new.email
  );
  RETURN new;
END;
$$;


-- 011_frontend_integration.sql
-- Gaps found while connecting the React frontend to the backend.

-- 1. Requests need to say where the student wants to work (the form has a zone and optional bench).
ALTER TABLE requests
    ADD COLUMN IF NOT EXISTS preferred_zone TEXT,
    ADD COLUMN IF NOT EXISTS preferred_bench TEXT;

-- 2. Inventory condition vocabulary: the table defaults to 'Good' but report_inventory_issue only accepted 'Normal'.
CREATE OR REPLACE FUNCTION report_inventory_issue(p_item_id UUID, p_condition TEXT)
RETURNS void
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_role user_role;
BEGIN
    SELECT role INTO v_role FROM users WHERE id = v_user_id;

    IF v_role NOT IN ('Keyholder', 'Superadmin') THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    IF p_condition NOT IN ('Good', 'Normal', 'Damaged', 'Missing', 'Needs Maintenance') THEN
        RAISE EXCEPTION 'Invalid condition';
    END IF;

    UPDATE inventory_items
    SET condition = CASE WHEN p_condition = 'Normal' THEN 'Good' ELSE p_condition END,
        last_checked = now()
    WHERE id = p_item_id;

    INSERT INTO inventory_events (item_id, event_type)
    VALUES (p_item_id, p_condition);

    INSERT INTO audit_log (actor_id, event_type, entity_type, entity_id, metadata)
    VALUES (v_user_id, 'INVENTORY_ISSUE_REPORTED', 'inventory_items', p_item_id, jsonb_build_object('condition', p_condition));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Privacy: "Users can view all users" + `GRANT SELECT ON users TO anon` exposed every student's email and
--    student ID to anonymous visitors. Restrict it: you see yourself, staff (Keyholders/Superadmin) are visible to
--    members so request pages can show who claimed a request, and staff see everyone.
--    A SECURITY DEFINER helper avoids the "infinite recursion in policy" error a self-referencing policy would cause.
CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT role FROM public.users WHERE id = auth.uid() $$;

REVOKE ALL ON FUNCTION public.auth_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_role() TO authenticated;

REVOKE SELECT ON users FROM anon;

DROP POLICY IF EXISTS "Users can view all users" ON users;
CREATE POLICY "Users view self, staff and keyholders" ON users
    FOR SELECT TO authenticated
    USING (
        auth.uid() = id
        OR role IN ('Keyholder', 'Superadmin')
        OR public.auth_role() IN ('Keyholder', 'Superadmin')
    );

-- 4. Direct requests for the local dev loop: allow the overdue sweep to be run by Keyholders/Superadmin only.
CREATE OR REPLACE FUNCTION public.run_overdue_check()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF public.auth_role() NOT IN ('Keyholder', 'Superadmin') THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    PERFORM public.check_overdue_requests();
END;
$$;

REVOKE ALL ON FUNCTION public.run_overdue_check() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_overdue_check() TO authenticated;

-- 5. The admin panel lists every procedure version and how many signatures each has collected.
--    Existing policies only exposed the active version and each user's own signatures.
CREATE POLICY "Superadmin views all procedure versions" ON procedure_versions
    FOR SELECT TO authenticated
    USING (public.auth_role() = 'Superadmin');

CREATE POLICY "Superadmin views all signatures" ON liability_signatures
    FOR SELECT TO authenticated
    USING (public.auth_role() = 'Superadmin');

-- 6. NULL-safety in the request lifecycle functions.
--    `IF v_req_status != 'Pending'` is NULL (not true) when the request does not exist, so the checks were skipped and
--    the function carried on (writing audit rows / handoffs for ghost requests). Fail clearly instead.
CREATE OR REPLACE FUNCTION claim_request(p_request_id UUID)
RETURNS void
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_role user_role;
    v_penalty BOOLEAN;
    v_req_status request_status;
BEGIN
    SELECT role, penalty_box INTO v_role, v_penalty FROM users WHERE id = v_user_id;

    IF v_role IS NULL OR v_role NOT IN ('Keyholder', 'Superadmin') THEN
        RAISE EXCEPTION 'Only Keyholders or Superadmins can claim requests';
    END IF;

    IF v_penalty = true THEN
        RAISE EXCEPTION 'Keyholder is in the penalty box and cannot claim requests';
    END IF;

    SELECT status INTO v_req_status FROM requests WHERE id = p_request_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found';
    END IF;
    IF v_req_status IS DISTINCT FROM 'Pending' THEN
        RAISE EXCEPTION 'Request is not in Pending state';
    END IF;

    UPDATE requests
    SET status = 'Claimed', assigned_keyholder_id = v_user_id, claimed_at = now()
    WHERE id = p_request_id;

    INSERT INTO audit_log (actor_id, event_type, entity_type, entity_id, metadata)
    VALUES (v_user_id, 'REQUEST_CLAIMED', 'requests', p_request_id, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION retrieve_key(p_request_id UUID, p_officer_name TEXT)
RETURNS void
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_req_status request_status;
    v_assigned_id UUID;
    v_duration INTEGER;
BEGIN
    IF trim(coalesce(p_officer_name, '')) = '' THEN
        RAISE EXCEPTION 'Security officer name is required';
    END IF;

    SELECT status, assigned_keyholder_id, estimated_duration_mins
    INTO v_req_status, v_assigned_id, v_duration
    FROM requests WHERE id = p_request_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found';
    END IF;
    IF v_req_status IS DISTINCT FROM 'Claimed' THEN
        RAISE EXCEPTION 'Request must be Claimed to retrieve key';
    END IF;
    IF v_assigned_id IS DISTINCT FROM v_user_id THEN
        RAISE EXCEPTION 'Only the assigned Keyholder can retrieve the key';
    END IF;

    UPDATE requests
    SET status = 'Active', estimated_end_time = now() + (v_duration || ' minutes')::interval
    WHERE id = p_request_id;

    INSERT INTO key_handoffs (request_id, keyholder_id, retrieved_from_officer)
    VALUES (p_request_id, v_user_id, p_officer_name);

    INSERT INTO audit_log (actor_id, event_type, entity_type, entity_id, metadata)
    VALUES (v_user_id, 'KEY_RETRIEVED', 'requests', p_request_id, jsonb_build_object('officer', p_officer_name));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION return_key(p_request_id UUID, p_officer_name TEXT)
RETURNS void
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_req_status request_status;
    v_assigned_id UUID;
    v_handoff_id UUID;
    v_is_overdue BOOLEAN := false;
BEGIN
    IF trim(coalesce(p_officer_name, '')) = '' THEN
        RAISE EXCEPTION 'Security officer name is required';
    END IF;

    SELECT status, assigned_keyholder_id INTO v_req_status, v_assigned_id
    FROM requests WHERE id = p_request_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found';
    END IF;
    IF v_req_status IS NULL OR v_req_status NOT IN ('Active', 'Overdue') THEN
        RAISE EXCEPTION 'Key cannot be returned for this request state';
    END IF;
    IF v_assigned_id IS DISTINCT FROM v_user_id AND public.auth_role() IS DISTINCT FROM 'Superadmin' THEN
        RAISE EXCEPTION 'Only the assigned Keyholder or Superadmin can return the key';
    END IF;

    v_is_overdue := (v_req_status = 'Overdue');

    SELECT id INTO v_handoff_id FROM key_handoffs WHERE request_id = p_request_id AND returned_at IS NULL;
    IF v_handoff_id IS NULL THEN
        RAISE EXCEPTION 'No open key handoff for this request';
    END IF;

    UPDATE key_handoffs
    SET returned_at = now(), returned_to_officer = p_officer_name, was_overdue = v_is_overdue
    WHERE id = v_handoff_id;

    UPDATE requests SET status = 'Completed' WHERE id = p_request_id;

    INSERT INTO audit_log (actor_id, event_type, entity_type, entity_id, metadata)
    VALUES (v_user_id, 'KEY_RETURNED', 'requests', p_request_id, jsonb_build_object('officer', p_officer_name, 'was_overdue', v_is_overdue));

    IF v_is_overdue AND NOT EXISTS (
        SELECT 1 FROM requests WHERE assigned_keyholder_id = v_assigned_id AND status = 'Overdue'
    ) THEN
        UPDATE users SET penalty_box = false WHERE id = v_assigned_id;
        UPDATE penalty_events SET cleared_at = now() WHERE keyholder_id = v_assigned_id AND cleared_at IS NULL;
        INSERT INTO audit_log (actor_id, event_type, entity_type, entity_id, metadata)
        VALUES (v_user_id, 'PENALTY_CLEARED', 'users', v_assigned_id, '{"reason": "Key returned"}'::jsonb);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
