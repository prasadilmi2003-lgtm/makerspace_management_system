import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabaseConfigured } from '../services/supabase';
import { WorkshopBackdrop } from '../components/Art';

const STEPS = [
  { title: 'Personal Information', sub: 'Basic details about you' },
  { title: 'Academic Information', sub: 'Your department and skills' },
  { title: 'Areas of Interest', sub: 'What you want to work on' },
  { title: 'Submit Application', sub: 'Join our community' },
];
const DEPTS = ['Mechanical & Manufacturing Engineering', 'Electrical & Information Engineering', 'Civil & Environmental Engineering', 'Marine Engineering & Naval Architecture', 'Interdisciplinary / Other'];
const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const INTERESTS = ['Robotics', 'Electronics', 'Fabrication', '3D Printing', 'CNC Machining', 'Software & IoT', 'Sustainability', 'Research'];

export default function Register({ onToast }) {
  const { register, setDemoMode } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [f, setF] = useState({ full_name: '', student_id: '', email: '', phone: '', department: DEPTS[0], academic_year: YEARS[1], skills: '', interests: [], password: '', agree: false });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const toggle = (i) => setF((s) => ({ ...s, interests: s.interests.includes(i) ? s.interests.filter((x) => x !== i) : [...s.interests, i] }));

  const problem = () => {
    if (step === 0) {
      if (f.full_name.trim().length < 3) return 'Please enter your full legal name.';
      if (!/^EG\/\d{4}\/\d{3,5}$/i.test(f.student_id.trim())) return 'Student ID should look like EG/2022/5311.';
      if (!/^\S+@\S+\.\S+$/.test(f.email)) return 'Enter a valid university email address.';
    }
    if (step === 2 && !f.interests.length) return 'Pick at least one area of interest.';
    if (step === 3) {
      if (f.password.length < 8) return 'Password must be at least 8 characters.';
      if (!f.agree) return 'Please confirm the details are correct.';
    }
    return '';
  };

  const next = async (e) => {
    e.preventDefault();
    const p = problem();
    if (p) return setError(p);
    setError('');
    if (step < 3) return setStep(step + 1);

    setBusy(true);
    try {
      const { error: err } = await register(f.email.trim(), f.password, {
        full_name: f.full_name.trim(), student_id: f.student_id.trim().toUpperCase(), department: f.department, academic_year: f.academic_year,
      });
      if (err && supabaseConfigured) throw err;
      if (!supabaseConfigured) setDemoMode('pending');
      onToast?.('ok', 'Application received! Sign the operational agreement to activate access.');
      navigate('/onboarding/sign');
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative isolate min-h-screen overflow-hidden pt-16">
      <WorkshopBackdrop />
      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-10 px-5 py-12 md:px-8 lg:grid-cols-[1fr_440px]">
        <div>
          <h1 className="h-hero text-5xl text-white md:text-7xl">Join the<br /><span className="text-brand-500">Makerspace</span><br />community</h1>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-ink-200">Be part of a community that builds, innovates and creates real impact.</p>

          <ol className="mt-10 space-y-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex items-center gap-4" aria-current={i === step ? 'step' : undefined}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition ${i < step ? 'border-brand-500 bg-brand-500 text-white' : i === step ? 'border-brand-500 text-brand-500 glow-brand' : 'border-white/20 text-ink-300'}`}>
                  {i < step ? <Check size={16} /> : i + 1}
                </span>
                <div>
                  <div className={`text-sm font-semibold ${i <= step ? 'text-white' : 'text-ink-300'}`}>{s.title}</div>
                  <div className="text-xs text-ink-300">{s.sub}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <form onSubmit={next} className="card animate-rise p-7" noValidate>
          <div className="text-xs text-ink-300">Step {step + 1} of 4</div>
          <h2 className="mt-1 font-display text-xl font-bold text-white">{STEPS[step].title}</h2>
          <div className="mt-2 h-1 overflow-hidden rounded bg-ink-700"><div className="h-full rounded bg-brand-500 transition-all duration-500" style={{ width: `${(step + 1) * 25}%` }} /></div>

          <div className="mt-6 space-y-4">
            {step === 0 && (<>
              <div><label className="field-label" htmlFor="rn">Full Name *</label><input id="rn" className="field" placeholder="Enter your full legal name" value={f.full_name} onChange={set('full_name')} autoComplete="name" /></div>
              <div><label className="field-label" htmlFor="rs">Student ID *</label><input id="rs" className="field" placeholder="EG/2022/5311" value={f.student_id} onChange={set('student_id')} /></div>
              <div><label className="field-label" htmlFor="re">Email Address *</label><input id="re" type="email" className="field" placeholder="you@eng.ruh.ac.lk" value={f.email} onChange={set('email')} autoComplete="email" /></div>
              <div><label className="field-label" htmlFor="rp">Phone Number</label><input id="rp" className="field" placeholder="Optional" value={f.phone} onChange={set('phone')} autoComplete="tel" /></div>
            </>)}
            {step === 1 && (<>
              <div><label className="field-label" htmlFor="rd">Department</label><select id="rd" className="field" value={f.department} onChange={set('department')}>{DEPTS.map((d) => <option key={d}>{d}</option>)}</select></div>
              <div><label className="field-label" htmlFor="ry">Academic Year</label><select id="ry" className="field" value={f.academic_year} onChange={set('academic_year')}>{YEARS.map((d) => <option key={d}>{d}</option>)}</select></div>
              <div><label className="field-label" htmlFor="rk">Existing skills</label><textarea id="rk" rows={3} className="field resize-none" placeholder="e.g. SolidWorks, soldering, Python, TIG welding" value={f.skills} onChange={set('skills')} /></div>
            </>)}
            {step === 2 && (
              <div className="flex flex-wrap gap-2.5" role="group" aria-label="Areas of interest">
                {INTERESTS.map((i) => (
                  <button type="button" key={i} onClick={() => toggle(i)} aria-pressed={f.interests.includes(i)}
                    className={`rounded-full border px-4 py-2 text-[13px] font-semibold transition ${f.interests.includes(i) ? 'border-brand-500 bg-brand-500 text-white' : 'border-white/10 text-ink-200 hover:border-brand-500/40'}`}>{i}</button>
                ))}
              </div>
            )}
            {step === 3 && (<>
              <dl className="rounded-xl bg-ink-800 p-4 text-sm">
                {[['Name', f.full_name], ['Student ID', f.student_id.toUpperCase()], ['Email', f.email], ['Department', f.department], ['Interests', f.interests.join(', ')]].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-1"><dt className="text-ink-300">{k}</dt><dd className="text-right font-medium text-ink-100">{v}</dd></div>
                ))}
              </dl>
              <div><label className="field-label" htmlFor="rw">Create a password *</label><input id="rw" type="password" className="field" placeholder="At least 8 characters" value={f.password} onChange={set('password')} autoComplete="new-password" /></div>
              <label className="flex cursor-pointer items-start gap-3 text-xs text-ink-200"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-500" checked={f.agree} onChange={(e) => setF((s) => ({ ...s, agree: e.target.checked }))} /> I confirm these details are correct and I am a University of Ruhuna student.</label>
            </>)}
          </div>

          {error && <div role="alert" className="mt-4 rounded-lg bg-bad/10 px-3 py-2 text-xs font-medium text-bad">{error}</div>}

          <div className="mt-6 flex gap-3">
            {step > 0 && <button type="button" className="btn-outline" onClick={() => { setError(''); setStep(step - 1); }}><ArrowLeft size={15} /> Back</button>}
            <button className="btn-primary flex-1" disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : null}
              {step < 3 ? 'Next Step' : 'Submit Application'} {!busy && <ArrowRight size={15} />}
            </button>
          </div>
          <p className="mt-5 text-center text-xs text-ink-300">Already a member? <Link to="/login" className="font-semibold text-brand-400 hover:underline">Log in</Link></p>
        </form>
      </div>
    </div>
  );
}
