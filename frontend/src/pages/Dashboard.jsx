import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Plus, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AppShell, { StatTile } from '../components/AppShell';
import { Empty, Icon } from '../components/ui';
import IsoFloor from '../components/IsoFloor';
import { DURATIONS, MY_REQUESTS_SEED, STAGES, STAGE_CHIP, STAGE_LABEL, ZONES, ZONE_STATUS_LABEL } from '../data/mock';
import { STATE_COLOR } from '../components/IsoFloor';

const NAV = [
  { id: 'overview', label: 'Dashboard', icon: 'LayoutDashboard', section: 'My Makerspace' },
  { id: 'new', label: 'New Request', icon: 'FilePlus2' },
  { id: '/facility', label: 'Floor Plan', icon: 'Map' },
  { id: '/projects', label: 'Projects', icon: 'FolderKanban' },
  { id: '/guidelines', label: 'Agreement', icon: 'ShieldCheck', section: 'Account' },
];

const Stepper = ({ stage }) => {
  const idx = STAGES.indexOf(stage);
  return (
    <ol className="mt-4 flex items-center" aria-label="Request progress">
      {STAGES.map((s, i) => (
        <li key={s} className="flex flex-1 items-center last:flex-none">
          <span title={STAGE_LABEL[s]} className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${i < idx ? 'bg-brand-500 text-white' : i === idx ? 'bg-brand-500 text-white ring-4 ring-brand-500/25' : 'bg-ink-700 text-ink-400'}`}>
            {i < idx ? <Check size={12} /> : i + 1}
          </span>
          {i < STAGES.length - 1 && <span className={`mx-1 h-0.5 flex-1 rounded ${i < idx ? 'bg-brand-500' : 'bg-ink-700'}`} />}
        </li>
      ))}
    </ol>
  );
};

export default function Dashboard({ onToast }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [reqs, setReqs] = useState(MY_REQUESTS_SEED);
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ title: '', description: '', date: '', duration: '3 hours', zone: ZONES[0].name });
  const [err, setErr] = useState('');
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  const onNav = (id) => (id.startsWith('/') ? navigate(id) : setTab(id));
  const stats = useMemo(() => ({
    active: reqs.filter((r) => r.stage === 'active').length,
    pending: reqs.filter((r) => ['pending', 'claimed', 'key_retrieved'].includes(r.stage)).length,
    done: reqs.filter((r) => r.stage === 'completed').length,
  }), [reqs]);
  const shown = reqs.filter((r) => r.title.toLowerCase().includes(q.toLowerCase()));

  const submit = (e) => {
    e.preventDefault();
    if (form.title.trim().length < 4) return setErr('Give your session a descriptive title.');
    if (!form.date || form.date < today) return setErr('Choose a date today or later.');
    setErr('');
    const d = new Date(form.date + 'T00:00');
    setReqs([{ id: `req-${Date.now()}`, title: form.title.trim(), date: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }), keyholder: 'Awaiting Keyholder', zone: form.zone, estEnd: `~${form.duration}`, stage: 'pending' }, ...reqs]);
    setForm({ title: '', description: '', date: '', duration: '3 hours', zone: ZONES[0].name });
    setTab('overview');
    onToast?.('ok', 'Request submitted. 8 Keyholders notified immediately.');
  };

  const cancel = (id) => {
    setReqs((rs) => rs.filter((r) => r.id !== id));
    onToast?.('ok', 'Request cancelled.');
  };

  const advanceDemo = (id) => {
    setReqs((rs) => rs.map((r) => (r.id === id ? { ...r, stage: 'completed', estEnd: 'Completed' } : r)));
    onToast?.('ok', 'Session marked complete.');
  };

  return (
    <AppShell nav={NAV} active={tab} onNav={onNav} roleLabel={profile?.role} onSearch={setQ}
      title={tab === 'new' ? 'New Access Request' : `Welcome back, ${profile?.full_name?.split(' ')[0] || 'Maker'}`}
      subtitle={tab === 'new' ? 'A Keyholder will claim this and contact you to arrange the session. A Keyholder must be on site for every session.' : `${profile?.student_id} · track your sessions and request new bench time.`}
      actions={tab === 'overview' && <button className="btn-primary" onClick={() => setTab('new')}><Plus size={16} /> New Request</button>}
    >
      {tab === 'overview' && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile icon="Zap" tone="ok" value={stats.active} label="Active session" />
            <StatTile icon="Hourglass" tone="warn" value={stats.pending} label="Awaiting Keyholder" />
            <StatTile icon="CheckCircle2" tone="info" value={stats.done} label="Completed" />
            <StatTile icon="Clock" tone="brand" value="14.5h" label="Bench hours this term" />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
            <section aria-label="My requests" className="space-y-4">
              <h2 className="font-display text-lg font-bold text-white">My Requests</h2>
              {!shown.length && <Empty icon="Inbox" title="No requests found" sub="Create one to get started." />}
              {shown.map((r) => (
                <article key={r.id} className="card-dark p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display font-semibold text-white">{r.title}</h3>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-300">
                        <span className="flex items-center gap-1.5"><Icon name="Calendar" size={12} />{r.date}</span>
                        <span className="flex items-center gap-1.5"><Icon name="MapPin" size={12} />{r.zone}</span>
                        <span className="flex items-center gap-1.5"><Icon name="Key" size={12} />{r.keyholder}</span>
                        <span className="flex items-center gap-1.5"><Icon name="Clock" size={12} />{r.estEnd}</span>
                      </div>
                    </div>
                    <span className={`${STAGE_CHIP[r.stage]} chip`}>{STAGE_LABEL[r.stage]}</span>
                  </div>
                  <Stepper stage={r.stage} />
                  {r.stage === 'pending' && <div className="mt-4 flex items-center justify-between gap-3"><span className="text-xs text-ink-300">Awaiting a Keyholder to claim this request</span><button onClick={() => cancel(r.id)} className="btn-outline btn-sm !border-bad/40 !text-bad hover:!bg-bad/10">Cancel</button></div>}
                  {r.stage === 'active' && <div className="mt-4 flex justify-end"><button onClick={() => advanceDemo(r.id)} className="btn-outline-brand btn-sm">Mark finished</button></div>}
                </article>
              ))}
            </section>

            <section className="card-dark h-fit p-5" aria-label="Live floor">
              <div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold text-white">Live Floor</h2><span className="chip-ok chip">Open</span></div>
              <IsoFloor zones={ZONES} dark labels={false} />
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                {ZONES.map((z) => <div key={z.id} className="flex items-center justify-between rounded-lg bg-ink-900 px-3 py-2"><span className="flex items-center gap-2 text-ink-200"><span className="h-2 w-2 rounded-full" style={{ background: z.color }} />{z.letter} · {z.short}</span><span className="text-[10px] font-bold uppercase" style={{ color: STATE_COLOR[z.status] }}>{ZONE_STATUS_LABEL[z.status]}</span></div>)}
              </div>
            </section>
          </div>
        </>
      )}

      {tab === 'new' && (
        <form onSubmit={submit} className="card-dark mx-auto max-w-2xl space-y-5 p-6" noValidate>
          <div><label className="mb-1.5 block text-xs font-semibold text-ink-200" htmlFor="t">Session title *</label><input id="t" className="field-dark" placeholder="e.g. PCB Etching — MPPT Controller Rev 2" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><label className="mb-1.5 block text-xs font-semibold text-ink-200" htmlFor="d">What will you do? Machines &amp; materials</label><textarea id="d" rows={4} className="field-dark resize-none" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid gap-5 sm:grid-cols-3">
            <div><label className="mb-1.5 block text-xs font-semibold text-ink-200" htmlFor="dt">Preferred date *</label><input id="dt" type="date" min={today} className="field-dark [color-scheme:dark]" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div><label className="mb-1.5 block text-xs font-semibold text-ink-200" htmlFor="du">Duration</label><select id="du" className="field-dark" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })}>{DURATIONS.map((d) => <option key={d}>{d}</option>)}</select></div>
            <div><label className="mb-1.5 block text-xs font-semibold text-ink-200" htmlFor="z">Zone</label><select id="z" className="field-dark" value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })}>{ZONES.map((z) => <option key={z.id}>{z.name}</option>)}</select></div>
          </div>
          {err && <div role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-xs font-medium text-bad">{err}</div>}
          <div className="flex justify-end gap-3"><button type="button" className="btn-ghost-dark" onClick={() => setTab('overview')}>Cancel</button><button className="btn-primary"><Send size={15} /> Submit Request</button></div>
        </form>
      )}
    </AppShell>
  );
}
