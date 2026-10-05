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
