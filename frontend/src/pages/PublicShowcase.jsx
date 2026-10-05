import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Play } from 'lucide-react';
import { motion } from 'framer-motion';
import { Icon, Reveal, SectionTitle, StatBadge } from '../components/ui';
import { STATE_COLOR } from '../components/IsoFloor';
import { ProjectArt, WallSign, WorkshopBackdrop } from '../components/Art';
import Intro, { INTRO_OPEN_AT, shouldPlayIntro } from '../components/Intro';
import { fmtRange, HOURS, PROJECTS, ZONES, ZONE_STATUS_LABEL } from '../data/mock';

const STATS = [
  { icon: 'Rocket', value: 24, label: 'Projects Completed' },
  { icon: 'KeyRound', value: 8, label: 'Active Keyholders' },
  { icon: 'Users', value: 140, suffix: '+', label: 'Registered Users' },
  { icon: 'Layers', value: ZONES.length, label: 'Workbench Zones' },
];

const rise = (i = 0, d = 0) => ({ initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay: 0.1 + i * 0.1 + d, ease: [0.16, 1, 0.3, 1] } });

const StatsBar = ({ dark = true }) => (
  <div className={`grid grid-cols-2 gap-x-6 gap-y-6 rounded-2xl border p-6 md:grid-cols-4 md:divide-x ${dark ? 'glass md:divide-white/10' : 'border-white/10 bg-ink-900 shadow-xl shadow-ink-900/5 md:divide-white/10'}`}>
    {STATS.map((s, i) => (
      <div key={s.label} className={i ? 'md:pl-6' : ''}><StatBadge {...s} dark={dark} /></div>
    ))}
  </div>
);

/* ---------- 1. Cinematic ---------- */
const Cinematic = ({ delay = 0 }) => (
  <section className="relative isolate min-h-[100svh] overflow-hidden">
    <WorkshopBackdrop />
    <div className="relative mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-end px-5 pb-10 pt-32 md:px-8">
      <div className="grid items-center gap-10 pb-14 lg:grid-cols-[1.25fr_1fr]">
        <div>
          <motion.div {...rise(0, delay)} className="font-mono text-xs font-semibold uppercase tracking-[.3em] text-ink-200">University of Ruhuna - Faculty of Engineering</motion.div>
          <motion.h1 {...rise(1, delay)} className="h-hero mt-3 text-[clamp(3.2rem,9vw,7.5rem)] text-white"><span className="forge" role="text" aria-label="Makerspace">{[...'Makerspace'].map((ch, i) => <span key={i} className="forge-l" style={{ '--i': i, '--intro': `${delay}s` }} aria-hidden="true">{ch}</span>)}</span></motion.h1>
          <motion.div {...rise(2, delay)} className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1 font-display text-sm font-semibold uppercase tracking-[.25em] text-white">
            {['Ideas', 'Prototypes', 'People', 'Impact'].map((w, i) => (
              <React.Fragment key={w}>{i > 0 && <span className="text-brand-500">•</span>}<span>{w}</span></React.Fragment>
            ))}
          </motion.div>
          <motion.p {...rise(3, delay)} className="mt-6 max-w-lg text-[15px] leading-relaxed text-ink-200">
            A student-run fabrication lab and innovation hub. Open to all engineering students with a valid access request.
          </motion.p>
          <motion.div {...rise(4, delay)} className="mt-8 flex flex-wrap gap-3">
            <Link to="/join" className="btn-primary">Request Access <ArrowRight size={16} /></Link>
            <Link to="/projects" className="btn-ghost-dark"><Play size={14} className="fill-white" /> View Projects</Link>
          </motion.div>
        </div>
        <motion.div {...rise(3, delay)} className="hidden justify-self-end lg:block">
          <WallSign className="text-right text-[clamp(2.6rem,5.2vw,4.6rem)]" />
        </motion.div>
      </div>
      <motion.div {...rise(5, delay)}><StatsBar dark /></motion.div>
    </div>
  </section>
);

/* ---------- shared lower sections ---------- */
/** Opening hours card; "Open now" is computed from the real clock against HOURS. */
const OperationalStatus = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);
  const today = HOURS[now.getDay()];
  const h = now.getHours() + now.getMinutes() / 60;
  const open = !!today.range && h >= today.range[0] && h < today.range[1];
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <div className="card h-full p-6">
      <h3 className="font-display text-lg font-bold text-white">Operational Status</h3>
      <div className={`mt-3 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold ${open ? 'bg-ok/15 text-ok' : 'bg-bad/15 text-bad'}`}>
        <span className={`h-2 w-2 rounded-full ${open ? 'pulse-dot bg-ok' : 'bg-bad'}`} /> {open ? 'Open Now' : 'Closed Now'}
      </div>
      <ul className="mt-5 divide-y divide-white/[.06]">
        {order.map((d) => {
          const isToday = d === now.getDay();
          return (
            <li key={d} className={`flex items-center justify-between py-2.5 text-sm ${isToday ? 'font-semibold' : ''}`}>
              <span className={isToday ? 'text-brand-400' : 'text-ink-300'}>{HOURS[d].day}{isToday ? ' (today)' : ''}</span>
              <span className={HOURS[d].range ? 'text-ok' : 'text-ink-400'}>{fmtRange(HOURS[d].range)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const STEPS = [
  { icon: 'UserPlus', title: 'Join', text: 'Register with your student ID and tell us what you want to build.' },
  { icon: 'FileSignature', title: 'Sign the agreement', text: 'Read the operational procedures and digitally sign your liability shield.' },
  { icon: 'CalendarCheck', title: 'Request access', text: 'Submit a session request. A Keyholder claims it and meets you at the door.' },
  { icon: 'Hammer', title: 'Build', text: 'Use the zones, machines and mentors. Return the key, log the outcome.' },
];

const Lower = () => (
  <>
    <section className="py-20 md:py-24">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <Reveal><SectionTitle eyebrow="Live status" title="Is the space open? Which benches are free?" sub="Opening hours and zone availability, updated as Keyholders open and close sessions." /></Reveal>
        <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <Reveal><OperationalStatus /></Reveal>
          <Reveal delay={0.08}>
            <div className="card h-full p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h3 className="font-display text-lg font-bold text-white">Floor Plan — Zone Availability</h3><p className="text-xs text-ink-300">Live bench allocation status</p></div>
                <Link to="/facility" className="text-xs font-semibold text-brand-400 hover:underline">Open 3D floor plan →</Link>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {ZONES.map((z) => (
                  <Link to="/facility" key={z.id} className="rounded-xl border border-white/10 bg-ink-900 p-3 transition hover:-translate-y-0.5 hover:border-brand-500/50">
                    <div className="flex items-center gap-2 font-display text-sm font-bold text-white"><span className="h-2 w-2 rounded-full" style={{ background: z.color }} />Zone {z.letter}</div>
                    <div className="mt-0.5 text-xs text-ink-200">{z.short}</div>
                    <div className="mt-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: STATE_COLOR[z.status] }}>{ZONE_STATUS_LABEL[z.status]}</div>
                  </Link>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>

    <section className="py-20 md:py-24">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <Reveal><SectionTitle eyebrow="How it works" title="From sign-up to first build in four steps" /></Reveal>
        <ol className="mt-12 grid gap-5 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.08}>
              <li className="card relative h-full list-none p-6">
                <span className="absolute right-5 top-4 font-display text-5xl font-bold text-ink-700">0{i + 1}</span>
                <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500 text-white"><Icon name={s.icon} size={20} /></span>
                <h3 className="font-display text-lg font-bold text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-300">{s.text}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>

    <section className="py-20 md:py-24">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Reveal><SectionTitle eyebrow="Showcase" title="Recent Projects" /></Reveal>
          <Link to="/projects" className="btn-outline">View all <ArrowRight size={15} /></Link>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PROJECTS.slice(0, 6).map((p, i) => (
            <Reveal key={p.id} delay={(i % 3) * 0.08}>
              <Link to="/projects" className="card group block h-full overflow-hidden transition hover:-translate-y-1 hover:border-brand-500/40">
                <ProjectArt icon={p.icon} hue={p.hue} className="h-40 w-full" />
                <div className="p-5">
                  <div className="eyebrow !text-[10px]">{p.cat}</div>
                  <div className="mt-1.5 font-display font-bold text-white">{p.title}</div>
                  <p className="mt-1.5 line-clamp-2 text-sm text-ink-300">{p.desc}</p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>

    <section className="relative overflow-hidden py-20">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_80%_at_50%_120%,rgba(255,90,31,.4),transparent)]" />
      <Reveal className="relative mx-auto max-w-3xl px-5 text-center">
        <h2 className="h-hero text-4xl text-white md:text-6xl">Make something <span className="text-brand-500">real</span></h2>
        <p className="mx-auto mt-5 max-w-lg text-ink-200">Your next prototype is one agreement and one request away.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/join" className="btn-primary">Join Makerspace <ArrowRight size={16} /></Link>
          <Link to="/guidelines" className="btn-ghost-dark">Read the guidelines</Link>
        </div>
      </Reveal>
    </section>
  </>
);

export default function Landing() {
  // Opening animation: front page only, once per browser session.
  const [intro, setIntro] = useState(shouldPlayIntro);
  return (
    <>
      {intro && <Intro onDone={() => setIntro(false)} />}
      <Cinematic delay={intro ? INTRO_OPEN_AT : 0} />
      <Lower />
    </>
  );
}
