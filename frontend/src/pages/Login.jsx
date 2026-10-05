import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useAuth, MOCK_PROFILES } from '../context/AuthContext';
import { supabaseConfigured } from '../services/supabase';
import { WorkshopBackdrop } from '../components/Art';

const HOME = { Pending: '/onboarding/sign', User: '/dashboard', Alumni: '/dashboard', Keyholder: '/keyholder', Superadmin: '/admin' };
const QUICK = [['user', 'Student'], ['keyholder', 'Keyholder'], ['admin', 'Superadmin']];

export default function Login({ onToast }) {
  const { login, setDemoMode } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { error: err } = await login(email.trim(), password);
      if (err) throw err;
      onToast?.('ok', 'Logged in successfully.');
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Could not sign in. Check your email and password.');
    } finally {
      setBusy(false);
    }
  };

  const enterDemo = (key) => {
    setDemoMode(key);
    onToast?.('ok', `Previewing as ${MOCK_PROFILES[key].full_name}.`);
    navigate(HOME[MOCK_PROFILES[key].role]);
  };

  return (
    <div className="relative isolate grid min-h-screen place-items-center overflow-hidden px-5 pb-12 pt-24">
      <WorkshopBackdrop />
      <div className="card animate-rise relative w-full max-w-md p-8">
        <div className="eyebrow">University of Ruhuna</div>
        <h1 className="mt-2 font-display text-2xl font-bold text-white">Sign in to Makerspace</h1>
        <p className="mt-1 text-sm text-ink-300">Access requests, sessions and your project history.</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div><label className="field-label" htmlFor="le">University email</label><input id="le" type="email" required className="field" placeholder="you@eng.ruh.ac.lk" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
          <div><label className="field-label" htmlFor="lp">Password</label><input id="lp" type="password" required className="field" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></div>
          {error && <div role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-xs font-medium text-bad">{error}</div>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : null} Sign in {!busy && <ArrowRight size={15} />}</button>
        </form>

        {!supabaseConfigured && (
          <div className="mt-6 rounded-xl border border-dashed border-brand-500/40 bg-brand-500/15 p-4">
            <div className="text-xs font-semibold text-brand-300">Preview mode — no backend connected</div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {QUICK.map(([k, l]) => <button key={k} type="button" onClick={() => enterDemo(k)} className="btn-outline btn-sm">{l}</button>)}
            </div>
          </div>
        )}
        <p className="mt-6 text-center text-xs text-ink-300">New here? <Link to="/join" className="font-semibold text-brand-400 hover:underline">Join the Makerspace</Link></p>
      </div>
    </div>
  );
}
