-- 009_role_grants.sql
GRANT USAGE ON SCHEMA public TO anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
GRANT SELECT ON users TO anon;
GRANT SELECT ON procedure_versions TO anon;
GRANT SELECT ON requests TO anon;
GRANT SELECT ON inventory_items TO anon;
GRANT SELECT ON floor_allocations TO anon;
GRANT SELECT ON projects TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT UPDATE ON users TO authenticated;
GRANT INSERT, UPDATE ON requests TO authenticated;
GRANT INSERT, UPDATE ON projects TO authenticated;
