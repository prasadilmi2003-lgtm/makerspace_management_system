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
