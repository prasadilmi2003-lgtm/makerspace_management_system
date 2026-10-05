import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, LogIn, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Logo } from './ui';
import DemoSwitcher from './DemoSwitcher';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/projects', label: 'Projects' },
  { to: '/facility', label: 'Facility' },
  { to: '/guidelines', label: 'Guidelines' },
];

const WORKSPACE = { user: ['/dashboard', 'My Requests'], keyholder: ['/keyholder', 'Keyholder Ops'], kh_penalty: ['/keyholder', 'Keyholder Ops'], admin: ['/admin', 'Admin'], pending: ['/onboarding/sign', 'Sign Agreement'] };

export default function Navbar() {
  const { profile, demoRole, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(() => window.scrollY > 24);

  const dark = true; // single cinematic-dark theme site-wide
  const solid = scrolled || open;

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => setOpen(false), [pathname]);

  const ws = WORKSPACE[demoRole];
  const tone = dark
    ? solid ? 'bg-ink-950/45 border-white/10 backdrop-blur-xl backdrop-saturate-150 shadow-[0_8px_30px_-12px_rgba(0,0,0,.6)]' : 'bg-white/[.03] border-white/[.06] backdrop-blur-md'
    : solid ? 'bg-white/90 border-ink-100 backdrop-blur-xl' : 'bg-white border-transparent';

  const linkCls = ({ isActive }) =>
    `relative px-1 py-2 text-[13px] font-medium transition-colors ${
      isActive ? 'text-brand-500' : dark ? 'text-ink-200 hover:text-white' : 'text-ink-500 hover:text-ink-900'
    }`;

  return (
    <header className={`fixed inset-x-0 top-0 z-50 border-b transition-all duration-300 ${tone}`}>
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-5 lg:px-8" aria-label="Primary">
        <Logo dark={dark} />

        <div className="hidden items-center gap-8 lg:flex">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkCls}>
              {({ isActive }) => (
                <>
                  {l.label}
                  {isActive && <span className="absolute inset-x-0 -bottom-[11px] h-0.5 rounded bg-brand-500" />}
                </>
              )}
            </NavLink>
          ))}
          <a href="#contact" className={`px-1 py-2 text-[13px] font-medium ${dark ? 'text-ink-200 hover:text-white' : 'text-ink-500 hover:text-ink-900'}`}>Contact</a>
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <DemoSwitcher dark={dark} />
          {ws && (
            <Link to={ws[0]} className={`text-[13px] font-semibold ${dark ? 'text-white' : 'text-ink-800'} hover:text-brand-500`}>{ws[1]}</Link>
          )}
          {profile ? (
            <button
              onClick={async () => { await logout(); navigate('/'); }}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border transition ${dark ? 'border-white/15 text-ink-200 hover:text-white' : 'border-ink-100 text-ink-500 hover:text-brand-500'}`}
              title="Log out" aria-label="Log out"
            >
              <LogOut size={16} />
            </button>
          ) : (
            <>
              <Link to="/login" className={`flex items-center gap-1.5 text-[13px] font-semibold ${dark ? 'text-white' : 'text-ink-800'} hover:text-brand-500`}>
                <LogIn size={14} /> Log in
              </Link>
              <Link to="/join" className="btn-outline-brand btn-sm !px-4">
                Join Makerspace <ArrowRight size={14} />
              </Link>
            </>
          )}
        </div>

        <button
          className={`flex h-10 w-10 items-center justify-center rounded-lg lg:hidden ${dark ? 'text-white' : 'text-ink-900'}`}
          onClick={() => setOpen((o) => !o)} aria-label="Toggle menu" aria-expanded={open}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {open && (
        <div className={`border-t px-5 pb-5 pt-3 lg:hidden ${dark ? 'border-white/10 bg-ink-950/80 backdrop-blur-xl' : 'border-ink-100 bg-white'}`}>
          <div className="flex flex-col">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `border-b py-3 text-sm font-semibold ${dark ? 'border-white/5' : 'border-ink-50'} ${isActive ? 'text-brand-500' : dark ? 'text-white' : 'text-ink-800'}`}>{l.label}</NavLink>
            ))}
            {ws && <Link to={ws[0]} className={`border-b py-3 text-sm font-semibold ${dark ? 'border-white/5 text-white' : 'border-ink-50 text-ink-800'}`}>{ws[1]}</Link>}
          </div>
          <div className="mt-4 flex flex-col gap-3">
            <DemoSwitcher dark={dark} />
            {!profile && <Link to="/join" className="btn-primary">Join Makerspace <ArrowRight size={14} /></Link>}
            {!profile && <Link to="/login" className={dark ? 'btn-ghost-dark' : 'btn-outline'}>Log in</Link>}
          </div>
        </div>
      )}
    </header>
  );
}
