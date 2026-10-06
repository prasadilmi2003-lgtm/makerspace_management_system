// End-to-end check of the core flow against the LOCAL stack, as real signed-in users (same calls the UI makes).
//   npm run test:e2e   (resets the local DB first)
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'node:path';
import { DEV_PASSWORD } from './dev_config.mjs';

dotenv.config({ path: path.resolve(process.cwd(), '../frontend/.env.local'), quiet: true });
const URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!/127\.0\.0\.1|localhost/.test(URL || '')) throw new Error('e2e tests only run against the local stack');

const results = [];
const check = (name, ok, evidence = '') => { results.push({ name, ok, evidence }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${evidence ? '  — ' + evidence : ''}`); };
const rejects = async (name, promise, expect) => {
  const { data, error } = await promise;
  const ok = !!error && (!expect || expect.test(error.message));
  check(name, ok, error ? error.message.slice(0, 90) : `NOT rejected (${JSON.stringify(data)?.slice(0, 60)})`);
};
const as = async (email) => {
  const c = createClient(URL, KEY, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: DEV_PASSWORD });
  if (error) throw new Error(`${email}: ${error.message}`);
  return { c, id: data.user.id };
};

const anon = createClient(URL, KEY, { auth: { persistSession: false } });
const student = await as('shaminda@eng.ruh.ac.lk');
const other = await as('nadeesha@eng.ruh.ac.lk');
const kasun = await as('kasun@eng.ruh.ac.lk');
const ruwan = await as('ruwan@eng.ruh.ac.lk');
const admin = await as('admin@makerspace.ruh.ac.lk');

console.log('\n— Privacy / RLS —');
{
  const { data } = await anon.from('users').select('email').limit(5);
  check('anonymous visitors cannot read users', !data?.length, `rows: ${data?.length ?? 'denied'}`);
  const { data: seen } = await student.c.from('users').select('student_id, role');
  check('a student sees themselves + staff, not other students', seen.every((u) => u.student_id === 'EG/2022/5311' || ['Keyholder', 'Superadmin'].includes(u.role)), `${seen.length} rows`);
  const { data: staffSeen } = await kasun.c.from('users').select('id');
  check('a keyholder sees all users', staffSeen.length >= 8, `${staffSeen.length} rows`);
  const { data: theirs } = await student.c.from('requests').select('student_id');
  check("a student only sees their own requests", theirs.length > 0 && theirs.every((r) => r.student_id === student.id), `${theirs.length} rows`);
  await rejects('a student cannot promote themselves', student.c.from('users').update({ role: 'Superadmin' }).eq('id', student.id).select());
  const { data: still } = await admin.c.from('users').select('role').eq('id', student.id).single();
  check('…and their role is unchanged', still.role === 'User', still.role);
}

console.log('\n— Student: create + cancel —');
let reqId;
{
  const { data, error } = await student.c.from('requests').insert({ student_id: student.id, title: 'E2E test session', preferred_date: new Date(Date.now() + 864e5).toISOString().slice(0, 10), estimated_duration_mins: 60, preferred_zone: 'a', preferred_bench: 'A2' }).select().single();
  check('student creates a request (with zone + bench)', !error && data.status === 'Pending' && data.preferred_zone === 'a', error?.message || `${data.status}, zone ${data.preferred_zone}/${data.preferred_bench}`);
  reqId = data?.id;
  await rejects("a student cannot create a request for someone else", student.c.from('requests').insert({ student_id: other.id, title: 'forged', preferred_date: '2026-12-01', estimated_duration_mins: 60 }));
  const { data: cancelled } = await student.c.from('requests').update({ status: 'Cancelled' }).eq('id', reqId).eq('status', 'Pending').select();
  check('student can cancel their own pending request', cancelled?.length === 1);
  const { data: again } = await student.c.from('requests').insert({ student_id: student.id, title: 'E2E lifecycle', preferred_date: new Date(Date.now() + 864e5).toISOString().slice(0, 10), estimated_duration_mins: 60 }).select().single();
  reqId = again.id;
}

console.log('\n— Keyholder lifecycle —');
{
  await rejects('a student cannot claim', student.c.rpc('claim_request', { p_request_id: reqId }), /Only Keyholders/);
  await rejects('claiming a non-existent request fails cleanly', kasun.c.rpc('claim_request', { p_request_id: '00000000-0000-0000-0000-000000000000' }), /not found/i);
  await rejects('a keyholder in the penalty box cannot claim', ruwan.c.rpc('claim_request', { p_request_id: reqId }), /penalty box/);
  const { data: pend } = await kasun.c.from('requests').select('id').eq('status', 'Pending');
  check('keyholder sees pending requests', pend.some((r) => r.id === reqId), `${pend.length} pending`);

  const claim = await kasun.c.rpc('claim_request', { p_request_id: reqId });
  check('keyholder claims the request', !claim.error, claim.error?.message);
  await rejects('a second claim is rejected', kasun.c.rpc('claim_request', { p_request_id: reqId }), /not in Pending/);
  await rejects('another keyholder cannot retrieve the key', ruwan.c.rpc('retrieve_key', { p_request_id: reqId, p_officer_name: 'Sgt. X' }), /assigned Keyholder/);
  await rejects('retrieving the key needs an officer name', kasun.c.rpc('retrieve_key', { p_request_id: reqId, p_officer_name: '  ' }), /officer name/i);
  const ret = await kasun.c.rpc('retrieve_key', { p_request_id: reqId, p_officer_name: 'Sgt. Ranasinghe' });
  check('assigned keyholder retrieves the key', !ret.error, ret.error?.message);
  const { data: row } = await student.c.from('requests').select('status, estimated_end_time, keeper:users!assigned_keyholder_id(full_name)').eq('id', reqId).single();
  check('student sees Active + keyholder name + estimated end', row.status === 'Active' && !!row.estimated_end_time && row.keeper?.full_name === 'Kasun Jayawardena', `${row.status}, ${row.keeper?.full_name}`);
  const back = await kasun.c.rpc('return_key', { p_request_id: reqId, p_officer_name: 'Sgt. Pathirana' });
  check('keyholder returns the key', !back.error, back.error?.message);
  const { data: done } = await student.c.from('requests').select('status').eq('id', reqId).single();
  check('request is Completed', done.status === 'Completed', done.status);
  await rejects('returning twice is rejected', kasun.c.rpc('return_key', { p_request_id: reqId, p_officer_name: 'Sgt. Pathirana' }), /cannot be returned/);
}

console.log('\n— Overdue + penalty box —');
{
  const { data: sweep } = await kasun.c.rpc('run_overdue_check');
  check('overdue sweep runs for keyholders', sweep === null);
  await rejects('a student cannot run the overdue sweep', student.c.rpc('run_overdue_check'), /Not authorized/);
  const { data: ov } = await ruwan.c.from('requests').select('id, status').eq('status', 'Overdue');
  check("keyholder sees their overdue request", ov.length === 1, `${ov.length}`);
  const { data: me } = await ruwan.c.from('users').select('penalty_box').eq('id', ruwan.id).single();
  check('penalty box is on', me.penalty_box === true);
  const fix = await ruwan.c.rpc('return_key', { p_request_id: ov[0].id, p_officer_name: 'Sgt. Silva' });
  check('returning the overdue key succeeds', !fix.error, fix.error?.message);
  const { data: after } = await ruwan.c.from('users').select('penalty_box').eq('id', ruwan.id).single();
  check('penalty box clears automatically', after.penalty_box === false);
  const { data: events } = await admin.c.from('penalty_events').select('cleared_at').eq('keyholder_id', ruwan.id);
  check('penalty event is closed', events.every((e) => e.cleared_at), `${events.length} event(s)`);
}

console.log('\n— Inventory —');
{
  const { data: items } = await student.c.from('inventory_items').select('id, condition').limit(1);
  const item = items[0];
  await rejects('a student cannot flag inventory', student.c.rpc('report_inventory_issue', { p_item_id: item.id, p_condition: 'Damaged' }), /Not authorized/);
  const flag = await kasun.c.rpc('report_inventory_issue', { p_item_id: item.id, p_condition: 'Damaged' });
  check('keyholder flags an item as Damaged', !flag.error, flag.error?.message);
  const clear = await kasun.c.rpc('report_inventory_issue', { p_item_id: item.id, p_condition: 'Good' });
  check("…and clears it with 'Good'", !clear.error, clear.error?.message);
}

console.log('\n— Admin + re-agreement —');
{
  await rejects('a keyholder cannot publish a procedure', kasun.c.rpc('publish_procedure_version', { p_version_string: 'v9.9', p_document_url: 'x', p_content: 'x' }), /Only Superadmins/);
  const pub = await admin.c.rpc('publish_procedure_version', { p_version_string: 'v9.0', p_document_url: 'procedures/v9.0.pdf', p_content: 'E2E change' });
  check('superadmin publishes v9.0', !pub.error, pub.error?.message);
  const { data: procs } = await admin.c.from('procedure_versions').select('version_string, active');
  check('admin sees all versions, one active', procs.length >= 2 && procs.filter((p) => p.active).length === 1, procs.map((p) => p.version_string + (p.active ? '*' : '')).join(','));
  const { data: s } = await student.c.from('users').select('status').eq('id', student.id).single();
  check('active users are flagged Requires_Reagreement', s.status === 'Requires_Reagreement', s.status);
  const { data: active } = await student.c.from('procedure_versions').select('id').eq('active', true).single();
  await rejects('signing with the wrong name is rejected', student.c.rpc('sign_liability', { p_procedure_version_id: active.id, p_signed_name: 'Someone Else', p_signed_student_id: 'EG/2022/5311', p_ip_address: null }), /does not match/);
  const sign = await student.c.rpc('sign_liability', { p_procedure_version_id: active.id, p_signed_name: 'Shaminda Perera', p_signed_student_id: 'EG/2022/5311', p_ip_address: null });
  check('student re-signs and is Active again', !sign.error, sign.error?.message);
  const { data: s2 } = await student.c.from('users').select('status').eq('id', student.id).single();
  check('status is Active after re-signing', s2.status === 'Active');
  await rejects('signatures are immutable', admin.c.from('liability_signatures').update({ signed_name: 'x' }).neq('id', '00000000-0000-0000-0000-000000000000'));
  const { data: audit } = await admin.c.from('audit_log').select('event_type').order('created_at', { ascending: false }).limit(40);
  const seen = new Set(audit.map((a) => a.event_type));
  check('audit log recorded the whole flow', ['REQUEST_CLAIMED', 'KEY_RETRIEVED', 'KEY_RETURNED', 'PROCEDURE_PUBLISHED', 'SIGNATURE_CAPTURED', 'PENALTY_CLEARED'].every((e) => seen.has(e)), [...seen].join(','));
  const { data: aStud } = await student.c.from('audit_log').select('id').limit(1);
  check('a student cannot read the audit log', !aStud?.length);
  const role = await admin.c.rpc('bulk_role_reset', { p_user_ids: [other.id], p_new_role: 'Alumni' });
  check('superadmin changes a role', !role.error, role.error?.message);
  await admin.c.rpc('bulk_role_reset', { p_user_ids: [other.id], p_new_role: 'User' });
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
