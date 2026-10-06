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
