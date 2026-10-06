import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertOctagon, KeyRound, Loader2, Timer } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApi, useQuery } from '../context/ApiContext';
import AppShell, { StatTile } from '../components/AppShell';
import { Avatar, Empty, Icon, initialsOf } from '../components/ui';
import FloorExplorer from '../components/FloorExplorer';
import { downloadCsv, ZONES } from '../data/mock';

const zoneName = (id) => ZONES.find((z) => z.id === id)?.name || 'No zone chosen';
const fmtDate = (iso) => (iso ? new Date(`${iso}T00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '—');
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—');
const mins = (m) => (m >= 60 ? `${(m / 60).toFixed(m % 60 ? 1 : 0)} hrs` : `${m} min`);
const ago = (iso) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};
const lateText = (iso) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

const OfficerForm = ({ label, value, onChange, onSubmit, cta, busy, tone = 'primary' }) => (
  <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3" noValidate>
    <div className="min-w-56 flex-1">
      <label className="mb-1.5 block text-xs font-semibold text-ink-200">{label}</label>
      <input className="field-dark" placeholder="e.g. Sgt. Pathirana" value={value || ''} onChange={(e) => onChange(e.target.value)} />
    </div>
    <button className={tone === 'bad' ? 'btn bg-bad text-white hover:brightness-110' : 'btn-primary'} disabled={busy}>
      {busy ? <Loader2 size={15} className="animate-spin" /> : null} {cta}
    </button>
  </form>
);

export default function KeyholderDashboard({ onToast }) {
  const { profile, refreshProfile } = useAuth();
  const api = useApi();
  const navigate = useNavigate();
  const isAdmin = profile?.role === 'Superadmin';

  const [tab, setTab] = useState('overview');
  const [officers, setOfficers] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [invFilter, setInvFilter] = useState('all');
  const [q, setQ] = useState('');

  // Keep overdue statuses and penalties current even when no cron job is running.
  useEffect(() => { api.runOverdueCheck().catch(() => {}); }, [api]);

  const { data: board, loading, error, reload } = useQuery(async (a) => {
    const [pending, assigned, overdue, completed, penalty, inventory] = await Promise.all([
      a.listPending(), a.listAssigned(), a.listOverdue(), a.completedCount(), a.myPenalty(), a.listInventory(),
    ]);
    return { pending, assigned, overdue, completed, penalty, inventory };
  }, 'board');

  const pending = board?.pending || [];
  const assigned = board?.assigned || [];
  const overdue = board?.overdue || [];
  const inventory = board?.inventory || [];
  const penalty = !!board?.penalty;
  const sessions = assigned.filter((r) => r.stage !== 'completed');

  const warn = (e) => onToast?.('warn', e.message);
  const setOfficer = (id) => (v) => setOfficers((o) => ({ ...o, [id]: v }));
  const onNav = (id) => (id.startsWith('/') ? navigate(id) : setTab(id));

  /** Run an action with a busy indicator, refresh the board, and report the outcome. */
  const act = async (id, fn, okMsg, refreshAuth = false) => {
    setBusyId(id);
    try {
      await fn();
      onToast?.('ok', okMsg);
      if (refreshAuth) await refreshProfile?.();
      await reload();
    } catch (e) {
      warn(e);
    } finally {
      setBusyId(null);
    }
  };

  const claim = (r) => {
    if (penalty) return onToast?.('warn', 'Claiming suspended. Resolve the overdue key return first.');
    return act(r.id, () => api.claim(r.id), 'Request claimed. Other Keyholders were notified.');
  };
  const needOfficer = (r) => {
    const name = (officers[r.id] || '').trim();
    if (!name) onToast?.('warn', 'Enter the security officer’s name.');
    return name;
  };
  const retrieve = (r) => (e) => { e.preventDefault(); const n = needOfficer(r); if (n) act(r.id, () => api.retrieveKey(r.id, n), 'Key logged out. Student notified to meet at the zone.'); };
  const giveBack = (r) => (e) => { e.preventDefault(); const n = needOfficer(r); if (n) act(r.id, () => api.returnKey(r.id, n), 'Key returned. Audit record written.', true); };
  const toggleFlag = (i) => act(i.id, () => api.setCondition(i.id, i.cond === 'Good' ? 'Damaged' : 'Good'), `${i.name} condition updated. Superadmin notified.`);
  const exportInv = () => {
    downloadCsv('makerspace-inventory.csv', [['Item', 'Category', 'Qty', 'Condition', 'Status', 'Last Checked'], ...inventory.map((i) => [i.name, i.cat, i.qty, i.cond, i.status, i.checked])]);
    onToast?.('ok', 'Inventory report exported.');
  };

  const shownInv = useMemo(() => inventory.filter((i) => (invFilter === 'flagged' ? i.cond !== 'Good' : invFilter === 'out' ? i.status === 'Checked Out' : true)
    && i.name.toLowerCase().includes(q.toLowerCase())), [inventory, invFilter, q]);

  const nav = [
    { id: 'overview', label: 'Dashboard', icon: 'LayoutDashboard', section: 'Operations' },
    { id: 'requests', label: 'Access Requests', icon: 'ClipboardList', badge: pending.length || null },
    { id: 'session', label: 'Active Session', icon: 'KeyRound', badge: sessions.length || null },
    { id: 'penalty', label: 'Overdue', icon: 'OctagonAlert', badge: overdue.length || null },
    { id: 'floor', label: 'Workbenches', icon: 'Layers' },
    { id: 'inventory', label: 'Inventory', icon: 'Package' },
    { id: '/projects', label: 'Projects', icon: 'FolderKanban' },
    ...(isAdmin ? [{ id: '/admin', label: 'Admin Panel', icon: 'ShieldAlert', section: 'Account' }] : []),
  ];
  const titles = { overview: 'Operations Dashboard', requests: 'Access Requests', session: 'Active Session', penalty: 'Overdue Keys', floor: 'Workbenches', inventory: 'Inventory' };

  const Loading = () => <div className="card-dark flex items-center gap-3 p-5 text-sm text-ink-300"><Loader2 size={16} className="animate-spin" /> Loading…</div>;

  return (
    <AppShell nav={nav} active={tab} onNav={onNav} onSearch={setQ} roleLabel={isAdmin ? 'Superadmin' : 'Keyholder'}
      title={titles[tab]} subtitle={`${profile?.full_name} · ${profile?.student_id}${penalty ? ' · Penalty Box' : ''}`}>

      {error && <div role="alert" className="mb-6 rounded-xl border border-bad/30 bg-bad/10 p-4 text-sm text-bad">{error}</div>}

      {penalty && tab !== 'penalty' && (
        <button onClick={() => setTab('penalty')} className="mb-6 flex w-full items-center gap-3 rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-left text-sm text-bad">
          <AlertOctagon size={18} /> <span><b>Claiming suspended.</b> An overdue key return must be logged before you can claim new requests.</span>
        </button>
      )}

      {loading && !board && <Loading />}

      {board && tab === 'overview' && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatTile icon="Hourglass" tone="brand" value={pending.length} label="Pending" />
            <StatTile icon="CalendarCheck" tone="ok" value={sessions.length} label="My Active" />
            <StatTile icon="AlarmClock" tone="bad" value={overdue.length} label="Overdue" />
            <StatTile icon="BadgeCheck" tone="ok" value={board.completed} label="Completed" />
            <StatTile icon="Armchair" tone="info" value={ZONES.filter((z) => z.status === 'available' || z.status === 'occupied').reduce((a, z) => a + z.cap - z.used, 0)} label="Available benches" />
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <section className="card-dark p-5" aria-label="Recent access requests">
              <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-lg font-bold text-white">Recent Access Requests</h2><button onClick={() => setTab('requests')} className="text-xs font-semibold text-brand-400 hover:underline">View all →</button></div>
              {!pending.length ? <Empty icon="Inbox" title="Nothing waiting" sub="New requests will appear here instantly." /> : (
                <ul className="divide-y divide-white/[.06]">
                  {pending.slice(0, 6).map((p) => (
                    <li key={p.id} className="flex items-center gap-3 py-3">
                      <Avatar initials={initialsOf(p.studentName)} size={38} hue={(p.id.charCodeAt(0) * 40) % 360} />
                      <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-white">{p.studentName}</div><div className="truncate text-xs text-ink-300">{zoneName(p.zoneId)} · {ago(p.createdAt)}</div></div>
                      <span className="chip-warn chip">Pending</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <div className="space-y-6">
              <section className="card-dark p-5">
                <h2 className="font-display text-lg font-bold text-white">Facility Status</h2>
                <div className="mt-4 flex items-center gap-4">
                  <span className="pulse-dot flex h-14 w-14 items-center justify-center rounded-full bg-ok/20 text-ok"><Icon name="Power" size={22} /></span>
                  <div><div className="font-display text-2xl font-bold text-ok">OPEN</div><div className="text-xs text-ink-300">Keyholder on site</div></div>
                </div>
              </section>
              <section className="card-dark p-5">
                <h2 className="mb-3 font-display text-lg font-bold text-white">Quick Actions</h2>
                <div className="grid grid-cols-2 gap-2.5">
                  {[['Claim Request', 'KeyRound', () => setTab('requests')], ['Floor Plan', 'Map', () => setTab('floor')], ['Report Issue', 'TriangleAlert', () => setTab('inventory')], ['Active Session', 'Timer', () => setTab('session')]].map(([l, ic, fn]) => (
                    <button key={l} onClick={fn} className="flex items-center gap-2 rounded-lg border border-white/10 bg-ink-900 px-3 py-2.5 text-xs font-semibold text-ink-100 transition hover:border-brand-500/60 hover:text-white"><Icon name={ic} size={15} className="text-brand-500" />{l}</button>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </>
      )}

      {board && tab === 'requests' && (
        <div className="space-y-4">
          {!pending.length && <Empty title="No pending requests" sub="Claimed requests move to Active Session." />}
          {pending.map((p) => (
            <article key={p.id} className="card-dark flex flex-wrap items-center gap-5 p-5">
              <div className="min-w-64 flex-1">
                <div className="flex items-center gap-2"><h3 className="font-display font-semibold text-white">{p.title}</h3><span className="chip-warn chip">Pending</span></div>
                <div className="mt-1 text-xs text-ink-300">{p.studentName} ({p.studentNo}) · {fmtDate(p.date)} · {mins(p.durationMins)} · {zoneName(p.zoneId)}{p.bench ? ` · ${p.bench}` : ''}</div>
                {p.description && <p className="mt-2 text-sm text-ink-200">{p.description}</p>}
                <div className="mt-1 text-[11px] text-ink-400">Submitted {ago(p.createdAt)}</div>
              </div>
              <button className="btn-primary" disabled={penalty || busyId === p.id} onClick={() => claim(p)}>
                {busyId === p.id ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />} {penalty ? 'Suspended' : 'Claim Request'}
              </button>
            </article>
          ))}
        </div>
      )}

      {board && tab === 'session' && (
        <div className="max-w-3xl space-y-5">
          {!sessions.length && <Empty icon="KeyRound" title="No active sessions" sub="Claim a request to start one." />}
          {sessions.map((r) => (
            <section key={r.id} className="card-dark space-y-5 p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h2 className="font-display text-lg font-bold text-white">{r.title}</h2><p className="mt-1 text-xs text-ink-300">{r.studentName} · {zoneName(r.zoneId)}{r.estimatedEnd ? ` · est. end ${fmtTime(r.estimatedEnd)}` : ''}</p></div>
                <span className={`${r.overdue ? 'chip-bad' : r.stage === 'active' ? 'chip-ok' : 'chip-info'} chip`}>{r.overdue ? 'Overdue' : r.stage === 'active' ? 'Key retrieved · Active' : 'Claimed'}</span>
              </div>
              {r.stage === 'claimed' && <OfficerForm label="Security officer who handed over the key" value={officers[r.id]} onChange={setOfficer(r.id)} onSubmit={retrieve(r)} cta="Log key retrieved" busy={busyId === r.id} />}
              {r.stage === 'active' && <OfficerForm label="Security officer receiving the key back" value={officers[r.id]} onChange={setOfficer(r.id)} onSubmit={giveBack(r)} cta="Log key returned" busy={busyId === r.id} />}
            </section>
          ))}
        </div>
      )}

      {board && tab === 'penalty' && (
        <section className="max-w-3xl space-y-4">
          {!overdue.length && <Empty icon="ShieldCheck" title="No overdue keys" sub={penalty ? 'Refresh to update your status.' : 'Claiming is enabled.'} />}
          {overdue.map((r) => (
            <article key={r.id} className="card-dark space-y-4 border-bad/30 p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h2 className="font-display text-lg font-bold text-white">{r.title}</h2><p className="mt-1 text-xs text-ink-300">{r.keyholderName || 'Keyholder'} · {r.studentName} ({r.studentNo})</p></div>
                <span className="chip-bad chip">Overdue</span>
              </div>
              <div className="rounded-lg border border-bad/30 bg-bad/10 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-bad"><Timer size={16} /> Key return overdue by {lateText(r.estimatedEnd)}</div>
                <p className="mt-1 text-xs text-bad/80">Estimated end was {fmtTime(r.estimatedEnd)}. Key not logged as returned. Claiming privileges suspended until resolved.</p>
              </div>
              <OfficerForm label="Security officer who received the key" value={officers[r.id]} onChange={setOfficer(r.id)} onSubmit={giveBack(r)} cta="Log key return & clear penalty" tone="bad" busy={busyId === r.id} />
            </article>
          ))}
        </section>
      )}

      {tab === 'floor' && <FloorExplorer embedded onToast={onToast} />}

      {board && tab === 'inventory' && (
        <section className="card-dark overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.07] p-4">
            <div>
              <h2 className="font-display text-base font-bold text-white">Equipment &amp; Consumables</h2>
              <p className="text-xs text-ink-300">Flag damaged or missing items. All flags are notified to the Superadmin.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[['all', 'All', inventory.length], ['flagged', 'Flagged', inventory.filter((i) => i.cond !== 'Good').length], ['out', 'Checked Out', inventory.filter((i) => i.status === 'Checked Out').length]].map(([k, l, n]) => (
                <button key={k} onClick={() => setInvFilter(k)} className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold ${invFilter === k ? 'bg-brand-500 text-white' : 'bg-ink-700 text-ink-200 hover:text-white'}`}>{l}<span className="rounded-full bg-black/25 px-1.5 text-[10px]">{n}</span></button>
              ))}
              <button className="btn-ghost-dark btn-sm" onClick={exportInv}>Export</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-ink-400"><tr><th className="p-4">Item</th><th>Category</th><th>Qty</th><th>Condition</th><th>Status</th><th>Last Checked</th><th className="pr-4 text-right">Action</th></tr></thead>
              <tbody className="divide-y divide-white/[.05]">
                {shownInv.map((i) => (
                  <tr key={i.id} className="hover:bg-white/[.02]">
                    <td className="p-4 font-medium text-white">{i.name}</td><td className="text-ink-300">{i.cat}</td><td className="font-mono text-xs text-ink-300">{i.qty}</td>
                    <td><span className={`${i.cond === 'Good' ? 'chip-ok' : i.cond === 'Damaged' ? 'chip-bad' : 'chip-warn'} chip`}>{i.cond}</span></td>
                    <td className={i.status === 'Checked Out' ? 'font-semibold text-brand-400' : 'text-ink-300'}>{i.status}</td>
                    <td className="text-ink-300">{i.checked}</td>
                    <td className="pr-4 text-right"><button disabled={busyId === i.id} onClick={() => toggleFlag(i)} className={i.cond === 'Good' ? 'btn-outline-brand btn-sm' : 'btn-outline btn-sm'}>{i.cond === 'Good' ? 'Flag Issue' : 'Clear Flag'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!shownInv.length && <div className="p-6"><Empty icon="PackageSearch" title="Nothing matches" /></div>}
          </div>
        </section>
      )}
    </AppShell>
  );
}
