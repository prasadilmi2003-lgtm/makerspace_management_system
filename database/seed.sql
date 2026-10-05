-- Seed data for testing / local development

-- Procedure Versions
INSERT INTO procedure_versions (id, version_string, document_url, content, active)
VALUES (
    uuid_generate_v4(),
    'v1.0',
    'procedures/v1.0.pdf',
    '# Makerspace Operational Procedures
1. Safety glasses are required at all times.
2. Ensure equipment is turned off after use.
3. Clean your workstation before leaving.',
    true
);

-- Inventory Items
INSERT INTO inventory_items (id, name, description, category, quantity, available_quantity)
VALUES 
    (uuid_generate_v4(), 'Soldering Iron (Weller)', 'Temperature controlled soldering iron', 'Electronics', 5, 5),
    (uuid_generate_v4(), 'Digital Multimeter (Fluke)', 'Standard auto-ranging multimeter', 'Electronics', 10, 10),
    (uuid_generate_v4(), 'Prusa i3 MK3S+', 'FDM 3D Printer', '3D Printing', 2, 2),
    (uuid_generate_v4(), 'Arduino Uno R3', 'Microcontroller board', 'Components', 20, 20),
    (uuid_generate_v4(), 'Cordless Drill (DeWalt)', '20V Max cordless drill', 'Tools', 3, 3);

-- Projects (Anonymous/Dummy owner for demo, note that RLS usually requires a valid user ID, 
-- but running as postgres superuser bypasses RLS for seeding)
-- Note: Skipping projects here to avoid foreign key violations with auth.users if the users don't exist yet.
