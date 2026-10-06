import { DURATION_MINS, STAGE_OF } from './api';
import { INVENTORY_SEED, PROCEDURE_SEED } from '../data/mock';

/**
 * In-memory implementation of the same data interface as api.js, used in UI preview mode (no Supabase configured).
 * It follows the same rules as the SQL functions (claim only when Pending, key return by the assigned Keyholder, etc.)
 * so the demo behaves like the real thing. State lives for the page session and is shared across demo personas.
 */

const iso = (ms) => new Date(Date.now() + ms).toISOString();
const day = (n) => iso(n * 864e5).slice(0, 10);
const H = 36e5;

const mkReq = (r) => ({ description: '', durationMins: 180, estimatedEnd: null, claimedAt: null, createdAt: iso(-2 * H), keyholderId: null, keyholderName: null, bench: null, ...r, stage: STAGE_OF[r.status], overdue: r.status === 'Overdue' });

const store = {
  requests: [
    mkReq({ id: 'req-001', title: 'Formula Student Chassis Welding — Session 3', studentId: 'usr-student-001', studentName: 'Shaminda Perera', studentNo: 'EG/2022/5311', status: 'Active', keyholderId: 'usr-kh-004', keyholderName: 'Kasun Jayawardena', zoneId: 'a', bench: 'A1', date: day(0), durationMins: 240, estimatedEnd: iso(3 * H) }),
    mkReq({ id: 'req-002', title: 'PCB Etching — MPPT Controller Rev 2', description: 'Etch tank, drill press and soldering station. All chemicals pre-approved.', studentId: 'usr-student-001', studentName: 'Shaminda Perera', studentNo: 'EG/2022/5311', status: 'Pending', zoneId: 'b', date: day(1), createdAt: iso(-1 * H) }),
    mkReq({ id: 'req-003', title: 'Robotic Arm — Final Assembly & Test', studentId: 'usr-student-001', studentName: 'Shaminda Perera', studentNo: 'EG/2022/5311', status: 'Completed', keyholderId: 'usr-kh-005', keyholderName: 'Sachini Senanayake', zoneId: 'e', date: day(-3), durationMins: 270 }),
    mkReq({ id: 'req-p2', title: 'Final Year Project — Composite Layup', description: 'Wet layup for CFRP panels. Requires PPE and ventilation. Resins sourced and approved.', studentId: 'usr-student-002', studentName: 'Nadeesha Fernando', studentNo: 'EG/2021/3892', status: 'Pending', zoneId: 'e', date: day(2), durationMins: 300, createdAt: iso(-2 * H) }),
    mkReq({ id: 'req-p3', title: 'Robotics Club — Servo Mount Machining', description: 'CNC milling aluminium servo brackets. G-code verified by supervisor.', studentId: 'usr-student-003', studentName: 'Tharaka Dissanayake', studentNo: 'EG/2023/1047', status: 'Pending', zoneId: 'd', date: day(2), durationMins: 120, createdAt: iso(-3 * H) }),
    mkReq({ id: 'req-ov', title: 'Motor Controller Testing — Session 2', studentId: 'usr-student-003', studentName: 'Tharaka Dissanayake', studentNo: 'EG/2023/1047', status: 'Overdue', keyholderId: 'usr-kh-007', keyholderName: 'Ruwan Wijesekara', zoneId: 'b', date: day(-1), durationMins: 120, estimatedEnd: iso(-2.23 * H) }),
  ],
  penalty: { 'usr-kh-007': true },
  inventory: INVENTORY_SEED.map((i, n) => ({ ...i, id: `inv-${n}` })),
  users: [
    ['Shaminda Perera', 'EG/2022/5311', 'User', 'Active', 'v2.4'], ['Kasun Jayawardena', 'EG/2021/2201', 'Keyholder', 'Active', 'v2.4'],
    ['Nadeesha Fernando', 'EG/2021/3892', 'User', 'Active', 'v2.4'], ['Tharaka Dissanayake', 'EG/2023/1047', 'User', 'Active', 'v2.4'],
    ['Ruwan Wijesekara', 'EG/2022/4410', 'Keyholder', 'Penalty', 'v2.4'], ['Sachini Senanayake', 'EG/2022/5500', 'Keyholder', 'Active', 'v2.4'],
    ['Pradeep Kumara', 'EG/2020/1130', 'Alumni', 'Alumni', 'v2.3'], ['Imesha Rathnayake', 'EG/2023/2267', 'Pending', 'Pending_Signature', '—'],
    ['Chamal Bandara', 'EG/2021/4480', 'Keyholder', 'Active', 'v2.4'], ['Dilini Wickramasinghe', 'EG/2022/6134', 'User', 'Active', 'v2.4'],
  ].map(([name, sid, role, status, sig], n) => ({ id: `usr-d-${n}`, name, sid, email: `${name.split(' ')[0].toLowerCase()}@eng.ruh.ac.lk`, role, status, sig })),
  audit: [
    ['2026-06-12 15:47:02', 'KEY_RETURNED', 'Kasun Jayawardena', 'requests/a3f…', 'Officer: Sgt. Pathirana · Session closed'],
    ['2026-06-12 14:23:11', 'REQUEST_SUBMITTED', 'Shaminda Perera', 'requests/c7b…', 'PCB Etching — MPPT Controller Rev 2'],
    ['2026-06-12 13:55:30', 'PENALTY_TRIGGERED', 'System', 'users/kh-007', 'Overdue by 2h 14m · Claiming suspended'],
    ['2026-06-12 13:00:00', 'KEY_RETRIEVED', 'Kasun Jayawardena', 'requests/a3f…', 'Officer: Sgt. Ranasinghe · Student notified'],
    ['2026-06-12 12:58:04', 'REQUEST_CLAIMED', 'Kasun Jayawardena', 'requests/a3f…', 'Chassis Welding Session 3 · 7 others notified'],
    ['2026-06-12 11:30:21', 'SIGNATURE_CAPTURED', 'Tharaka Dissanayake', 'liability_sigs/s9d…', 'Procedure v2.4 · IP: 192.168.1.84'],
    ['2026-06-11 09:15:00', 'ROLE_CHANGED', 'Superadmin', 'users/kh-008', 'Pending → Keyholder (Year assignment)'],
    ['2026-06-10 16:44:55', 'PROCEDURE_PUBLISHED', 'Superadmin', 'procedures/v2.4', 'Re-agreement triggered for 142 active users'],
  ].map(([ts, event, actor, entity, detail], n) => ({ id: `a${n}`, ts, event, actor, entity, detail })),
  procedures: PROCEDURE_SEED.map((p) => ({ ...p })),
  completedBase: 18,
};

let auditSeq = 0;
const subs = new Set();
const emit = () => subs.forEach((cb) => cb());
const fail = (msg) => { throw new Error(msg); };
const nowStamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const find = (id) => store.requests.find((r) => r.id === id) || fail('Request not found');
const touch = (r, patch) => { Object.assign(r, patch); r.stage = STAGE_OF[r.status]; r.overdue = r.status === 'Overdue'; };

export function createDemoApi(profile) {
  const me = profile?.id;
  const log = (event, entity, detail) => store.audit.unshift({ id: `a${Date.now()}-${++auditSeq}`, ts: nowStamp(), event, actor: profile?.full_name || 'System', entity, detail });
  const staff = () => ['Keyholder', 'Superadmin'].includes(profile?.role) || fail('Not authorized');

  return {
    live: false,

    async listMyRequests() { return store.requests.filter((r) => r.studentId === me).map((r) => ({ ...r })).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)); },
    async createRequest({ title, description, date, duration, zoneId, bench }) {
      store.requests.unshift(mkReq({ id: `req-${Date.now()}`, title, description, studentId: me, studentName: profile.full_name, studentNo: profile.student_id, status: 'Pending', zoneId, bench, date, durationMins: DURATION_MINS[duration] || 180, createdAt: iso(0) }));
      log('REQUEST_SUBMITTED', 'requests/new', title);
      emit();
    },
    async cancelRequest(id) {
      const r = find(id);
      if (r.studentId !== me || r.status !== 'Pending') fail('Only your own pending requests can be cancelled.');
      touch(r, { status: 'Cancelled' });
      log('REQUEST_CANCELLED', `requests/${id.slice(-6)}`, r.title);
      emit();
    },
    async listPending() { return store.requests.filter((r) => r.status === 'Pending').map((r) => ({ ...r })); },
    async listAssigned() { return store.requests.filter((r) => r.keyholderId === me && ['Claimed', 'Active', 'Overdue'].includes(r.status)).map((r) => ({ ...r })); },
    async listOverdue() { return store.requests.filter((r) => r.status === 'Overdue' && (profile?.role === 'Superadmin' || r.keyholderId === me)).map((r) => ({ ...r })); },
    async completedCount() { return store.completedBase + store.requests.filter((r) => r.keyholderId === me && r.status === 'Completed').length; },
    async claim(id) {
      staff();
      if (store.penalty[me]) fail('Keyholder is in the penalty box and cannot claim requests');
      const r = find(id);
      if (r.status !== 'Pending') fail('Request is not in Pending state');
      touch(r, { status: 'Claimed', keyholderId: me, keyholderName: profile.full_name, claimedAt: iso(0) });
      log('REQUEST_CLAIMED', `requests/${id.slice(-6)}`, r.title);
      emit();
    },
    async retrieveKey(id, officer) {
      const r = find(id);
      if (r.status !== 'Claimed') fail('Request must be Claimed to retrieve key');
      if (r.keyholderId !== me) fail('Only the assigned Keyholder can retrieve the key');
      touch(r, { status: 'Active', estimatedEnd: iso(r.durationMins * 60000) });
      log('KEY_RETRIEVED', `requests/${id.slice(-6)}`, `Officer: ${officer}`);
      emit();
    },
    async returnKey(id, officer) {
      const r = find(id);
      if (!['Active', 'Overdue'].includes(r.status)) fail('Key cannot be returned for this request state');
      if (r.keyholderId !== me && profile?.role !== 'Superadmin') fail('Only the assigned Keyholder or Superadmin can return the key');
      const wasOverdue = r.status === 'Overdue';
      touch(r, { status: 'Completed' });
      log('KEY_RETURNED', `requests/${id.slice(-6)}`, `Officer: ${officer}${wasOverdue ? ' · Returned late' : ''}`);
      if (wasOverdue && !store.requests.some((x) => x.keyholderId === r.keyholderId && x.status === 'Overdue')) {
        store.penalty[r.keyholderId] = false;
        log('PENALTY_CLEARED', `users/${String(r.keyholderId).slice(-6)}`, 'Key returned');
      }
      emit();
    },
    async myPenalty() { return !!store.penalty[me]; },
    async runOverdueCheck() { /* nothing to sweep in the demo */ },

    async listInventory() { return store.inventory.map((i) => ({ ...i })); },
    async setCondition(id, condition) {
      staff();
      const i = store.inventory.find((x) => x.id === id) || fail('Item not found');
      i.cond = condition === 'Normal' ? 'Good' : condition;
      i.checked = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      log('INVENTORY_ISSUE_REPORTED', `inventory_items/${id}`, `${i.name}: ${condition}`);
      emit();
    },

    async listUsers() { return store.users.map((u) => ({ ...u })); },
    async setRole(userId, role) {
      if (profile?.role !== 'Superadmin') fail('Only Superadmins can reset roles');
      const u = store.users.find((x) => x.id === userId) || fail('User not found');
      u.role = role;
      log('ROLE_CHANGED', `users/${userId}`, `${u.name} → ${role}`);
      emit();
    },
    async resetKeyholders() {
      if (profile?.role !== 'Superadmin') fail('Only Superadmins can reset roles');
      const ks = store.users.filter((u) => u.role === 'Keyholder');
      ks.forEach((u) => { u.role = 'User'; });
      log('BULK_ROLE_RESET', 'users/*', `${ks.length} Keyholders reset to User`);
      emit();
      return ks.length;
    },
    async listAudit() { return store.audit.map((a) => ({ ...a })); },
    async listProcedures() { return store.procedures.map((p) => ({ ...p })); },
    async publishProcedure({ version, summary }) {
      if (profile?.role !== 'Superadmin') fail('Only Superadmins can publish procedures');
      store.procedures = [{ v: version.replace(/^v/i, ''), date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), sigs: 0, current: true }, ...store.procedures.map((p) => ({ ...p, current: false }))];
      log('PROCEDURE_PUBLISHED', `procedures/v${version}`, `Re-agreement triggered for active users${summary ? ' · ' + summary : ''}`);
      emit();
    },
    async adminStats() { return { projects: 127, members: 86, requests: 245 + store.requests.length }; },
    async overridePenalty(keyholderId) { store.penalty[keyholderId] = false; emit(); },

    subscribe(cb) { subs.add(cb); return () => subs.delete(cb); },
  };
}
