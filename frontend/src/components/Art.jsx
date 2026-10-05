import React from 'react';
import { Icon } from './ui';

/** Outline gear used as a hero ornament. */
export const Gear = ({ size = 360, teeth = 14, className = '' }) => {
  const r1 = 100;
  const r2 = 118;
  const pts = [];
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const w = Math.PI / teeth / 2;
    [[a - w * 1.2, r1], [a - w * 0.6, r2], [a + w * 0.6, r2], [a + w * 1.2, r1]].forEach(([ang, r]) => pts.push(`${(130 + Math.cos(ang) * r).toFixed(1)},${(130 + Math.sin(ang) * r).toFixed(1)}`));
  }
  return (
    <svg viewBox="0 0 260 260" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <polygon points={pts.join(' ')} />
      <circle cx="130" cy="130" r="78" />
      <circle cx="130" cy="130" r="28" />
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return <line key={i} x1={130 + Math.cos(a) * 28} y1={130 + Math.sin(a) * 28} x2={130 + Math.cos(a) * 78} y2={130 + Math.sin(a) * 78} />;
      })}
    </svg>
  );
};

/** Cinematic dark workshop backdrop: grid + orange glow + light strips + gears. */
export const WorkshopBackdrop = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden bg-ink-950" aria-hidden="true">
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_75%_30%,rgba(255,90,31,.28),transparent_60%),radial-gradient(ellipse_50%_40%_at_10%_90%,rgba(255,90,31,.14),transparent_60%)]" />
    <div className="bg-blueprint absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_80%_80%_at_70%_40%,#000,transparent_75%)]" />
    <div className="absolute inset-x-0 top-0 h-1/2 opacity-60">
      {[12, 30, 48, 66, 84].map((l) => (
        <span key={l} className="absolute top-[14%] h-[3px] w-28 rounded-full bg-brand-300 shadow-[0_0_28px_6px_rgba(255,122,61,.55)]" style={{ left: `${l}%`, transform: 'skewX(-30deg)' }} />
      ))}
    </div>
    <Gear className="absolute -right-24 top-10 animate-spin-slow text-brand-500/25" size={560} />
    <Gear className="absolute -bottom-24 right-[34%] animate-spin-slow text-white/[.06] [animation-direction:reverse]" size={380} teeth={10} />
    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink-950 via-ink-950/70 to-transparent" />
  </div>
);

/** Neon wall sign: MAKE / LEARN / BUILD / REPEAT */
export const WallSign = ({ className = '' }) => (
  <div className={`font-display font-bold uppercase leading-[1.08] tracking-[.18em] text-brand-300/90 [text-shadow:0_0_18px_rgba(255,90,31,.7)] ${className}`}>
    {['Make', 'Learn', 'Build', 'Repeat'].map((w) => <div key={w}>{w}</div>)}
  </div>
);

/** Light-theme architectural block for the minimal hero. */
export const BuildingArt = () => (
  <svg viewBox="0 0 520 440" className="h-auto w-full" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="gl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#dbe9ff" /><stop offset="1" stopColor="#9fc0ee" /></linearGradient>
      <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#e6e8ee" /></linearGradient>
    </defs>
    <ellipse cx="260" cy="410" rx="230" ry="18" fill="#0a0d13" opacity=".08" />
    <polygon points="70,130 270,60 270,390 70,360" fill="url(#wall)" stroke="#d3d7e0" />
    <polygon points="270,60 470,120 470,370 270,390" fill="#f2f3f7" stroke="#d3d7e0" />
    {[0, 1, 2, 3].map((r) => [0, 1, 2].map((c) => (
      <polygon key={`${r}${c}`} points={`${90 + c * 58},${160 + r * 52 - c * 9} ${136 + c * 58},${146 + r * 52 - c * 9} ${136 + c * 58},${186 + r * 52 - c * 9} ${90 + c * 58},${200 + r * 52 - c * 9}`} fill="url(#gl)" stroke="#fff" strokeWidth="2" />
    )))}
    <polygon points="296,150 450,196 450,330 296,346" fill="url(#gl)" stroke="#fff" strokeWidth="3" />
    <path d="M296 250 450 262M296 198 450 230M296 300 450 296" stroke="#fff" strokeWidth="3" />
    <polygon points="270,60 470,120 470,134 270,74" fill="#ff5a1f" />
    <polygon points="70,130 270,60 270,74 70,144" fill="#0a0d13" />
    {['IDEAS', 'PROTOTYPES', 'SKILLS', 'COMMUNITY'].map((w, i) => (
      <text key={w} x={400 + i * 4} y={90 + i * 34} fontSize="15" fontFamily="Space Grotesk" fontWeight="700" fill={i === 3 ? '#ff5a1f' : '#0a0d13'} opacity=".75" transform={`rotate(-8 ${400 + i * 4} ${90 + i * 34})`} textAnchor="middle" letterSpacing="2">{w}</text>
    ))}
    <circle cx="68" cy="352" r="26" fill="#cfe9d6" />
    <circle cx="46" cy="366" r="20" fill="#b9dcc3" />
    <rect x="66" y="360" width="4" height="40" fill="#8a6a4a" />
  </svg>
);

/** Generated project thumbnail: tinted gradient + big line icon + blueprint grid. */
export const ProjectArt = ({ icon, hue = 20, className = '' }) => (
  <div
    className={`relative flex items-center justify-center overflow-hidden ${className}`}
    style={{
      backgroundColor: `hsl(${hue} 45% 9%)`,
      backgroundImage: `radial-gradient(circle at 70% 25%, hsl(${hue} 90% 50% / .45), transparent 55%), linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)`,
      backgroundSize: 'auto, 28px 28px, 28px 28px',
    }}
  >
    <Icon name={icon} size={64} strokeWidth={1.2} className="relative text-white/90 drop-shadow-[0_6px_18px_rgba(0,0,0,.6)] transition-transform duration-500 group-hover:scale-110" />
  </div>
);

/** Fixed, low-intensity version of the hero backdrop used behind every inner page and dashboard. */
export const AmbientBackdrop = () => (
  <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink-950" aria-hidden="true">
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_45%_at_85%_0%,rgba(255,90,31,.16),transparent_65%),radial-gradient(ellipse_50%_40%_at_0%_100%,rgba(255,90,31,.10),transparent_65%)]" />
    <div className="bg-blueprint absolute inset-0 [mask-image:radial-gradient(ellipse_130%_110%_at_50%_45%,#000_45%,rgba(0,0,0,.5)_100%)]" />
    <Gear className="absolute -right-32 top-1/4 animate-spin-slow text-brand-500/[.10]" size={520} />
    <Gear className="absolute -bottom-40 -left-24 animate-spin-slow text-white/[.04] [animation-direction:reverse]" size={420} teeth={10} />
  </div>
);
