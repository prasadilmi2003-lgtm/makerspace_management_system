import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApi, useQuery } from '../context/ApiContext';
import AppShell, { StatTile } from '../components/AppShell';
import { Avatar, Empty, initialsOf } from '../components/ui';
import FloorExplorer from '../components/FloorExplorer';
import { downloadCsv } from '../data/mock';

const ROLES = ['User', 'Keyholder', 'Alumni', 'Superadmin', 'Pending'];
const EVENT_CHIP = (e) => (/PENALTY_TRIGGERED/.test(e) ? 'chip-bad' : /PENALTY|ROLE|PROCEDURE/.test(e) ? 'chip-warn' : /RETURN|SIGNATURE/.test(e) ? 'chip-ok' : 'chip-info');
const ROLE_CHIP = { Keyholder: 'chip-brand', Superadmin: 'chip-bad', User: 'chip-info', Alumni: 'chip-mute', Pending: 'chip-warn' };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const USAGE = [46, 58, 71, 63, 88, 97];
const CATS = [['Mechanical', [18, 26], '#ff5a1f'], ['Electronics', [14, 22], '#3b82f6'], ['Robotics', [9, 15], '#22c55e'], ['Software', [6, 11], '#8b5cf6']];
const MACHINES = [['3D Printer', 142], ['CNC Machine', 128], ['Laser Cutter', 96], ['MIG Welder', 71]];
const DEPTS = [['Mechanical', 34, '#ff5a1f'], ['Electrical', 22, '#3b82f6'], ['Computer', 18, '#22c55e'], ['Other', 12, '#8b5cf6']];

const Panel = ({ title, right, children, className = '' }) => (
  <section className={`card-dark p-5 ${className}`}>
    <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-[15px] font-bold text-white">{title}</h2>{right}</div>
    {children}
  </section>
);

const AreaChart = () => {
  const W = 480, H = 190, p = 28, max = 120;
  const pts = USAGE.map((v, i) => [p + (i * (W - p * 2)) / (USAGE.length - 1), H - p - (v / max) * (H - p * 2)]);
  const line = pts.map((q, i) => `${i ? 'L' : 'M'}${q[0]},${q[1]}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Facility usage by month: ${MONTHS.map((m, i) => `${m} ${USAGE[i]}`).join(', ')}`}>
      <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff5a1f" stopOpacity=".45" /><stop offset="1" stopColor="#ff5a1f" stopOpacity="0" /></linearGradient></defs>
      {[0, 40, 80, 120].map((t) => { const y = H - p - (t / max) * (H - p * 2); return <g key={t}><line x1={p} x2={W - p} y1={y} y2={y} stroke="#fff" strokeOpacity=".07" /><text x={p - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#8892a8">{t}</text></g>; })}
      <path d={`${line} L${pts.at(-1)[0]},${H - p} L${pts[0][0]},${H - p} Z`} fill="url(#ag)" />
      <path d={line} fill="none" stroke="#ff5a1f" strokeWidth="2.5" strokeLinejoin="round" />
      {pts.map((q, i) => <g key={i}><circle cx={q[0]} cy={q[1]} r="4" fill="#0f131b" stroke="#ff5a1f" strokeWidth="2" /><text x={q[0]} y={H - 8} textAnchor="middle" fontSize="9.5" fill="#8892a8">{MONTHS[i]}</text></g>)}
    </svg>
  );
};

const Bars = () => {
  const H = 150;
  return (
    <div>
      <svg viewBox="0 0 300 170" className="h-auto w-full" role="img" aria-label="Projects per category, previous versus current term">
        {[0, 10, 20, 30].map((t) => { const y = H - (t / 30) * 120; return <g key={t}><line x1="22" x2="296" y1={y} y2={y} stroke="#fff" strokeOpacity=".07" /><text x="16" y={y + 3} textAnchor="end" fontSize="8.5" fill="#8892a8">{t}</text></g>; })}
        {CATS.map(([name, [a, b], c], i) => {
          const x = 34 + i * 66;
          return (
            <g key={name}>
              <rect x={x} y={H - (a / 30) * 120} width="20" height={(a / 30) * 120} rx="3" fill={c} opacity=".45" />
              <rect x={x + 23} y={H - (b / 30) * 120} width="20" height={(b / 30) * 120} rx="3" fill={c} />
              <text x={x + 21} y={H + 14} textAnchor="middle" fontSize="8.5" fill="#8892a8">{name}</text>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-center gap-4 text-[11px] text-ink-300"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-ink-300/50" />Last term</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-brand-500" />This term</span></div>
    </div>
  );
};

const Donut = () => {
  const total = DEPTS.reduce((a, d) => a + d[1], 0);
  const r = 46, c = 2 * Math.PI * r;
  const starts = DEPTS.map((_, i) => DEPTS.slice(0, i).reduce((a, d) => a + (d[1] / total) * c, 0));
  return (
    <div className="flex items-center gap-5">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 120 120" className="-rotate-90" role="img" aria-label="Active members by department">
          <circle cx="60" cy="60" r={r} fill="none" stroke="#1b2230" strokeWidth="14" />
          {DEPTS.map(([n, v, col], i) => { const len = (v / total) * c; return <circle key={n} cx="60" cy="60" r={r} fill="none" stroke={col} strokeWidth="14" strokeDasharray={`${len - 2} ${c - len + 2}`} strokeDashoffset={-starts[i]} />; })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="font-display text-3xl font-bold text-white">{total}</span><span className="text-[10px] text-ink-300">members</span></div>
      </div>
      <ul className="space-y-2 text-xs">
        {DEPTS.map(([n, v, col]) => <li key={n} className="flex items-center gap-2 text-ink-200"><i className="h-2.5 w-2.5 rounded-full" style={{ background: col }} />{n}<b className="ml-auto pl-4 text-white">{v}</b></li>)}
      </ul>
    </div>
  );
};

export default function AdminPanel({ onToast }) {
  const { profile } = useAuth();
  const api = useApi();
  const navigate = useNavigate();
  const [tab, setTab] = useState('analytics');
  const [q, setQ] = useState('');
  const [roleF, setRoleF] = useState('All');
  const [ver, setVer] = useState('');
  const [summary, setSummary] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [clearing, setClearing] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useQuery(async (a) => {
    const [users, audit, procs, stats] = await Promise.all([a.listUsers(), a.listAudit(), a.listProcedures(), a.adminStats()]);
    return { users, audit, procs, stats };
  }, 'admin');
  const users = data?.users || [];
  const audit = data?.audit || [];
  const procs = data?.procs || [];
  const stats = data?.stats;

  const nav = [
    { id: 'analytics', label: 'Analytics', icon: 'ChartColumn', section: 'Administration' },
    { id: 'users', label: 'User Management', icon: 'Users' },
    { id: 'audit', label: 'Audit Logs', icon: 'ScrollText' },
    { id: 'procedures', label: 'Procedures', icon: 'FileText' },
    { id: 'floor', label: 'Floor Plan', icon: 'Map' },
    { id: '/keyholder', label: 'Keyholder Ops', icon: 'KeyRound', section: 'Shortcuts' },
  ];
  const onNav = (id) => (id.startsWith('/') ? navigate(id) : setTab(id));
  const warn = (e) => onToast?.('warn', e.message);

  const shownUsers = useMemo(() => users.filter((u) => (roleF === 'All' || u.role === roleF) && `${u.name} ${u.sid}`.toLowerCase().includes(q.toLowerCase())), [users, q, roleF]);
  const shownAudit = audit.filter((a) => `${a.event} ${a.actor} ${a.detail}`.toLowerCase().includes(q.toLowerCase()));

  const exportUsers = () => {
    downloadCsv('makerspace-users.csv', [['Name', 'Student ID', 'Email', 'Role', 'Status', 'Signed Version'], ...users.map((u) => [u.name, u.sid, u.email, u.role, u.status, u.sig])]);
    onToast?.('ok', 'CSV export ready.');
  };
  const changeRole = async (u, role) => {
    try { await api.setRole(u.id, role); onToast?.('ok', `${u.name} is now ${role}. Audit entry written.`); await reload(); } catch (e) { warn(e); await reload(); }
  };
  const bulkReset = async () => {
    setBusy(true);
    try { const n = await api.resetKeyholders(); onToast?.('ok', `${n} Keyholder assignment${n === 1 ? '' : 's'} reset for the new academic year.`); setConfirmReset(false); await reload(); } catch (e) { warn(e); } finally { setBusy(false); }
  };
  const clearPenalty = async (e) => {
    e.preventDefault();
    if (!reason.trim()) return onToast?.('warn', 'A reason is mandatory for a penalty override.');
    setBusy(true);
    try { await api.overridePenalty(clearing.id, reason.trim()); onToast?.('ok', `Penalty cleared for ${clearing.name}.`); setClearing(null); setReason(''); await reload(); } catch (ex) { warn(ex); } finally { setBusy(false); }
  };
  const publish = async (e) => {
    e.preventDefault();
    if (!ver.trim()) return onToast?.('warn', 'Enter a version number.');
    setBusy(true);
    try { await api.publishProcedure({ version: ver.trim(), summary: summary.trim() }); onToast?.('ok', `v${ver.replace(/^v/i, '')} published. Active users must re-sign on next session.`); setVer(''); setSummary(''); await reload(); } catch (ex) { warn(ex); } finally { setBusy(false); }
  };

  const titles = { analytics: 'System Analytics', users: 'User Management', audit: 'Audit Logs', procedures: 'Procedures', floor: 'Floor Plan' };
  const subs = { analytics: 'Overview of makerspace usage, projects and members.', users: 'Assign roles and manage the academic-year Keyholder cycle.', audit: 'Immutable record of every privileged action.', procedures: 'Publish a new operational agreement version.', floor: 'Live 3D model of the workshop. Select a bench to change its status.' };

  return (
    <AppShell nav={nav} active={tab} onNav={onNav} onSearch={setQ} roleLabel="Superadmin" title={titles[tab]} subtitle={subs[tab]}>
      {error && <div role="alert" className="mb-6 rounded-xl border border-bad/30 bg-bad/10 p-4 text-sm text-bad">{error}</div>}
      {loading && !data && <div className="card-dark flex items-center gap-3 p-5 text-sm text-ink-300"><Loader2 size={16} className="animate-spin" /> Loading…</div>}

      {tab === 'floor' && <FloorExplorer embedded onToast={onToast} />}

      {data && tab === 'analytics' && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile icon="Rocket" tone="info" value={stats.projects} label="Total Projects" />
            <StatTile icon="Users" tone="ok" value={stats.members} label="Active Members" />
            <StatTile icon="KeyRound" tone="brand" value={stats.requests} label="Access Requests" />
            <StatTile icon="Activity" tone="info" value="98%" label="Uptime" />
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Panel title="Facility Usage (Last 6 Months)" right={<span className="chip-mute chip">Sample data</span>}><AreaChart /></Panel>
            <Panel title="Project Categories" right={<span className="chip-mute chip">Sample data</span>}><Bars /></Panel>
            <Panel title="Most Used Machines">
              <ul className="space-y-4">
                {MACHINES.map(([n, h]) => (
                  <li key={n}><div className="mb-1.5 flex justify-between text-xs"><span className="text-ink-100">{n}</span><span className="font-semibold text-white">{h}h</span></div><div className="h-2 overflow-hidden rounded-full bg-ink-700" role="progressbar" aria-valuenow={h} aria-valuemax={150} aria-label={n}><div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400" style={{ width: `${(h / 150) * 100}%` }} /></div></li>
                ))}
              </ul>
            </Panel>
            <Panel title="Active Members by Department"><Donut /></Panel>
          </div>
        </>
      )}

      {data && tab === 'users' && (
        <section className="card-dark overflow-hidden">
          {clearing && (
            <form onSubmit={clearPenalty} className="flex flex-wrap items-end gap-3 border-b border-bad/30 bg-bad/5 p-4">
              <div className="min-w-60 flex-1">
                <label className="mb-1.5 block text-xs font-semibold text-ink-200" htmlFor="pr">Override penalty for {clearing.name} — reason (mandatory)</label>
                <input id="pr" className="field-dark" placeholder="e.g. Key returned but system was offline" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <button className="btn bg-bad text-white hover:brightness-110" disabled={busy}>Clear penalty</button>
              <button type="button" className="btn-ghost-dark" onClick={() => { setClearing(null); setReason(''); }}>Cancel</button>
            </form>
          )}
          <div className="flex flex-wrap items-center gap-3 border-b border-white/[.07] p-4">
            <div className="flex flex-wrap gap-2">{['All', ...ROLES].map((r) => <button key={r} onClick={() => setRoleF(r)} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${roleF === r ? 'bg-brand-500 text-white' : 'bg-ink-700 text-ink-200 hover:text-white'}`}>{r}</button>)}</div>
            <div className="ml-auto flex items-center gap-2">
              <button className="btn-ghost-dark btn-sm" onClick={exportUsers}>Export CSV</button>
              {confirmReset ? (
                <span className="flex items-center gap-2 text-xs text-ink-200">Reset all Keyholders?<button className="btn bg-bad px-3 py-1.5 text-xs text-white" disabled={busy} onClick={bulkReset}>Confirm</button><button className="btn-ghost-dark btn-sm" onClick={() => setConfirmReset(false)}>Cancel</button></span>
              ) : <button className="btn-outline-brand btn-sm" onClick={() => setConfirmReset(true)}><RefreshCw size={13} /> Bulk year reset</button>}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-ink-400"><tr><th className="p-4">User</th><th>Student ID</th><th>Role</th><th>Status</th><th>Agreement</th><th className="pr-4 text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-white/[.05]">
                {shownUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[.02]">
                    <td className="p-4"><div className="flex items-center gap-3"><Avatar initials={initialsOf(u.name)} size={30} hue={u.name.length * 23} /><div><div className="font-medium text-white">{u.name}</div><div className="text-[11px] text-ink-400">{u.email}</div></div></div></td>
                    <td className="font-mono text-xs text-ink-300">{u.sid}</td>
                    <td><span className={`${ROLE_CHIP[u.role]} chip`}>{u.role}</span></td>
                    <td className={u.status === 'Penalty' ? 'font-semibold text-bad' : 'text-ink-300'}>{u.status.replace(/_/g, ' ')}</td>
                    <td className="font-mono text-xs text-ink-300">{u.sig}</td>
                    <td className="pr-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {u.status === 'Penalty' && <button className="btn-outline btn-sm !border-bad/40 !text-bad" onClick={() => setClearing(u)}>Clear penalty</button>}
                        <select aria-label={`Role for ${u.name}`} value={u.role} onChange={(e) => changeRole(u, e.target.value)} disabled={u.id === profile?.id} title={u.id === profile?.id ? 'You cannot change your own role' : undefined} className="rounded-lg border border-white/10 bg-ink-900 px-2 py-1.5 text-xs text-white disabled:opacity-50">{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!shownUsers.length && <div className="p-6"><Empty icon="UserSearch" title="No users match" /></div>}
          </div>
        </section>
      )}

      {data && tab === 'audit' && (
        <section className="card-dark overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-ink-400"><tr><th className="p-4">Timestamp</th><th>Event</th><th>Actor</th><th>Entity</th><th className="pr-4">Detail</th></tr></thead>
            <tbody className="divide-y divide-white/[.05]">
              {shownAudit.map((a) => (
                <tr key={a.id} className="hover:bg-white/[.02]">
                  <td className="whitespace-nowrap p-4 font-mono text-xs text-ink-300">{a.ts}</td><td><span className={`${EVENT_CHIP(a.event)} chip font-mono`}>{a.event}</span></td>
                  <td className="text-white">{a.actor}</td><td className="font-mono text-xs text-ink-300">{a.entity}</td><td className="pr-4 text-ink-200">{a.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shownAudit.length && <div className="p-6"><Empty icon="SearchX" title="No log entries match" /></div>}
        </section>
      )}

      {data && tab === 'procedures' && (
        <form onSubmit={publish} className="card-dark max-w-2xl space-y-5 p-6" noValidate>
          <p className="text-sm text-ink-200">Publishing a new version flags every active user for <b className="text-white">re-agreement</b> before their next session.</p>
          <ul className="space-y-3">
            {procs.map((p) => (
              <li key={p.v} className={`flex items-center justify-between rounded-xl border p-4 ${p.current ? 'border-ok/30 bg-ok/5' : 'border-white/10 bg-ink-900'}`}>
                <div><div className="text-sm font-semibold text-white">v{p.v} {p.current && <span className="font-mono text-xs font-normal text-ink-300">— current</span>}</div><div className="text-xs text-ink-300">Published {p.date} · {p.sigs} signatures</div></div>
                <span className={`${p.current ? 'chip-ok' : 'chip-mute'} chip`}>{p.current ? 'Active' : 'Archived'}</span>
              </li>
            ))}
          </ul>
          <div><label className="mb-1.5 block text-xs font-semibold text-ink-200" htmlFor="v">Version number</label><input id="v" className="field-dark" placeholder="2.5" value={ver} onChange={(e) => setVer(e.target.value)} /></div>
          <div><label className="mb-1.5 block text-xs font-semibold text-ink-200" htmlFor="s">Summary of changes</label><textarea id="s" rows={4} className="field-dark resize-none" placeholder="What changed in this version?" value={summary} onChange={(e) => setSummary(e.target.value)} /></div>
          <div className="flex justify-end"><button className="btn-primary" disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Publish &amp; trigger re-agreement</button></div>
          <div className="text-[11px] text-ink-400">Signed in as {profile?.full_name}. This action is written to the audit log.</div>
        </form>
      )}
    </AppShell>
  );
}
