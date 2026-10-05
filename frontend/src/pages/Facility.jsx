import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, LayoutGrid } from 'lucide-react';
import IsoFloor, { FLOOR_LEGEND } from '../components/IsoFloor';
import { Icon } from '../components/ui';
import { ZONES, ZONE_STATUS_CHIP, ZONE_STATUS_LABEL } from '../data/mock';

export default function Facility() {
  const [active, setActive] = useState(null);
  const [hover, setHover] = useState(null);
  const z = ZONES.find((x) => x.id === active);
  const totals = ZONES.reduce((a, x) => ({ used: a.used + x.used, cap: a.cap + x.cap }), { used: 0, cap: 0 });

  return (
    <div className="pt-24">
      <div className="mx-auto max-w-7xl px-5 pb-20 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4 pt-6">
          <div>
            <h1 className="font-display text-4xl font-bold text-white">Makerspace Floor Plan</h1>
            <p className="mt-1.5 text-sm text-ink-300">Real-time workbench allocation and facility layout.</p>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-ink-900 px-4 py-2 text-xs font-semibold text-white">
            <span className="pulse-dot h-2 w-2 rounded-full bg-ok" /> Live view · {totals.used}/{totals.cap} benches in use
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="card h-fit p-3">
            <button onClick={() => setActive(null)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold ${!active ? 'bg-brand-500/15 text-brand-400' : 'text-ink-200 hover:bg-white/5'}`}>
              <LayoutGrid size={16} /> All Zones
            </button>
            <ul className="mt-1">
              {ZONES.map((x, i) => (
                <li key={x.id}>
                  <button
                    onClick={() => setActive(active === x.id ? null : x.id)}
                    onMouseEnter={() => setHover(x.id)} onMouseLeave={() => setHover(null)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition ${active === x.id ? 'bg-brand-500/15 text-brand-400' : 'text-ink-200 hover:bg-white/5'}`}
                  >
                    <span className="w-4 text-xs text-ink-300">{i + 1}</span>
                    <span className="flex-1">{x.name}</span>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: x.color }} />
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-ink-900 to-ink-950 p-4 md:p-8">
            <div className="bg-blueprint absolute inset-0 opacity-70" />
            <div className="card absolute right-4 top-4 z-10 hidden p-3 sm:block" aria-label="Legend">
              {FLOOR_LEGEND.map((l) => (
                <div key={l.label} className="flex items-center gap-2 py-0.5 text-[11px] font-medium text-ink-200"><span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />{l.label}</div>
              ))}
            </div>
            <div className="relative"><IsoFloor dark zones={ZONES} activeId={active} onSelect={(id) => setActive((a) => (a === id ? null : id))} hoverId={hover} onHover={setHover} /></div>
          </section>
        </div>

        {z && (
          <section className="card animate-rise mt-6 grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center" aria-live="polite">
            <div>
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full" style={{ background: z.color }} />
                <h2 className="font-display text-xl font-bold text-white">{z.name}</h2>
                <span className={`${ZONE_STATUS_CHIP[z.status]} chip`}>{ZONE_STATUS_LABEL[z.status]}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {z.machines.map((m) => <span key={m} className="chip-light chip"><Icon name="Wrench" size={11} />{m}</span>)}
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="font-display text-3xl font-bold text-white">{z.used}<span className="text-ink-300">/{z.cap}</span></div>
                <div className="text-xs text-ink-300">benches occupied</div>
              </div>
              <Link to="/dashboard" className="btn-primary">Request access <ArrowRight size={15} /></Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
