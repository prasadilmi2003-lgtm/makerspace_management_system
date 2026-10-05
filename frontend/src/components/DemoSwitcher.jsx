import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ROLE_HOME = {
  public: '/',
  pending: '/onboarding/sign',
  user: '/dashboard',
  keyholder: '/keyholder',
  kh_penalty: '/keyholder',
  admin: '/admin',
};

const OPTIONS = [
  ['public', 'Public Visitor'],
  ['pending', 'New Student (Pending)'],
  ['user', 'Student — Shaminda'],
  ['keyholder', 'Keyholder — Kasun'],
  ['kh_penalty', 'Keyholder — Ruwan (Penalty)'],
  ['admin', 'Superadmin'],
];

/** Preview-mode role switcher: lets reviewers walk every role without a Supabase backend. */
export default function DemoSwitcher({ dark = true }) {
  const { demoRole, setDemoMode } = useAuth();
  const navigate = useNavigate();

  const onChange = (e) => {
    setDemoMode(e.target.value);
    navigate(ROLE_HOME[e.target.value] || '/');
  };

  return (
    <label
      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
        dark ? 'border-white/15 bg-white/5 text-ink-200' : 'border-ink-100 bg-ink-50 text-ink-500'
      }`}
    >
      <Sparkles size={13} className="text-brand-500" aria-hidden="true" />
      <span className="hidden font-mono text-[10px] uppercase tracking-wider sm:inline">Demo view</span>
      <select
        value={demoRole}
        onChange={onChange}
        aria-label="Switch demo role"
        className={`cursor-pointer bg-transparent text-xs font-semibold outline-none ${dark ? 'text-white' : 'text-ink-800'}`}
      >
        {OPTIONS.map(([v, l]) => (
          <option key={v} value={v} className="bg-ink-900 text-white">{l}</option>
        ))}
      </select>
    </label>
  );
}
