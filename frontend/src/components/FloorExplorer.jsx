import React, { Suspense, lazy, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Box as BoxIcon, Crosshair, Eye, LayoutGrid, Lock, MousePointer2, Users as UsersIcon } from 'lucide-react';
import IsoFloor from './IsoFloor';
import { Icon } from './ui';
import { useAuth } from '../context/AuthContext';
import { HOURS, ZONES } from '../data/mock';
import {
  BENCH_STATUS_CHIP, BENCH_STATUS_COLOR, BENCH_STATUS_LABEL, benchesOf, initialBenchStatus, zoneByLabel, zoneStatusFrom,
} from '../data/floor';

// three.js is heavy: only load it when this page is opened.
const FloorScene = lazy(() => import('./FloorScene'));

const FILTERS = [['all', 'All'], ['available', 'Available'], ['occupied', 'In use'], ['reserved', 'Reserved']];
const VIEWS = [['overview', 'Overview', BoxIcon], ['top', 'Top plan', LayoutGrid], ['zone', 'Focus zone', Crosshair]];

const hasWebGL = () => {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
};

class SceneBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

const SceneSkeleton = () => (
  <div className="flex h-full flex-col items-center justify-center gap-4 text-ink-300">
    <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-brand-500" />
    <div className="font-mono text-[11px] uppercase tracking-[.25em]">Building 3D floor…</div>
  </div>
);

/**
 * The interactive 3D floor with zone list, filters, bench details and keyholder controls.
 * embedded = used inside a dashboard (no "request this bench" links, which would leave the portal).
 */
export default function FloorExplorer({ onToast, embedded = false }) {
  const { profile } = useAuth();
  const canManage = ['Keyholder', 'Superadmin'].includes(profile?.role);
  const [webgl] = useState(hasWebGL);

  const [statusMap, setStatusMap] = useState(initialBenchStatus);
  const [selZone, setSelZone] = useState(null);
  const [selBench, setSelBench] = useState(null);
  const [hover, setHover] = useState(null);
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('overview');
  const [nonce, setNonce] = useState(0);
  const [labels, setLabels] = useState(true);
  const [people, setPeople] = useState(true);

  const zone = ZONES.find((z) => z.id === selZone);
  const counts = useMemo(() => {
    const c = { available: 0, occupied: 0, reserved: 0 };
    Object.values(statusMap).forEach((s) => { c[s] += 1; });
    return c;
  }, [statusMap]);
  const total = counts.available + counts.occupied + counts.reserved;
  const nextFree = useMemo(() => {
    for (const z of ZONES) for (const b of benchesOf(z)) if (statusMap[b.label] === 'available') return { z, b };
    return null;
  }, [statusMap]);

  const today = HOURS[new Date().getDay()];
  const hour = new Date().getHours();
  const open = !!today.range && hour >= today.range[0] && hour < today.range[1];

  const focus = (id) => {
    setSelZone(id);
    setSelBench(null);
    setView(id ? 'zone' : 'overview');
    setNonce((n) => n + 1);
  };
  const onSelectZone = (id) => focus(id === selZone ? null : id);
  const onSelectBench = (label) => {
    const z = zoneByLabel(label);
    setSelBench(label);
    if (selZone !== z.id) { setSelZone(z.id); setView('zone'); setNonce((n) => n + 1); }
  };
  const goView = (v) => {
    if (v === 'zone' && !zone) return;
    setView(v);
    setNonce((n) => n + 1);
  };
  const setBench = (label, status) => {
    setStatusMap((m) => ({ ...m, [label]: status }));
    onToast?.('ok', `Bench ${label} marked ${BENCH_STATUS_LABEL[status].toLowerCase()}.`);
  };

  const fallback = (
    <div className="p-6">
      <div className="mb-4 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">3D is unavailable on this device, showing the 2D plan instead.</div>
      <IsoFloor dark zones={ZONES.map((z) => ({ ...z, status: zoneStatusFrom(z, statusMap) }))} activeId={selZone} onSelect={(id) => onSelectZone(id)} />
    </div>
  );

  const requestLink = (b) => `/dashboard?zone=${zone?.id || zoneByLabel(b).id}&bench=${b}`;

  return (
    <div>
      <div>
        <div className="flex flex-wrap items-center justify-end gap-4">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-ink-900/80 px-4 py-2 text-xs font-semibold text-white backdrop-blur">
            <span className={`h-2 w-2 rounded-full ${open ? 'pulse-dot bg-ok' : 'bg-bad'}`} /> {open ? 'Open now' : 'Closed now'} · {counts.occupied}/{total} benches in use
          </div>
        </div>

        <div className="mt-4 grid gap-6 xl:grid-cols-[250px_minmax(0,1fr)_330px]">
          {/* ---------------- left: filter + zone list ---------------- */}
          <aside className="space-y-4">
            <div className="card p-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                {['available', 'occupied', 'reserved'].map((s) => (
                  <div key={s} className="rounded-lg bg-ink-900/70 py-2">
                    <div className="font-display text-xl font-bold" style={{ color: BENCH_STATUS_COLOR[s] }}>{counts[s]}</div>
                    <div className="text-[10px] uppercase tracking-wider text-ink-300">{BENCH_STATUS_LABEL[s]}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-ink-700" aria-hidden="true">
                {['available', 'occupied', 'reserved'].map((s) => <div key={s} style={{ width: `${(counts[s] / total) * 100}%`, background: BENCH_STATUS_COLOR[s] }} />)}
              </div>
              <div className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Show benches</div>
              <div className="mt-2 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter benches by status">
                {FILTERS.map(([k, l]) => (
                  <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${filter === k ? 'bg-brand-500 text-white' : 'bg-ink-700 text-ink-200 hover:text-white'}`}>{l}</button>
                ))}
              </div>
            </div>

            <div className="card p-3">
              <button onClick={() => focus(null)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold ${!selZone ? 'bg-brand-500/15 text-brand-400' : 'text-ink-200 hover:bg-white/5'}`}>
                <LayoutGrid size={16} /> All Zones
              </button>
              <ul className="mt-1">
                {ZONES.map((z) => {
                  const st = zoneStatusFrom(z, statusMap);
                  const free = benchesOf(z).filter((b) => statusMap[b.label] === 'available').length;
                  return (
                    <li key={z.id}>
                      <button onClick={() => onSelectZone(z.id)} onMouseEnter={() => setHover(z.id)} onMouseLeave={() => setHover(null)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition ${selZone === z.id ? 'bg-brand-500/15 text-brand-400' : 'text-ink-200 hover:bg-white/5'}`}>
                        <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white" style={{ background: z.color }}>{z.letter}</span>
                        <span className="flex-1 truncate">{z.short}</span>
                        <span className="text-[10px] font-bold" style={{ color: BENCH_STATUS_COLOR[st] }}>{free} free</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>

          {/* ---------------- centre: 3D canvas ---------------- */}
          <section className={`relative overflow-hidden rounded-2xl border border-white/10 bg-ink-950 shadow-[0_30px_80px_-30px_rgba(0,0,0,.9)] ${embedded ? 'h-[60vh] min-h-[460px] xl:h-[calc(100vh-11rem)] xl:min-h-[580px]' : 'h-[64vh] min-h-[480px] xl:h-[calc(100vh-13rem)] xl:min-h-[620px]'}`} aria-label="3D floor model">
            {webgl ? (
              <SceneBoundary fallback={fallback}>
                <Suspense fallback={<SceneSkeleton />}>
                  <FloorScene
                    zones={ZONES} statusMap={statusMap} selectedZone={selZone} selectedBench={selBench} hoverZone={hover}
                    filter={filter} view={view} nonce={nonce} showLabels={labels} showPeople={people}
                    onSelectZone={(id) => (id ? onSelectZone(id) : focus(null))} onSelectBench={onSelectBench} onHover={setHover}
                  />
                </Suspense>
              </SceneBoundary>
            ) : fallback}

            <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-3">
              <div className="pointer-events-auto glass flex rounded-xl p-1" role="group" aria-label="Camera view">
                {VIEWS.map(([k, l, I]) => (
                  <button key={k} onClick={() => goView(k)} disabled={k === 'zone' && !zone} aria-pressed={view === k}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-35 ${view === k ? 'bg-brand-500 text-white' : 'text-ink-200 hover:text-white'}`}>
                    <I size={14} /> {l}
                  </button>
                ))}
              </div>
              <div className="pointer-events-auto glass flex rounded-xl p-1" role="group" aria-label="Display options">
                <button onClick={() => setLabels((v) => !v)} aria-pressed={labels} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${labels ? 'bg-white/10 text-white' : 'text-ink-300'}`}><Eye size={14} /> Labels</button>
                <button onClick={() => setPeople((v) => !v)} aria-pressed={people} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${people ? 'bg-white/10 text-white' : 'text-ink-300'}`}><UsersIcon size={14} /> People</button>
              </div>
            </div>
            <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap items-center gap-3 rounded-xl glass px-3 py-2 text-[11px] font-medium text-ink-100">
              {['available', 'occupied', 'reserved'].map((s) => <span key={s} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: BENCH_STATUS_COLOR[s] }} />{BENCH_STATUS_LABEL[s]}</span>)}
            </div>
            <div className="pointer-events-none absolute bottom-3 right-3 hidden items-center gap-2 rounded-xl glass px-3 py-2 text-[11px] text-ink-200 md:flex">
              <MousePointer2 size={13} className="text-brand-400" /> Drag to orbit · scroll to zoom · right-drag to pan
            </div>
          </section>

          {/* ---------------- right: detail / booking ---------------- */}
          <aside className="space-y-4" aria-live="polite">
            {!zone ? (
              <div className="card animate-rise p-5">
                <h2 className="font-display text-lg font-bold text-white">Facility summary</h2>
                <p className="mt-1 text-xs text-ink-300">Select a zone in the model or the list to see its equipment and benches.</p>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between"><dt className="text-ink-300">Today's hours</dt><dd className="font-semibold text-white">{today.range ? `${String(today.range[0]).padStart(2, '0')}:00–${String(today.range[1]).padStart(2, '0')}:00` : 'Closed'}</dd></div>
                  <div className="flex justify-between"><dt className="text-ink-300">Keyholder on duty</dt><dd className="font-semibold text-white">Kasun Jayawardena</dd></div>
                  <div className="flex justify-between"><dt className="text-ink-300">Benches free</dt><dd className="font-semibold text-ok">{counts.available} of {total}</dd></div>
                </dl>
                {nextFree && (
                  <div className="mt-5 rounded-xl border border-brand-500/30 bg-brand-500/10 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-400">Next free bench</div>
                    <div className="mt-1 font-display text-lg font-bold text-white">{nextFree.b.label} · {nextFree.z.short}</div>
                    <div className="mt-3 flex gap-2">
                      <button className="btn-outline btn-sm" onClick={() => onSelectBench(nextFree.b.label)}>Show in 3D</button>
                      {!embedded && <Link to={`/dashboard?zone=${nextFree.z.id}&bench=${nextFree.b.label}`} className="btn-primary btn-sm">Request <ArrowRight size={13} /></Link>}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="card animate-rise p-5" key={zone.id}>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: zone.color }}><Icon name={zone.icon} size={20} /></span>
                  <div>
                    <h2 className="font-display text-lg font-bold leading-tight text-white">{zone.name}</h2>
                    <span className={`${BENCH_STATUS_CHIP[zoneStatusFrom(zone, statusMap)]} chip mt-1`}>{BENCH_STATUS_LABEL[zoneStatusFrom(zone, statusMap)]}</span>
                  </div>
                </div>

                <div className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Equipment</div>
                <div className="mt-2 flex flex-wrap gap-1.5">{zone.machines.map((m) => <span key={m} className="chip-light chip">{m}</span>)}</div>

                <div className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Workbenches</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {benchesOf(zone).map((b) => {
                    const s = statusMap[b.label];
                    return (
                      <button key={b.label} onClick={() => setSelBench(selBench === b.label ? null : b.label)} aria-pressed={selBench === b.label}
                        className={`rounded-lg border px-3 py-2 text-left transition ${selBench === b.label ? 'border-white bg-white/10' : 'border-white/10 bg-ink-900/70 hover:border-white/30'}`}>
                        <div className="flex items-center justify-between"><span className="font-mono text-sm font-bold text-white">{b.label}</span><span className="h-2.5 w-2.5 rounded-full" style={{ background: BENCH_STATUS_COLOR[s] }} /></div>
                        <div className="mt-0.5 text-[11px]" style={{ color: BENCH_STATUS_COLOR[s] }}>{BENCH_STATUS_LABEL[s]}</div>
                      </button>
                    );
                  })}
                </div>

                {selBench ? (
                  <div className="mt-5 rounded-xl border border-white/10 bg-ink-900/70 p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-display font-bold text-white">Bench {selBench}</div>
                      <span className={`${BENCH_STATUS_CHIP[statusMap[selBench]]} chip`}>{BENCH_STATUS_LABEL[statusMap[selBench]]}</span>
                    </div>
                    {statusMap[selBench] === 'available' ? (
                      embedded ? <p className="mt-2 text-xs text-ink-300">This bench is free.</p> : <Link to={requestLink(selBench)} className="btn-primary mt-3 w-full">Request bench {selBench} <ArrowRight size={14} /></Link>
                    ) : (
                      <p className="mt-2 text-xs text-ink-300">{statusMap[selBench] === 'occupied' ? 'Currently in use. Check again later or pick another bench.' : 'Reserved for a booked session.'}</p>
                    )}
                    {canManage ? (
                      <div className="mt-4">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Keyholder controls</div>
                        <div className="mt-2 grid grid-cols-3 gap-1.5">
                          {['available', 'occupied', 'reserved'].map((s) => (
                            <button key={s} disabled={statusMap[selBench] === s} onClick={() => setBench(selBench, s)}
                              className="rounded-lg border border-white/10 px-1 py-1.5 text-[11px] font-semibold text-ink-100 transition hover:border-white/40 disabled:border-brand-500/60 disabled:bg-brand-500/15 disabled:text-brand-300">
                              {BENCH_STATUS_LABEL[s]}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-400"><Lock size={11} /> Only Keyholders can change bench status.</p>
                    )}
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-ink-300">Select a bench for details and booking.</p>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
