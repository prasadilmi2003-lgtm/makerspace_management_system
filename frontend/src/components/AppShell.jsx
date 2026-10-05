import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu, Search, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Avatar, Icon, Logo, initialsOf } from './ui';
import { AmbientBackdrop } from './Art';
import DemoSwitcher from './DemoSwitcher';

const useClock = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  return now;
};

/**
 * Dark dashboard chrome (sidebar + top bar) used by the student, keyholder and admin screens.
 * nav: [{ id, label, icon, badge?, section? }]
 */
export default function AppShell({ nav, active, onNav, title, subtitle, children, roleLabel, actions, onSearch }) {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const now = useClock();

  const side = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Logo />
        <button className="text-ink-300 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X size={20} /></button>
      </div>
      <nav className="scroll-dark flex-1 overflow-y-auto px-3 py-3" aria-label="Dashboard">
        {nav.map((item, i) => (
          <React.Fragment key={item.id}>
            {item.section && (
              <div className={`px-3 pb-2 font-mono text-[10px] font-semibold uppercase tracking-[.2em] text-ink-400 ${i ? 'mt-6' : ''}`}>{item.section}</div>
            )}
            <button
              onClick={() => { onNav(item.id); setOpen(false); }}
              aria-current={active === item.id ? 'page' : undefined}
              className={`group mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition ${
                active === item.id
                  ? 'bg-brand-500/15 text-brand-400 ring-1 ring-brand-500/40'
                  : 'text-ink-200 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon name={item.icon} size={17} className={active === item.id ? 'text-brand-500' : 'text-ink-300 group-hover:text-white'} />
              <span className="flex-1">{item.label}</span>
              {item.badge ? <span className="rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{item.badge}</span> : null}
            </button>
          </React.Fragment>
        ))}
      </nav>
      <div className="border-t border-white/[.07] p-3">
        <button
          onClick={async () => { await logout(); navigate('/'); }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-brand-400 hover:bg-brand-500/10"
        >
          <LogOut size={17} /> Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative isolate min-h-screen text-ink-100">
      <AmbientBackdrop />
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-white/[.07] bg-ink-900 lg:block">{side}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-ink-900">{side}</aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/[.07] bg-ink-950/85 px-4 backdrop-blur-xl md:px-8">
          <button className="text-ink-200 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={22} /></button>
          <div className="relative hidden max-w-md flex-1 md:block">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input className="field-dark !py-2 pl-9 text-[13px]" placeholder="Search requests, users, machines…" onChange={(e) => onSearch?.(e.target.value)} aria-label="Search" />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-[11px] text-ink-300">{now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div>
              <div className="font-display text-sm font-semibold text-white">{now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            <DemoSwitcher />
            <button className="relative rounded-lg p-2 text-ink-200 hover:bg-white/5" aria-label="Notifications">
              <Bell size={18} />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-500" />
            </button>
            <div className="flex items-center gap-2.5">
              <Avatar initials={initialsOf(profile?.full_name || 'U')} size={34} />
              <div className="hidden leading-tight lg:block">
                <div className="text-[13px] font-semibold text-white">{profile?.full_name?.split(' ')[0] || 'Guest'}</div>
                <div className="text-[11px] text-ink-300">{roleLabel}</div>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1400px] px-4 py-7 md:px-8">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-white md:text-3xl">{title}</h1>
              {subtitle && <p className="mt-1 text-sm text-ink-300">{subtitle}</p>}
            </div>
            {actions}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

/** Dashboard stat tile (reference screen 8: icon tile + big number + label). */
export const StatTile = ({ icon, tone = 'brand', value, label, sub }) => {
  const tones = {
    brand: 'bg-brand-500/15 text-brand-500', ok: 'bg-ok/15 text-ok', bad: 'bg-bad/15 text-bad', info: 'bg-info/15 text-info', warn: 'bg-warn/15 text-warn',
  };
  return (
    <div className="card-dark flex items-center gap-4 p-5">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}><Icon name={icon} size={22} /></span>
      <div className="min-w-0">
        <div className="font-display text-3xl font-bold leading-none text-white">{value}</div>
        <div className={`mt-1 text-xs font-medium ${tones[tone].split(' ')[1]}`}>{label}</div>
        {sub && <div className="mt-0.5 text-[11px] text-ink-400">{sub}</div>}
      </div>
    </div>
  );
};
