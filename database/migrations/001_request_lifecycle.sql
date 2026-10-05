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
