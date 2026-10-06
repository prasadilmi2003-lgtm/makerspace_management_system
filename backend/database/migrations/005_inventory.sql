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
