import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Gear } from './Art';

export const INTRO_OPEN_AT = 1.7; // seconds until the shutters start opening (hero entrance is delayed by this)

// Module-level flag: the intro plays on every fresh page load of the front page, but not again when the
// visitor navigates around the app and comes back to Home. (A full refresh resets it.)
let played = false;
export const shouldPlayIntro = () => !played || new URLSearchParams(window.location.search).has('intro'); // /?intro always replays

/**
 * Front-page opening: logo draws itself, progress counts to 100, then two shutters part to reveal the hero.
 * onDone fires after the shutters are fully open so the parent can unmount it.
 */
export default function Intro({ onDone }) {
  const [pct, setPct] = useState(0);
  const [open, setOpen] = useState(false);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    played = true;
    onDone();
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const t0 = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / (INTRO_OPEN_AT * 1000 - 150));
      setPct(Math.round(100 * (1 - Math.pow(1 - p, 2.2))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const tOpen = setTimeout(() => setOpen(true), INTRO_OPEN_AT * 1000);
    const tDone = setTimeout(finish, INTRO_OPEN_AT * 1000 + 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(tOpen);
      clearTimeout(tDone);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const half = 'absolute inset-x-0 h-1/2 bg-ink-950 overflow-hidden';
  const ease = [0.77, 0, 0.18, 1];

  return (
    <div className="fixed inset-0 z-[100]" role="presentation" onClick={() => { setOpen(true); setTimeout(finish, 800); }} aria-hidden="true">
      {/* shutters */}
      <motion.div className={`${half} top-0`} animate={{ y: open ? '-101%' : 0 }} transition={{ duration: 0.9, ease }}>
        <div className="bg-blueprint absolute inset-0 opacity-70" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_100%_at_50%_100%,rgba(255,90,31,.22),transparent_70%)]" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-brand-500/70 shadow-[0_0_18px_2px_rgba(255,90,31,.8)]" />
      </motion.div>
      <motion.div className={`${half} bottom-0`} animate={{ y: open ? '101%' : 0 }} transition={{ duration: 0.9, ease }}>
        <div className="bg-blueprint absolute inset-0 opacity-70" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgba(255,90,31,.22),transparent_70%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-brand-500/70 shadow-[0_0_18px_2px_rgba(255,90,31,.8)]" />
      </motion.div>

      <Gear className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin-slow text-brand-500/15" size={640} />

      {/* centre content */}
      <motion.div className="absolute inset-0 flex flex-col items-center justify-center" animate={{ opacity: open ? 0 : 1, scale: open ? 1.08 : 1 }} transition={{ duration: 0.45 }}>
        <svg width="112" height="112" viewBox="0 0 40 40" fill="none" className="intro-logo drop-shadow-[0_0_18px_rgba(255,90,31,.6)]">
          <path pathLength="1" d="M20 2.5 35.2 11.2v17.6L20 37.5 4.8 28.8V11.2L20 2.5Z" stroke="#ff5a1f" strokeWidth="1.6" strokeLinejoin="round" />
          <circle pathLength="1" cx="20" cy="20" r="6.2" stroke="#ff5a1f" strokeWidth="1.6" />
          <path pathLength="1" d="M20 9v3.4M20 27.6V31M9.8 14.5l3 1.7M27.2 23.8l3 1.7M9.8 25.5l3-1.7M27.2 16.2l3-1.7" stroke="#ff5a1f" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <div className="intro-word mt-7 font-display text-lg font-bold uppercase text-white">Makerspace</div>
        <div className="mt-1 font-mono text-[10px] uppercase tracking-[.35em] text-ink-300">University of Ruhuna</div>

        <div className="mt-9 h-px w-56 overflow-hidden bg-white/10">
          <div className="h-full bg-brand-500 shadow-[0_0_12px_2px_rgba(255,90,31,.8)]" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-3 flex w-56 justify-between font-mono text-[10px] uppercase tracking-[.2em] text-ink-400">
          <span>Initialising</span><span className="tabular-nums text-brand-400">{String(pct).padStart(3, '0')}</span>
        </div>
        <div className="absolute bottom-8 font-mono text-[10px] uppercase tracking-[.25em] text-ink-500">Click to skip</div>
      </motion.div>
    </div>
  );
}
