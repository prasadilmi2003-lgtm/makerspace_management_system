// Copies database/migrations/*.sql into supabase/migrations/ using the timestamped names the Supabase CLI expects,
// and database/seed.sql into supabase/seed.sql. database/ stays the single source of truth; supabase/migrations is generated.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'database', 'migrations');
const dst = path.join(root, 'supabase', 'migrations');

fs.mkdirSync(dst, { recursive: true });
for (const f of fs.readdirSync(dst)) if (f.endsWith('.sql')) fs.rmSync(path.join(dst, f));

const files = fs.readdirSync(src).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
files.forEach((f, i) => {
  const name = f.replace(/^\d+_/, '');
  // 2026-01-01 00:00:NN keeps strict ordering and sits before any hand-made migration made later
  const stamp = `20260101000${String(i).padStart(3, '0')}`;
  const body = fs.readFileSync(path.join(src, f), 'utf8');
  if (body.includes('\u0000')) throw new Error(`${f} contains NUL bytes (UTF-16?). Re-save it as UTF-8.`);
  fs.writeFileSync(path.join(dst, `${stamp}_${name}`), body);
});

const seed = path.join(root, 'database', 'seed.sql');
if (fs.existsSync(seed)) fs.copyFileSync(seed, path.join(root, 'supabase', 'seed.sql'));

console.log(`Synced ${files.length} migrations -> supabase/migrations`);
