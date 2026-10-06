// Creates local development accounts (one per role) and sample requests against the LOCAL Supabase stack.
//   npm run db:start && npm run db:seed-users
// Refuses to run against anything that is not localhost. Safe to re-run: existing accounts are reused.
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEV_PASSWORD } from './dev_config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'supabase.cmd' : 'supabase');

const status = JSON.parse(execSync(`"${bin}" status -o json`, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
const url = status.API_URL;
const serviceKey = status.SERVICE_ROLE_KEY;
const anonKey = status.ANON_KEY;
if (!/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) throw new Error(`Refusing to seed non-local API: ${url}`);

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });


const PEOPLE = [
  { key: 'admin', email: 'admin@makerspace.ruh.ac.lk', name: 'Superadmin Founder', sid: 'STAFF/2020/001', role: 'Superadmin', status: 'Active' },
  { key: 'kasun', email: 'kasun@eng.ruh.ac.lk', name: 'Kasun Jayawardena', sid: 'EG/2021/2201', role: 'Keyholder', status: 'Active' },
  { key: 'sachini', email: 'sachini@eng.ruh.ac.lk', name: 'Sachini Senanayake', sid: 'EG/2022/5500', role: 'Keyholder', status: 'Active' },
  { key: 'ruwan', email: 'ruwan@eng.ruh.ac.lk', name: 'Ruwan Wijesekara', sid: 'EG/2022/4410', role: 'Keyholder', status: 'Active', penalty: true },
  { key: 'shaminda', email: 'shaminda@eng.ruh.ac.lk', name: 'Shaminda Perera', sid: 'EG/2022/5311', role: 'User', status: 'Active' },
  { key: 'nadeesha', email: 'nadeesha@eng.ruh.ac.lk', name: 'Nadeesha Fernando', sid: 'EG/2021/3892', role: 'User', status: 'Active' },
  { key: 'tharaka', email: 'tharaka@eng.ruh.ac.lk', name: 'Tharaka Dissanayake', sid: 'EG/2023/1047', role: 'User', status: 'Active' },
  { key: 'imesha', email: 'imesha@eng.ruh.ac.lk', name: 'Imesha Rathnayake', sid: 'EG/2023/2267', role: 'Pending', status: 'Pending_Signature' },
];

const ids = {};
for (const p of PEOPLE) {
  const { data, error } = await admin.auth.admin.createUser({
    email: p.email, password: DEV_PASSWORD, email_confirm: true,
    user_metadata: { full_name: p.name, student_id: p.sid, department: 'Mechanical & Manufacturing Engineering', academic_year: '2022' },
  });
  if (error && !/already|registered/i.test(error.message)) throw new Error(`${p.email}: ${error.message}`);
  let id = data?.user?.id;
  if (!id) {
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    id = list.users.find((u) => u.email === p.email)?.id;
  }
  ids[p.key] = id;
  const { error: uErr } = await admin.from('users').update({ role: p.role, status: p.status, penalty_box: !!p.penalty }).eq('id', id);
  if (uErr) throw new Error(`profile ${p.email}: ${uErr.message}`);
}

// Signatures for everyone who is Active, against the active procedure.
const { data: proc } = await admin.from('procedure_versions').select('id').eq('active', true).single();
for (const p of PEOPLE.filter((x) => x.status === 'Active')) {
  const { data: have } = await admin.from('liability_signatures').select('id').eq('user_id', ids[p.key]).limit(1);
  if (!have?.length) {
    await admin.from('liability_signatures').insert({ user_id: ids[p.key], procedure_version_id: proc.id, signed_name: p.name, signed_student_id: p.sid, ip_address: '127.0.0.1' });
  }
}

// Sample requests (only on a fresh database)
const { count } = await admin.from('requests').select('*', { count: 'exact', head: true });
if (!count) {
  const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const mk = async (row) => (await admin.from('requests').insert(row).select('id').single()).data.id;

  const active = await mk({ student_id: ids.shaminda, title: 'Formula Student Chassis Welding — Session 3', preferred_date: day(0), estimated_duration_mins: 240, status: 'Active', assigned_keyholder_id: ids.kasun, claimed_at: new Date().toISOString(), estimated_end_time: new Date(Date.now() + 3 * 36e5).toISOString(), preferred_zone: 'a', preferred_bench: 'A1' });
  await admin.from('key_handoffs').insert({ request_id: active, keyholder_id: ids.kasun, retrieved_from_officer: 'Sgt. Ranasinghe' });
  await mk({ student_id: ids.shaminda, title: 'PCB Etching — MPPT Controller Rev 2', description: 'Etch tank, drill press and soldering station. Chemicals pre-approved.', preferred_date: day(1), estimated_duration_mins: 180, preferred_zone: 'b' });
  await mk({ student_id: ids.nadeesha, title: 'Final Year Project — Composite Layup', description: 'Wet layup for CFRP panels. Needs PPE and ventilation.', preferred_date: day(2), estimated_duration_mins: 300, preferred_zone: 'e' });
  await mk({ student_id: ids.tharaka, title: 'Robotics Club — Servo Mount Machining', description: 'CNC milling aluminium brackets. G-code verified.', preferred_date: day(2), estimated_duration_mins: 120, preferred_zone: 'd' });
  const done = await mk({ student_id: ids.shaminda, title: 'Robotic Arm — Final Assembly & Test', preferred_date: day(-3), estimated_duration_mins: 270, status: 'Completed', assigned_keyholder_id: ids.sachini, claimed_at: new Date(Date.now() - 3 * 864e5).toISOString(), preferred_zone: 'e' });
  await admin.from('key_handoffs').insert({ request_id: done, keyholder_id: ids.sachini, retrieved_from_officer: 'Sgt. Pathirana', returned_at: new Date(Date.now() - 3 * 864e5 + 4.5 * 36e5).toISOString(), returned_to_officer: 'Sgt. Pathirana' });

  // Ruwan is in the penalty box with an overdue key
  const overdue = await mk({ student_id: ids.tharaka, title: 'Motor Controller Testing — Session 2', preferred_date: day(-1), estimated_duration_mins: 120, status: 'Overdue', assigned_keyholder_id: ids.ruwan, claimed_at: new Date(Date.now() - 30 * 36e5).toISOString(), estimated_end_time: new Date(Date.now() - 6 * 36e5).toISOString(), preferred_zone: 'b' });
  await admin.from('key_handoffs').insert({ request_id: overdue, keyholder_id: ids.ruwan, retrieved_from_officer: 'Sgt. Silva' });
  await admin.from('penalty_events').insert({ keyholder_id: ids.ruwan, reason: `Overdue key for request ${overdue}` });
}

// Projects (same list the public repository page shows), spread across a few members
const { count: projectCount } = await admin.from('projects').select('*', { count: 'exact', head: true });
if (!projectCount) {
  const { PROJECTS } = await import('../../frontend/src/data/mock.js');
  const owners = [ids.shaminda, ids.nadeesha, ids.tharaka, ids.kasun];
  const { error: pErr } = await admin.from('projects').insert(PROJECTS.map((p, i) => ({
    title: p.title, description: p.desc, category: p.cat, status: p.status, owner_id: owners[i % owners.length],
    created_at: new Date().toISOString(),
  })));
  if (pErr) throw new Error('projects: ' + pErr.message);
}

// Make sure a frontend env file exists for the local stack (never overwrites an existing one).
const envFile = path.join(root, '..', 'frontend', '.env.local');
if (!fs.existsSync(envFile)) {
  fs.writeFileSync(envFile, `VITE_SUPABASE_URL=${url}\nVITE_SUPABASE_PUBLISHABLE_KEY=${anonKey}\n`);
  console.log('Wrote frontend/.env.local for the local stack.');
}

console.log(`Seeded ${PEOPLE.length} dev accounts. Emails: ${PEOPLE.map((p) => p.email).join(', ')}`);
console.log('Password for all of them is DEV_PASSWORD in scripts/dev_config.mjs (local database only).');
