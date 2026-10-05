import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertOctagon, Check, KeyRound, Timer } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AppShell, { StatTile } from '../components/AppShell';
import { Avatar, Empty, Icon, initialsOf } from '../components/ui';
import IsoFloor from '../components/IsoFloor';
import { downloadCsv, INVENTORY_SEED, ZONES } from '../data/mock';

const SEED_PENDING = [
  { id: 'p1', title: 'PCB Etching — MPPT Controller Rev 2', student: 'Shaminda Perera', sid: 'EG/2022/5311', when: 'Thu 12 Jun · 3 hrs', zone: 'Electronics Zone', desc: 'Etch tank, drill press and soldering station. All chemicals pre-approved.', at: 'Today, 14:23', claimed: false },
  { id: 'p2', title: 'Final Year Project — Composite Layup', student: 'Nadeesha Fernando', sid: 'EG/2021/3892', when: 'Fri 13 Jun · 5 hrs', zone: 'Assembly Zone', desc: 'Wet layup for CFRP panels. Requires PPE and ventilation. Resins sourced and approved.', at: 'Today, 13:05', claimed: false },
  { id: 'p3', title: 'Robotics Club — Servo Mount Machining', student: 'Tharaka Dissanayake', sid: 'EG/2023/1047', when: 'Fri 13 Jun · 2 hrs', zone: 'CNC Zone', desc: 'CNC milling of aluminium servo brackets. G-code verified by supervisor.', at: 'Today, 11:47', claimed: false },
];


const CLAIMED_CHIP = { true: 'chip-info', false: 'chip-warn' };

const OfficerForm = ({ label, value, onChange, onSubmit, cta, tone = 'primary' }) => (
  <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3" noValidate>
    <div className="min-w-56 flex-1">
      <label className="mb-1.5 block text-xs font-semibold text-ink-200">{label}</label>
      <input className="field-dark" placeholder="e.g. Sgt. Pathirana" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
    <button className={tone === 'bad' ? 'btn bg-bad text-white hover:brightness-110' : 'btn-primary'}>{cta}</button>
  </form>
);

export default function KeyholderDashboard({ onToast }) {
  const { demoRole, profile } = useAuth();
  const navigate = useNavigate();
  const isAdmin = profile?.role === 'Superadmin';
  const isPenalty = demoRole === 'kh_penalty';

  const [tab, setTab] = useState('overview');
  const [pending, setPending] = useState(SEED_PENDING);
  const [stage, setStage] = useState('claimed'); // claimed -> retrieved -> done
  const [officerOut, setOfficerOut] = useState('');
  const [officerIn, setOfficerIn] = useState('');
  const [overdueCleared, setOverdueCleared] = useState(false);
  const [officerLate, setOfficerLate] = useState('');
  const [inv, setInv] = useState(INVENTORY_SEED);
  const [invFilter, setInvFilter] = useState('all');
  const [q, setQ] = useState('');
  const penaltyActive = isPenalty && !overdueCleared;

  const toast = (i, m) => onToast?.(i, m);
  const open = pending.filter((p) => !p.claimed);
  const claimedNow = pending.filter((p) => p.claimed).length;
  const activeCount = (stage === 'done' ? 0 : 1) + claimedNow;
  const completedCount = stage === 'done' ? 19 : 18;
  const onNav = (id) => (id.startsWith('/') ? navigate(id) : setTab(id));

  const nav = [
    { id: 'overview', label: 'Dashboard', icon: 'LayoutDashboard', section: 'Operations' },
    { id: 'requests', label: 'Access Requests', icon: 'ClipboardList', badge: open.length || null },
    { id: 'session', label: 'Active Session', icon: 'KeyRound' },
    { id: 'penalty', label: 'Overdue', icon: 'OctagonAlert', badge: overdueCleared ? null : 1 },
    { id: 'floor', label: 'Workbenches', icon: 'Layers' },
    { id: 'inventory', label: 'Inventory', icon: 'Package' },
    { id: '/projects', label: 'Projects', icon: 'FolderKanban' },
    ...(isAdmin ? [{ id: '/admin', label: 'Admin Panel', icon: 'ShieldAlert', section: 'Account' }] : []),
  ];

  const claim = (id) => {
    if (penaltyActive) return toast('warn', 'Claiming suspended. Resolve the overdue key return first.');
    setPending((l) => l.map((p) => (p.id === id ? { ...p, claimed: true } : p)));
    toast('ok', 'Request claimed. Other Keyholders were notified.');
  };
  const retrieved = (e) => {
    e.preventDefault();
    if (!officerOut.trim()) return toast('warn', 'Enter the security officer’s name.');
    setStage('retrieved');
    toast('ok', 'Key logged out. Student notified to meet at the zone.');
  };
  const returned = (e) => {
    e.preventDefault();
    if (!officerIn.trim()) return toast('warn', 'Enter the security officer’s name for the return.');
    setStage('done');
    toast('ok', 'Session completed. Key returned. Audit record written.');
  };
  const clearOverdue = (e) => {
    e.preventDefault();
    if (!officerLate.trim()) return toast('warn', 'Enter the security officer’s name.');
    setOverdueCleared(true);
    toast('ok', 'Key return logged. Penalty cleared. Claiming re-enabled.');
  };
  const exportInv = () => {
    downloadCsv('makerspace-inventory.csv', [['Item', 'Category', 'Qty', 'Condition', 'Status', 'Last Checked'], ...inv.map((i) => [i.name, i.cat, i.qty, i.cond, i.status, i.checked])]);
    toast('ok', 'Inventory report exported.');
  };
  const flag = (name) => {
    setInv((l) => l.map((i) => (i.name === name ? { ...i, cond: i.cond === 'Good' ? 'Damaged' : 'Good' } : i)));
    toast('warn', `${name} condition updated. Superadmin notified.`);
  };

  const shownInv = useMemo(() => inv.filter((i) => (invFilter === 'flagged' ? i.cond !== 'Good' : invFilter === 'out' ? i.status === 'Checked Out' : true)
    && i.name.toLowerCase().includes(q.toLowerCase())), [inv, invFilter, q]);

  const titles = { overview: 'Operations Dashboard', requests: 'Access Requests', session: 'Active Session', penalty: 'Overdue Keys', floor: 'Workbenches', inventory: 'Inventory' };

  return (
    <AppShell nav={nav} active={tab} onNav={onNav} onSearch={setQ} roleLabel={isAdmin ? 'Superadmin' : 'Keyholder'}
      title={titles[tab]} subtitle={`${profile?.full_name} · ${profile?.student_id}${penaltyActive ? ' · Penalty Box' : ''}`}>

      {penaltyActive && tab !== 'penalty' && (
        <button onClick={() => setTab('penalty')} className="mb-6 flex w-full items-center gap-3 rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-left text-sm text-bad">
          <AlertOctagon size={18} /> <span><b>Claiming suspended.</b> An overdue key return must be logged before you can claim new requests.</span>
        </button>
      )}

      {tab === 'overview' && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatTile icon="Hourglass" tone="brand" value={open.length} label="Pending" />
            <StatTile icon="CalendarCheck" tone="ok" value={activeCount} label="My Active" />
            <StatTile icon="AlarmClock" tone="bad" value={overdueCleared ? 0 : 1} label="Overdue" />
            <StatTile icon="BadgeCheck" tone="ok" value={completedCount} label="Completed" />
            <StatTile icon="Armchair" tone="info" value={ZONES.filter((z) => z.status === 'available' || z.status === 'occupied').reduce((a, z) => a + z.cap - z.used, 0)} label="Available benches" />
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <section className="card-dark p-5" aria-label="Recent access requests">
              <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-lg font-bold text-white">Recent Access Requests</h2><button onClick={() => setTab('requests')} className="text-xs font-semibold text-brand-400 hover:underline">View all →</button></div>
              <ul className="divide-y divide-white/[.06]">
                {pending.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-3">
                    <Avatar initials={initialsOf(p.student)} size={38} hue={p.id.charCodeAt(1) * 40} />
                    <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-white">{p.student}</div><div className="truncate text-xs text-ink-300">{p.zone} · {p.at}</div></div>
                    <span className={`${CLAIMED_CHIP[p.claimed]} chip`}>{p.claimed ? 'Claimed' : 'Pending'}</span>
                  </li>
                ))}
              </ul>
            </section>
            <div className="space-y-6">
              <section className="card-dark p-5">
                <h2 className="font-display text-lg font-bold text-white">Facility Status</h2>
                <div className="mt-4 flex items-center gap-4">
                  <span className="pulse-dot flex h-14 w-14 items-center justify-center rounded-full bg-ok/20 text-ok"><Icon name="Power" size={22} /></span>
                  <div><div className="font-display text-2xl font-bold text-ok">OPEN</div><div className="text-xs text-ink-300">Closes in 4h 20m</div></div>
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

      {tab === 'requests' && (
        <div className="space-y-4">
          {!pending.length && <Empty title="No requests" />}
          {pending.map((p) => (
            <article key={p.id} className="card-dark flex flex-wrap items-center gap-5 p-5">
              <div className="min-w-64 flex-1">
                <div className="flex items-center gap-2"><h3 className="font-display font-semibold text-white">{p.title}</h3><span className={`${CLAIMED_CHIP[p.claimed]} chip`}>{p.claimed ? 'Claimed by you' : 'Pending'}</span></div>
                <div className="mt-1 text-xs text-ink-300">{p.student} ({p.sid}) · {p.when} · {p.zone}</div>
                <p className="mt-2 text-sm text-ink-200">{p.desc}</p>
                <div className="mt-1 text-[11px] text-ink-400">8 Keyholders notified · Submitted {p.at}</div>
              </div>
              {p.claimed ? <span className="flex items-center gap-1.5 text-sm font-semibold text-ok"><Check size={16} /> Handled</span>
                : <button className="btn-primary" disabled={penaltyActive} onClick={() => claim(p.id)}><KeyRound size={15} /> {penaltyActive ? 'Suspended' : 'Claim Request'}</button>}
            </article>
          ))}
        </div>
      )}

      {tab === 'session' && (
        <section className="card-dark max-w-3xl space-y-6 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="font-display text-lg font-bold text-white">Formula Student Chassis Welding — Session 3</h2><p className="mt-1 text-xs text-ink-300">Shaminda Perera · Fabrication Zone · est. end 18:00</p></div>
            <span className={`${stage === 'done' ? 'chip-mute' : stage === 'retrieved' ? 'chip-ok' : 'chip-info'} chip`}>{stage === 'done' ? 'Completed' : stage === 'retrieved' ? 'Key retrieved · Active' : 'Claimed'}</span>
          </div>
          {stage === 'claimed' && <OfficerForm label="Security officer who handed over the key" value={officerOut} onChange={setOfficerOut} onSubmit={retrieved} cta="Log key retrieved" />}
          {stage === 'retrieved' && <OfficerForm label="Security officer receiving the key back" value={officerIn} onChange={setOfficerIn} onSubmit={returned} cta="Log key returned" />}
          {stage === 'done' && <Empty icon="BadgeCheck" title="Session closed" sub="Key returned and audit record written." />}
        </section>
      )}

      {tab === 'penalty' && (
        <section className="max-w-3xl">
          {!overdueCleared ? (
            <article className="card-dark space-y-4 border-bad/30 p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold text-white">Motor Controller Testing — Session 2</h2>
                  <p className="mt-1 text-xs text-ink-300">Ruwan Wijesekara (EG/2022/4410) · Started Wed 11 Jun 14:00</p>
                </div>
                <span className="chip-bad chip">Overdue</span>
              </div>
              <div className="rounded-lg border border-bad/30 bg-bad/10 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-bad"><Timer size={16} /> Key return overdue by 2h 14m</div>
                <p className="mt-1 text-xs text-bad/80">Estimated end was 16:00. Key not logged as returned. Claiming privileges suspended until resolved.</p>
              </div>
              <OfficerForm label="Security officer who received the key" value={officerLate} onChange={setOfficerLate} onSubmit={clearOverdue} cta="Log key return & clear penalty" tone="bad" />
            </article>
          ) : <Empty icon="ShieldCheck" title="No overdue keys" sub="Key return logged. Claiming is enabled." />}
        </section>
      )}

      {tab === 'floor' && (
        <section className="card-dark p-5">
          <IsoFloor zones={ZONES} dark />
        </section>
      )}

      {tab === 'inventory' && (
        <section className="card-dark overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.07] p-4">
            <div>
              <h2 className="font-display text-base font-bold text-white">Equipment &amp; Consumables</h2>
              <p className="text-xs text-ink-300">Flag damaged or missing items. All flags are notified to the Superadmin.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[['all', 'All', inv.length], ['flagged', 'Flagged', inv.filter((i) => i.cond !== 'Good').length], ['out', 'Checked Out', inv.filter((i) => i.status === 'Checked Out').length]].map(([k, l, n]) => (
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
                  <tr key={i.name} className="hover:bg-white/[.02]">
                    <td className="p-4 font-medium text-white">{i.name}</td><td className="text-ink-300">{i.cat}</td><td className="font-mono text-xs text-ink-300">{i.qty}</td>
                    <td><span className={`${i.cond === 'Good' ? 'chip-ok' : i.cond === 'Damaged' ? 'chip-bad' : 'chip-warn'} chip`}>{i.cond}</span></td>
                    <td className={i.status === 'Checked Out' ? 'font-semibold text-brand-400' : 'text-ink-300'}>{i.status}</td>
                    <td className="text-ink-300">{i.checked}</td>
                    <td className="pr-4 text-right"><button onClick={() => flag(i.name)} className={i.cond === 'Good' ? 'btn-outline-brand btn-sm' : 'btn-outline btn-sm'}>{i.cond === 'Good' ? 'Flag Issue' : 'Clear Flag'}</button></td>
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
