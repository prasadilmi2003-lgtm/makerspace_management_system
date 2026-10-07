-- 007_project_repository.sql

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active',
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_urls TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view projects" ON projects
    FOR SELECT USING (true);

CREATE POLICY "Users can create projects" ON projects
    FOR INSERT WITH CHECK (
        auth.uid() = owner_id AND
        (SELECT status FROM users WHERE id = auth.uid()) = 'Active'
    );

CREATE POLICY "Superadmin can update projects" ON projects
    FOR UPDATE USING (
        (SELECT role FROM users WHERE id = auth.uid()) = 'Superadmin'
    );
