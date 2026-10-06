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
