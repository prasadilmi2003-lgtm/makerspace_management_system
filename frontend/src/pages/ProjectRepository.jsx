import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Empty } from '../components/ui';
import { ProjectArt } from '../components/Art';
import { PROJECTS, PROJECT_CATS, PROJECT_YEARS } from '../data/mock';
import { useAuth } from '../context/AuthContext';

const STATUSES = ['All', 'Active', 'Completed'];
const statusChip = (s) => (s === 'Active' ? 'chip-ok' : 'chip-mute');

export default function ProjectRepository() {
  const { profile } = useAuth();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [year, setYear] = useState('');
  const [status, setStatus] = useState('All');
  const [open, setOpen] = useState(null);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return PROJECTS.filter((p) => (!needle || `${p.title} ${p.desc} ${p.team}`.toLowerCase().includes(needle))
      && (!cat || p.cat === cat) && (!year || p.year === year) && (status === 'All' || p.status === status));
  }, [q, cat, year, status]);
  const selected = PROJECTS.find((p) => p.id === open);

  return (
    <div className="pt-24">
      <div className="mx-auto max-w-7xl px-5 pb-20 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-5 pt-6">
          <div>
            <h1 className="font-display text-4xl font-bold text-white">Project Repository</h1>
            <p className="mt-1.5 text-sm text-ink-300">Full archive of completed and active Makerspace projects.</p>
          </div>
          <span className="chip-ok chip"><span className="pulse-dot h-1.5 w-1.5 rounded-full bg-ok" /> {list.length} Project{list.length === 1 ? '' : 's'}</span>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <div className="relative min-w-60 flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300" />
            <input className="field pl-10" placeholder="Search projects by title, team, or keyword…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search projects" />
          </div>
          <select className="field !w-auto" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
            <option value="">All Categories</option>
            {PROJECT_CATS.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="field !w-auto" value={year} onChange={(e) => setYear(e.target.value)} aria-label="Year">
            <option value="">All Years</option>
            {PROJECT_YEARS.map((y) => <option key={y}>{y}</option>)}
          </select>
          <Link to={profile ? '/dashboard' : '/login'} className="btn-primary hidden sm:inline-flex"><Plus size={15} /> Submit Project</Link>
        </div>

        <div className="mt-5 flex gap-2.5" role="tablist" aria-label="Project status">
          {STATUSES.map((s) => (
            <button key={s} role="tab" aria-selected={status === s} onClick={() => setStatus(s)}
              className={`rounded-full border px-5 py-2 text-[13px] font-semibold transition ${status === s ? 'border-brand-500 bg-brand-500 text-white shadow-[0_6px_18px_-6px_rgba(255,90,31,.7)]' : 'border-white/10 bg-ink-900 text-ink-200 hover:border-brand-500/50 hover:text-white'}`}>
              {s}
            </button>
          ))}
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
              <button key={p.id}
                onClick={() => setOpen(p.id)} className="card group flex animate-rise flex-col overflow-hidden text-left transition hover:-translate-y-1 hover:border-brand-500/40">
                <ProjectArt icon={p.icon} hue={p.hue} className="h-40 w-full" />
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-center justify-between">
                    <span className="eyebrow !text-[10px]">{p.cat}</span>
                    <span className={`${statusChip(p.status)} chip`}>{p.status}</span>
                  </div>
                  <div className="mt-2 font-display font-bold text-white">{p.title}</div>
                  <p className="mt-1.5 line-clamp-3 flex-1 text-sm leading-relaxed text-ink-300">{p.desc}</p>
                  <div className="mt-4 flex justify-between border-t border-white/10 pt-3 text-xs text-ink-300"><span>{p.team}</span><span className="font-mono">{p.year}</span></div>
                </div>
              </button>
            ))}
        </div>
        {!list.length && <div className="mt-8"><Empty icon="SearchX" title="No projects match" sub="Try adjusting your search or filter." /></div>}
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(null)}>
            <motion.div role="dialog" aria-modal="true" aria-label={selected.title} onClick={(e) => e.stopPropagation()} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} className="card w-full max-w-lg overflow-hidden">
              <div className="relative">
                <ProjectArt icon={selected.icon} hue={selected.hue} className="h-44 w-full" />
                <button onClick={() => setOpen(null)} className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white hover:bg-black/80" aria-label="Close"><X size={16} /></button>
              </div>
              <div className="p-6">
                <div className="flex gap-1.5"><span className="chip-brand chip">{selected.cat}</span><span className={`${statusChip(selected.status)} chip`}>{selected.status}</span></div>
                <h3 className="mt-3 font-display text-2xl font-bold text-white">{selected.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-300">{selected.desc}</p>
                <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                  <div><dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Team</dt><dd className="mt-1 text-ink-100">{selected.team}</dd></div>
                  <div><dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Year</dt><dd className="mt-1 font-mono text-ink-100">{selected.year}</dd></div>
                </dl>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
