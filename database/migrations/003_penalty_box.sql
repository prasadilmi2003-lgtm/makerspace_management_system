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
