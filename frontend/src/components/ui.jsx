import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Activity, AlarmClock, Armchair, BadgeCheck, Bot, Box, Calendar, CalendarCheck, Car, ChartColumn, CircuitBoard, CheckCircle2,
  ClipboardList, Clock, Cog, Cpu, Droplets, FilePlus2, FileSignature, FileText, Flame, FlaskConical, FolderKanban, Hammer,
  Hourglass, Inbox, Key, KeyRound, Layers, LayoutDashboard, Lightbulb, Map, MapPin, OctagonAlert, Package, PackageSearch,
  PenTool, Plane, Power, Rocket, ScrollText, SearchX, ShieldAlert, ShieldCheck, Sprout, SunMedium, Timer, TriangleAlert,
  User, UserPlus, UserSearch, Users, Wrench, Zap,
  Printer, Waves, Settings, BatteryCharging, Wind, Bike, Ruler,
} from 'lucide-react';

// Icons are referenced by string in data files / props; keep this map explicit so the bundle stays tree-shaken.
const ICONS = {
  Activity, AlarmClock, Armchair, BadgeCheck, Bot, Box, Calendar, CalendarCheck, Car, ChartColumn, CircuitBoard, CheckCircle2,
  ClipboardList, Clock, Cog, Cpu, Droplets, FilePlus2, FileSignature, FileText, Flame, FlaskConical, FolderKanban, Hammer,
  Hourglass, Inbox, Key, KeyRound, Layers, LayoutDashboard, Lightbulb, Map, MapPin, OctagonAlert, Package, PackageSearch,
  PenTool, Plane, Power, Rocket, ScrollText, SearchX, ShieldAlert, ShieldCheck, Sprout, SunMedium, Timer, TriangleAlert,
  User, UserPlus, UserSearch, Users, Wrench, Zap,
  Printer, Waves, Settings, BatteryCharging, Wind, Bike, Ruler,
};

export const Icon = ({ name, ...props }) => {
  const C = ICONS[name] || Box;
  return <C {...props} />;
};

/** Hexagon-with-gear brand mark, matching the reference. */
export const Logo = ({ dark = true, size = 34, withText = true, to = '/' }) => (
  <Link to={to} className="group flex items-center gap-2.5" aria-label="Makerspace home">
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <path d="M20 2.5 35.2 11.2v17.6L20 37.5 4.8 28.8V11.2L20 2.5Z" stroke="#ff5a1f" strokeWidth="2.4" strokeLinejoin="round" />
      <circle cx="20" cy="20" r="6.2" stroke="#ff5a1f" strokeWidth="2.4" />
      <g stroke="#ff5a1f" strokeWidth="2.4" strokeLinecap="round">
        <path d="M20 9v3.4M20 27.6V31M9.8 14.5l3 1.7M27.2 23.8l3 1.7M9.8 25.5l3-1.7M27.2 16.2l3-1.7" />
      </g>
    </svg>
    {withText && (
      <span className={`font-display text-[15px] font-bold tracking-[.14em] ${dark ? 'text-white' : 'text-ink-900'}`}>
        MAKERSPACE
      </span>
    )}
  </Link>
);

export const Avatar = ({ initials, size = 32, hue = 20 }) => (
  <span
    className="inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold text-white ring-2 ring-white/10"
    style={{ width: size, height: size, fontSize: size * 0.36, background: `linear-gradient(135deg, hsl(${hue} 80% 55%), hsl(${hue + 40} 70% 35%))` }}
  >
    {initials}
  </span>
);

export const AvatarStack = ({ list = [], size = 26 }) => (
  <div className="flex -space-x-2">
    {list.slice(0, 4).map((p, i) => <Avatar key={p + i} initials={p} size={size} hue={(i * 57 + 12) % 360} />)}
  </div>
);

export const initialsOf = (name = '') => name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export const Reveal = ({ children, delay = 0, className = '' }) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y: 22 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-60px' }}
    transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
  >
    {children}
  </motion.div>
);

/** Animated count-up number. */
export const CountUp = ({ to, suffix = '' }) => {
  const [n, setN] = React.useState(0);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / 1100);
        setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to]);
  return <span ref={ref}>{n}{suffix}</span>;
};

export const StatBadge = ({ icon, value, suffix, label, dark = true }) => (
  <div className="flex items-center gap-4">
    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${dark ? 'border-brand-500/40 bg-brand-500/10' : 'border-brand-200 bg-brand-50'} text-brand-500`}>
      <Icon name={icon} size={22} />
    </span>
    <div>
      <div className={`font-display text-3xl font-bold leading-none ${dark ? 'text-white' : 'text-ink-900'}`}>
        <CountUp to={value} suffix={suffix} />
      </div>
      <div className={`mt-1 text-xs ${dark ? 'text-ink-300' : 'text-ink-400'}`}>{label}</div>
    </div>
  </div>
);

export const SectionTitle = ({ eyebrow, title, sub, dark = true, center = false }) => (
  <div className={center ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
    {eyebrow && <div className="eyebrow mb-3">{eyebrow}</div>}
    <h2 className={`font-display text-3xl font-bold md:text-4xl ${dark ? 'text-white' : 'text-ink-900'}`}>{title}</h2>
    {sub && <p className={`mt-3 text-[15px] leading-relaxed ${dark ? 'text-ink-300' : 'text-ink-400'}`}>{sub}</p>}
  </div>
);

export const Empty = ({ icon = 'Inbox', title, sub, dark = true }) => (
  <div className={`flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-12 text-center ${dark ? 'border-white/10 text-ink-300' : 'border-ink-100 text-ink-400'}`}>
    <Icon name={icon} size={30} className="mb-3 text-brand-500" />
    <div className={`font-display font-semibold ${dark ? 'text-white' : 'text-ink-800'}`}>{title}</div>
    {sub && <p className="mt-1 text-sm">{sub}</p>}
  </div>
);
