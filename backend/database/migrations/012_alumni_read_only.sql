-- 012_alumni_read_only.sql
-- The spec says Alumni have read-only access to the archive and "cannot submit new requests".
-- The original insert policy only checked that the account was Active, so an Active Alumni could still create requests.
-- Restrict request creation to the roles that run sessions.

DROP POLICY IF EXISTS "Users can insert own requests" ON requests;

CREATE POLICY "Members can insert own requests" ON requests
    FOR INSERT WITH CHECK (
        auth.uid() = student_id AND
        public.auth_role() IN ('User', 'Keyholder', 'Superadmin') AND
        (SELECT status FROM users WHERE id = auth.uid()) = 'Active'
    );
