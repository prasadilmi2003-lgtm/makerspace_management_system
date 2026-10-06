import { supabase } from './supabase';

/**
 * Real backend implementation of the app's data interface (the demo implementation lives in demoApi.js).
 * Every method returns a Promise and throws an Error whose message is safe to show to users.
 */

export const STAGE_OF = {
  Pending: 'pending', Claimed: 'claimed', Key_Retrieved: 'key_retrieved', Active: 'active', Overdue: 'active',
  Completed: 'completed', Cancelled: 'cancelled',
};

export const DURATION_MINS = { '1 hour': 60, '2 hours': 120, '3 hours': 180, '4 hours': 240, 'Half day': 240, 'Full day': 480 };

/** Map Postgres/PostgREST errors to the messages the integration guide asks for. */
export const friendly = (err) => {
  if (!err) return 'Something went wrong.';
  const code = err.code || '';
  if (code === '42501') return 'You do not have permission to view or modify this resource.';
  if (code === '42P01' || code === 'PGRST205') return 'Service temporarily unavailable (schema sync). Please try again shortly.';
  if (code === 'P0001') return err.message; // raised by our RPCs on purpose, safe to show
  if (err.status === 429 || /rate limit/i.test(err.message || '')) return 'Too many attempts. Please wait a while and try again.';
  if (/Failed to fetch|NetworkError/i.test(err.message || '')) return 'Cannot reach the server. Check your connection and try again.';
  if (/violates row-level security/i.test(err.message || '')) return 'You do not have permission to do that right now.';
  return err.message || 'Something went wrong.';
};

const run = async (promise) => {
  const { data, error } = await promise;
  if (error) throw Object.assign(new Error(friendly(error)), { cause: error });
  return data;
};

const REQUEST_SELECT = '*, student:users!student_id(full_name, student_id), keeper:users!assigned_keyholder_id(full_name)';

export const toRequest = (r) => ({
  id: r.id,
  title: r.title,
  description: r.description || '',
  date: r.preferred_date,
  durationMins: r.estimated_duration_mins,
  status: r.status,
  stage: STAGE_OF[r.status] || 'pending',
  overdue: r.status === 'Overdue',
  studentId: r.student_id,
  studentName: r.student?.full_name || 'Unknown student',
  studentNo: r.student?.student_id || '',
  keyholderId: r.assigned_keyholder_id,
  keyholderName: r.keeper?.full_name || null,
  zoneId: r.preferred_zone || null,
  bench: r.preferred_bench || null,
  estimatedEnd: r.estimated_end_time,
  claimedAt: r.claimed_at,
  createdAt: r.created_at,
});

const summarise = (event, m = {}) => {
  const bits = [];
  if (m.officer) bits.push(`Officer: ${m.officer}`);
  if (m.reason) bits.push(String(m.reason));
  if (m.version) bits.push(`Procedure ${m.version}`);
  if (m.new_role) bits.push(`New role: ${m.new_role}`);
  if (m.user_count != null) bits.push(`${m.user_count} users`);
  if (m.zone) bits.push(`${m.zone}${m.bench ? ' / ' + m.bench : ''}`);
  if (m.condition) bits.push(m.condition);
  if (m.ip) bits.push(`IP ${m.ip}`);
  if (m.was_overdue) bits.push('Returned late');
  return bits.join(' · ') || event.replace(/_/g, ' ').toLowerCase();
};

export function createSupabaseApi(profile) {
  const me = profile?.id;
  const open = ['Claimed', 'Active', 'Overdue'];

  return {
    live: true,

    /* ---------- requests ---------- */
    async listMyRequests() {
      const rows = await run(supabase.from('requests').select(REQUEST_SELECT).eq('student_id', me).order('created_at', { ascending: false }));
      return rows.map(toRequest);
    },
    async createRequest({ title, description, date, duration, zoneId, bench }) {
      await run(supabase.from('requests').insert({
        student_id: me, title, description: description || null, preferred_date: date,
        estimated_duration_mins: DURATION_MINS[duration] || 180, preferred_zone: zoneId || null, preferred_bench: bench || null,
      }));
    },
    async cancelRequest(id) {
      // Owners may cancel their own request while it is still Pending (RLS policy from migration 001).
      await run(supabase.from('requests').update({ status: 'Cancelled' }).eq('id', id).eq('status', 'Pending'));
    },
    async listPending() {
      const rows = await run(supabase.from('requests').select(REQUEST_SELECT).eq('status', 'Pending').order('created_at', { ascending: true }));
      return rows.map(toRequest);
    },
    async listAssigned() {
      const rows = await run(supabase.from('requests').select(REQUEST_SELECT).eq('assigned_keyholder_id', me).in('status', open).order('claimed_at', { ascending: true }));
      return rows.map(toRequest);
    },
    async listOverdue() {
      // A Keyholder sees their own overdue keys; the Superadmin sees everyone's.
      let q = supabase.from('requests').select(REQUEST_SELECT).eq('status', 'Overdue');
      if (profile?.role !== 'Superadmin') q = q.eq('assigned_keyholder_id', me);
      return (await run(q.order('estimated_end_time'))).map(toRequest);
    },
    async completedCount() {
      const { count, error } = await supabase.from('requests').select('*', { count: 'exact', head: true }).eq('assigned_keyholder_id', me).eq('status', 'Completed');
      if (error) throw new Error(friendly(error));
      return count || 0;
    },
    async claim(id) { await run(supabase.rpc('claim_request', { p_request_id: id })); },
    async retrieveKey(id, officer) { await run(supabase.rpc('retrieve_key', { p_request_id: id, p_officer_name: officer })); },
    async returnKey(id, officer) { await run(supabase.rpc('return_key', { p_request_id: id, p_officer_name: officer })); },
    async myPenalty() {
      const row = await run(supabase.from('users').select('penalty_box').eq('id', me).single());
      return !!row.penalty_box;
    },
    async runOverdueCheck() { await run(supabase.rpc('run_overdue_check')); },

    /* ---------- inventory ---------- */
    async listInventory() {
      const rows = await run(supabase.from('inventory_items').select('*').order('name'));
      return rows.map((i) => ({ id: i.id, name: i.name, cat: i.category || '—', qty: i.quantity, cond: i.condition, status: i.status, checked: new Date(i.last_checked).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) }));
    },
    async setCondition(id, condition) { await run(supabase.rpc('report_inventory_issue', { p_item_id: id, p_condition: condition })); },

    /* ---------- admin ---------- */
    async listUsers() {
      const rows = await run(supabase.from('users').select('id, full_name, student_id, email, role, status, penalty_box, created_at, liability_signatures(agreed_at, procedure_versions(version_string))').order('created_at'));
      return rows.map((u) => {
        const sigs = [...(u.liability_signatures || [])].sort((a, b) => (a.agreed_at < b.agreed_at ? 1 : -1));
        return { id: u.id, name: u.full_name, sid: u.student_id, email: u.email, role: u.role, status: u.penalty_box ? 'Penalty' : u.status, sig: sigs[0]?.procedure_versions?.version_string || '—' };
      });
    },
    async setRole(userId, role) { await run(supabase.rpc('bulk_role_reset', { p_user_ids: [userId], p_new_role: role })); },
    async resetKeyholders() {
      const rows = await run(supabase.from('users').select('id').eq('role', 'Keyholder'));
      if (rows.length) await run(supabase.rpc('bulk_role_reset', { p_user_ids: rows.map((r) => r.id), p_new_role: 'User' }));
      return rows.length;
    },
    async listAudit() {
      const rows = await run(supabase.from('audit_log').select('*, actor:users!actor_id(full_name)').order('created_at', { ascending: false }).limit(200));
      return rows.map((a) => ({
        id: a.id, ts: new Date(a.created_at).toISOString().replace('T', ' ').slice(0, 19), event: a.event_type, actor: a.actor?.full_name || 'System',
        entity: `${a.entity_type}/${String(a.entity_id).slice(0, 8)}…`, detail: summarise(a.event_type, a.metadata || {}),
      }));
    },
    async listProcedures() {
      const rows = await run(supabase.from('procedure_versions').select('id, version_string, active, created_at, liability_signatures(count)').order('created_at', { ascending: false }));
      return rows.map((p) => ({ v: p.version_string.replace(/^v/i, ''), date: new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), sigs: p.liability_signatures?.[0]?.count || 0, current: p.active }));
    },
    async publishProcedure({ version, summary }) {
      const v = version.startsWith('v') ? version : `v${version}`;
      await run(supabase.rpc('publish_procedure_version', { p_version_string: v, p_document_url: `procedures/${v}.pdf`, p_content: summary || '' }));
    },
    async adminStats() {
      const count = async (q) => { const { count, error } = await q; if (error) throw new Error(friendly(error)); return count || 0; };
      const [projects, members, requests] = await Promise.all([
        count(supabase.from('projects').select('*', { count: 'exact', head: true })),
        count(supabase.from('users').select('*', { count: 'exact', head: true }).eq('status', 'Active')),
        count(supabase.from('requests').select('*', { count: 'exact', head: true })),
      ]);
      return { projects, members, requests };
    },
    async overridePenalty(keyholderId, reason) { await run(supabase.rpc('override_penalty', { p_keyholder_id: keyholderId, p_reason: reason })); },

    /* ---------- realtime ---------- */
    subscribe(cb) {
      const channel = supabase
        .channel(`mk-${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, cb)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, cb)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'penalty_events' }, cb)
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    },
  };
}
