// Verifies the admin account created by backend/database/production_accounts.sql (run against the LOCAL stack).
//   The local stack must contain it, created with DEV_PASSWORD (see scripts/dev_config.mjs).
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'node:path';
import { DEV_PASSWORD } from './dev_config.mjs';

dotenv.config({ path: path.resolve(process.cwd(), '../frontend/.env.local'), quiet: true });
const URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!/127\.0\.0\.1|localhost/.test(URL || '')) throw new Error('local stack only');

let failed = 0;
const check = (name, ok, ev = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ev ? '  — ' + ev : ''}`); };

const c = createClient(URL, KEY, { auth: { persistSession: false } });
const { data, error } = await c.auth.signInWithPassword({ email: 'admin@makerspace.ruh.ac.lk', password: DEV_PASSWORD });
check('admin can log in', !error && !!data?.user, error?.message || 'admin@makerspace.ruh.ac.lk');
if (error) process.exit(1);

const { data: me } = await c.from('users').select('role, status, student_id').eq('id', data.user.id).single();
check('profile is Superadmin / Active', me?.role === 'Superadmin' && me?.status === 'Active', `${me?.role} / ${me?.status} / ${me?.student_id}`);

const { data: users } = await c.from('users').select('id');
check('can list users', users?.length === 1, `${users?.length} user(s)`);
const { data: audit } = await c.from('audit_log').select('event_type').eq('event_type', 'ACCOUNT_CREATED');
check('audit log shows ACCOUNT_CREATED', audit?.length === 1, `${audit?.length}`);
const { data: sig } = await c.from('liability_signatures').select('id').eq('user_id', data.user.id);
check('liability agreement is on record', sig?.length === 1);

const pub = await c.rpc('publish_procedure_version', { p_version_string: 'v-check', p_document_url: 'x', p_content: 'x' });
check('can publish a procedure (admin power)', !pub.error, pub.error?.message);
const { data: me2 } = await c.from('users').select('status').eq('id', data.user.id).single();
check('publishing flags the admin for re-agreement (expected behaviour)', me2?.status === 'Requires_Reagreement', me2?.status);

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll admin checks passed');
process.exit(failed ? 1 : 0);
