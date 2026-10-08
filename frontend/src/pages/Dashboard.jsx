import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Loader2, Plus, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApi, useQuery } from '../context/ApiContext';
import AppShell, { StatTile } from '../components/AppShell';
import { Empty, Icon } from '../components/ui';
import { DURATIONS, STAGES, STAGE_CHIP, STAGE_LABEL, ZONES } from '../data/mock';
import { benchesOf, BENCH_STATUS_LABEL, initialBenchStatus } from '../data/floor';
import FloorPicker from '../components/FloorPicker';

const NAV = [
  { id: 'overview', label: 'Dashboard', icon: 'LayoutDashboard', section: 'My Makerspace' },
  { id: 'new', label: 'New Request', icon: 'FilePlus2' },
  { id: '/projects', label: 'Projects', icon: 'FolderKanban' },
  { id: '/guidelines', label: 'Agreement', icon: 'ShieldCheck', section: 'Account' },
];

const fmtDate = (iso) => (iso ? new Date(`${iso}T00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '—');
const fmtHours = (mins) => (mins % 60 ? `${(mins / 60).toFixed(1)}h` : `${mins / 60}h`);
const zoneName = (id) => ZONES.find((z) => z.id === id)?.name || 'No zone chosen';
const endText = (r) => {
  if (r.stage === 'completed') return `Completed · ${fmtHours(r.durationMins)}`;
  if (r.estimatedEnd) return `Ends ${new Date(r.estimatedEnd).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  return `~${fmtHours(r.durationMins)}`;
};

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
  const api = useApi();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const preZone = ZONES.find((z) => z.id === params.get('zone'));
  const preBench = /^[A-H][1-4]$/.test(params.get('bench') || '') ? params.get('bench') : '';

  // Alumni have read-only access (the database refuses new requests from them), so hide everything that creates one.
  const canRequest = profile?.role !== 'Alumni';
  const [tab, setTab] = useState(preZone && canRequest ? 'new' : 'overview');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const statusMap = useMemo(() => initialBenchStatus(), []);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState({
    title: preZone ? `${preBench ? `Bench ${preBench} — ` : ''}${preZone.short} session` : '',
    description: preBench ? `Requesting workbench ${preBench} in ${preZone.name}.` : '',
    date: '', duration: '3 hours', zoneId: (preZone || ZONES[0]).id, bench: preBench,
  });

  const { data: reqs, loading, error } = useQuery((a) => a.listMyRequests(), 'mine');
  const list = useMemo(() => reqs || [], [reqs]);
  const shown = list.filter((r) => r.title.toLowerCase().includes(q.toLowerCase()));
  const stats = useMemo(() => ({
    active: list.filter((r) => r.stage === 'active').length,
    pending: list.filter((r) => ['pending', 'claimed', 'key_retrieved'].includes(r.stage)).length,
    done: list.filter((r) => r.stage === 'completed').length,
    mins: list.filter((r) => r.stage === 'completed').reduce((a, r) => a + r.durationMins, 0),
  }), [list]);

  const onNav = (id) => (id.startsWith('/') ? navigate(id) : setTab(id));
  const warn = (e) => onToast?.('warn', e.message);

  const submit = async (e) => {
    e.preventDefault();
    if (form.title.trim().length < 4) return setErr('Give your session a descriptive title.');
    if (!form.date || form.date < today) return setErr('Choose a date today or later.');
    setErr('');
    setBusy(true);
    try {
      await api.createRequest({ ...form, title: form.title.trim() });
      setForm({ title: '', description: '', date: '', duration: '3 hours', zoneId: ZONES[0].id, bench: '' });
      setTab('overview');
      onToast?.('ok', 'Request submitted. Keyholders have been notified.');
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id) => {
    try { await api.cancelRequest(id); onToast?.('ok', 'Request cancelled.'); } catch (ex) { warn(ex); }
  };

  const zoneBenches = benchesOf(ZONES.find((z) => z.id === form.zoneId) || ZONES[0]);
  const blocked = profile?.status === 'Suspended';

  return (
    <AppShell nav={canRequest ? NAV : NAV.filter((n) => n.id !== 'new')} active={tab} onNav={onNav} roleLabel={profile?.role} onSearch={setQ}
      title={tab === 'new' ? 'New Access Request' : `Welcome back, ${profile?.full_name?.split(' ')[0] || 'Maker'}`}
      subtitle={tab === 'new' ? 'Pick a zone or bench on the floor, then describe your session. A Keyholder claims it and meets you there.' : `${profile?.student_id} · track your sessions and request new bench time.`}
      actions={tab === 'overview' && canRequest && <button className="btn-primary" onClick={() => setTab('new')}><Plus size={16} /> New Request</button>}
    >
      {tab === 'overview' && (
        <>
          {!canRequest && <div className="mb-6 rounded-xl border border-white/10 bg-ink-900/70 p-4 text-sm text-ink-200">Alumni accounts have read-only access: you can browse the project archive and your past sessions, but new requests are disabled.</div>}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile icon="Zap" tone="ok" value={stats.active} label="Active session" />
            <StatTile icon="Hourglass" tone="warn" value={stats.pending} label="Awaiting Keyholder" />
            <StatTile icon="CheckCircle2" tone="info" value={stats.done} label="Completed" />
            <StatTile icon="Clock" tone="brand" value={fmtHours(stats.mins)} label="Bench hours logged" />
          </div>

          <div className="mt-6">
            <section aria-label="My requests" className="space-y-4">
              <h2 className="font-display text-lg font-bold text-white">My Requests</h2>
              {loading && <div className="card-dark flex items-center gap-3 p-5 text-sm text-ink-300"><Loader2 size={16} className="animate-spin" /> Loading your requests…</div>}
              {error && <div role="alert" className="rounded-xl border border-bad/30 bg-bad/10 p-4 text-sm text-bad">{error}</div>}
              {!loading && !error && !shown.length && <Empty icon="Inbox" title="No requests found" sub="Create one to get started." />}
              {shown.map((r) => (
                <article key={r.id} className={`card-dark p-5 ${r.stage === 'cancelled' ? 'opacity-60' : ''}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display font-semibold text-white">{r.title}</h3>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-300">
                        <span className="flex items-center gap-1.5"><Icon name="Calendar" size={12} />{fmtDate(r.date)}</span>
                        <span className="flex items-center gap-1.5"><Icon name="MapPin" size={12} />{zoneName(r.zoneId)}{r.bench ? ` · ${r.bench}` : ''}</span>
                        <span className="flex items-center gap-1.5"><Icon name="Key" size={12} />{r.keyholderName || 'Awaiting Keyholder'}</span>
                        <span className="flex items-center gap-1.5"><Icon name="Clock" size={12} />{endText(r)}</span>
                      </div>
                    </div>
                    <span className={`${r.overdue ? 'chip-bad' : STAGE_CHIP[r.stage]} chip`}>{r.overdue ? 'Overdue' : STAGE_LABEL[r.stage]}</span>
                  </div>
                  {r.stage !== 'cancelled' && <Stepper stage={r.stage} />}
                  {r.stage === 'pending' && (
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="text-xs text-ink-300">Awaiting a Keyholder to claim this request</span>
                      <button onClick={() => cancel(r.id)} className="btn-outline btn-sm !border-bad/40 !text-bad hover:!bg-bad/10">Cancel</button>
                    </div>
                  )}
                </article>
              ))}
            </section>
          </div>
        </>
      )}

      {tab === 'new' && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="card-dark overflow-hidden" aria-label="Choose a zone or bench on the floor">
            <FloorPicker
              className="h-[52vh] min-h-[400px] xl:h-[calc(100vh-15rem)] xl:min-h-[560px]"
              zones={ZONES} statusMap={statusMap} zoneId={form.zoneId} bench={form.bench}
              onPick={({ zoneId, bench }) => setForm((f) => ({ ...f, zoneId, bench }))}
            />
          </section>

          <form onSubmit={submit} className="card-dark h-fit space-y-5 p-6" noValidate>
            {blocked && <div role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-xs font-medium text-bad">Your account is suspended. Contact an administrator.</div>}

            <div className="rounded-xl border border-brand-500/30 bg-brand-500/10 p-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-400">Selected</div>
              <div className="mt-1 font-display font-bold text-white">{(ZONES.find((z) => z.id === form.zoneId) || ZONES[0]).name}{form.bench ? ` · Bench ${form.bench}` : ''}</div>
              {form.bench && statusMap[form.bench] !== 'available' && (
                <p className="mt-1 text-xs text-ink-200">Bench {form.bench} is {BENCH_STATUS_LABEL[statusMap[form.bench]].toLowerCase()} right now. Your session is for a later time, so you can still request it.</p>
              )}
            </div>

            <div><label className="mb-1.5 block text-xs font-semibold text-ink-200" htmlFor="t">Session title *</label><input id="t" className="field-dark" placeholder="e.g. PCB Etching — MPPT Controller Rev 2" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><label className="mb-1.5 block text-xs font-semibold text-ink-200" htmlFor="d">What will you do? Machines &amp; materials</label><textarea id="d" rows={3} className="field-dark resize-none" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="mb-1.5 block text-xs font-semibold text-ink-200" htmlFor="dt">Preferred date *</label><input id="dt" type="date" min={today} className="field-dark [color-scheme:dark]" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div><label className="mb-1.5 block text-xs font-semibold text-ink-200" htmlFor="du">Duration</label><select id="du" className="field-dark" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })}>{DURATIONS.map((d) => <option key={d}>{d}</option>)}</select></div>
              <div><label className="mb-1.5 block text-xs font-semibold text-ink-200" htmlFor="z">Zone</label><select id="z" className="field-dark" value={form.zoneId} onChange={(e) => setForm({ ...form, zoneId: e.target.value, bench: '' })}>{ZONES.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select></div>
              <div><label className="mb-1.5 block text-xs font-semibold text-ink-200" htmlFor="b">Bench (optional)</label><select id="b" className="field-dark" value={form.bench} onChange={(e) => setForm({ ...form, bench: e.target.value })}><option value="">Any bench</option>{zoneBenches.map((b) => <option key={b.label} value={b.label}>{b.label} · {BENCH_STATUS_LABEL[statusMap[b.label]]}</option>)}</select></div>
            </div>
            {err && <div role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-xs font-medium text-bad">{err}</div>}
            <div className="flex justify-end gap-3"><button type="button" className="btn-ghost-dark" onClick={() => setTab('overview')}>Cancel</button><button className="btn-primary" disabled={busy || blocked}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Submit Request</button></div>
          </form>
        </div>
      )}
    </AppShell>
  );
}
