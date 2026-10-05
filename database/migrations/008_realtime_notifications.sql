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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
