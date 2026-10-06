import React, { useCallback, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase, supabaseConfigured } from '../services/supabase';
import { AGREEMENT_DATE, AGREEMENT_SECTIONS, AGREEMENT_VERSION } from '../data/agreement';

const FLOW = ['Register', 'Review Agreement', 'Digital Signature', 'Complete'];

const Ring = ({ pct }) => {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative mx-auto h-36 w-36">
      <svg viewBox="0 0 120 120" className="-rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#1b2230" strokeWidth="9" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="#ff5a1f" strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} style={{ transition: 'stroke-dashoffset .3s' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-display text-3xl font-bold text-white">{pct}%</div>
    </div>
  );
};

const norm = (s) => s.trim().replace(/\s+/g, ' ').toLowerCase();

/** readOnly = public /guidelines view of the same document (no signing panel). */
export default function LiabilityAgreement({ readOnly = false, onToast }) {
  const { profile, user, setDemoMode, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const boxRef = useRef(null);
  const [pct, setPct] = useState(0);
  const [current, setCurrent] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [name, setName] = useState('');
  const [sid, setSid] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const targetName = profile?.full_name || '';
  const targetId = profile?.student_id || '';
  const nameOk = !!targetName && norm(name) === norm(targetName);
  const idOk = !!targetId && sid.trim().replace(/\s/g, '').toUpperCase() === targetId.replace(/\s/g, '').toUpperCase();
  const read = pct >= 98;
  const canSign = read && confirmed && nameOk && idOk && !busy;
  const step = readOnly || !read ? 1 : 2;

  const onScroll = useCallback(() => {
    const el = boxRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setPct(max <= 0 ? 100 : Math.min(100, Math.round((el.scrollTop / max) * 100)));
    const secs = [...el.querySelectorAll('[data-sec]')];
    let idx = 0;
    secs.forEach((s, i) => { if (s.offsetTop - el.offsetTop <= el.scrollTop + 80) idx = i; });
    setCurrent(idx);
  }, []);

  const jump = (i) => {
    const el = boxRef.current;
    const s = el?.querySelectorAll('[data-sec]')[i];
    if (el && s) el.scrollTo({ top: s.offsetTop - el.offsetTop - 12, behavior: 'smooth' });
  };

  const sign = async (e) => {
    e.preventDefault();
    if (!canSign) return;
    setBusy(true);
    setError('');
    try {
      if (supabaseConfigured && user && !String(user.id).startsWith('usr-')) {
        const { data: ver, error: vErr } = await supabase.from('procedure_versions').select('id').eq('active', true).single();
        if (vErr) throw vErr;
        const { error: rpcErr } = await supabase.rpc('sign_liability', {
          p_procedure_version_id: ver.id, p_signed_name: targetName, p_signed_student_id: targetId, p_ip_address: null,
        });
        if (rpcErr) throw rpcErr;
        await refreshProfile();
      } else {
        setDemoMode('user');
      }
      onToast?.('ok', 'Operational agreement signed & logged. Access granted!');
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Could not record your signature. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pt-24">
      <div className="mx-auto max-w-7xl px-5 pb-20 md:px-8">
        <ol className="mx-auto mt-4 hidden max-w-3xl items-center md:flex" aria-label="Onboarding progress">
          {FLOW.map((l, i) => (
            <li key={l} className="flex flex-1 items-center last:flex-none" aria-current={i === step ? 'step' : undefined}>
              <span className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold ${i < step ? 'border-brand-500 bg-brand-500 text-white' : i === step ? 'border-brand-500 bg-brand-500 text-white' : 'border-white/20 bg-ink-900 text-ink-300'}`}>
                {i < step ? <Check size={14} /> : i + 1}
              </span>
              <span className={`ml-2 text-xs font-semibold ${i <= step ? 'text-white' : 'text-ink-300'}`}>{l}</span>
              {i < FLOW.length - 1 && <span className={`mx-3 h-px flex-1 ${i < step ? 'bg-brand-500' : 'bg-ink-200'}`} />}
            </li>
          ))}
        </ol>

        <div className={`mt-8 grid gap-5 ${readOnly ? 'lg:grid-cols-[250px_1fr]' : 'lg:grid-cols-[250px_1fr_320px]'}`}>
          <nav className="card h-fit p-3" aria-label="Document sections">
            <ul>
              {AGREEMENT_SECTIONS.map((s, i) => (
                <li key={s.title}>
                  <button onClick={() => jump(i)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition ${current === i ? 'bg-brand-500/15 text-brand-400' : 'text-ink-200 hover:bg-white/5'}`}>
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${pct >= ((i + 1) / AGREEMENT_SECTIONS.length) * 100 - 5 ? 'bg-brand-500 text-white' : 'bg-ink-700 text-ink-300'}`}>{i + 1}</span>
                    {s.title.replace(/^\d+\.\s*/, '')}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <section className="card flex flex-col overflow-hidden">
            <header className="border-b border-white/10 p-6">
              <h1 className="font-display text-2xl font-bold text-white">Makerspace Operational Procedures</h1>
              <p className="mt-1 text-xs text-ink-300">Version {AGREEMENT_VERSION.slice(1)} · Updated {AGREEMENT_DATE}</p>
            </header>
            <div ref={boxRef} onScroll={onScroll} tabIndex={0} aria-label="Agreement text" className="h-[560px] overflow-y-auto scroll-smooth p-6 pr-5">
              {AGREEMENT_SECTIONS.map((s, i) => (
                <article key={s.title} data-sec className="mb-8">
                  <h2 className="font-display text-lg font-bold text-white">{s.title}</h2>
                  <p className="mt-2 text-[14.5px] leading-7 text-ink-200">{s.body}</p>
                  {i === 3 && (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-[14px] text-ink-200">
                      <li>Always wear appropriate personal protective equipment (PPE).</li>
                      <li>Follow machine-specific safety instructions posted at each zone.</li>
                      <li>Report any unsafe condition to the Keyholder immediately.</li>
                    </ul>
                  )}
                </article>
              ))}
            </div>
            <footer className="border-t border-white/10 bg-ink-900 p-4">
              <label className={`flex items-center gap-3 text-sm ${readOnly ? 'opacity-50' : 'cursor-pointer'}`}>
                <input type="checkbox" className="h-4 w-4 accent-brand-500" disabled={!read || readOnly} checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                <span className="text-ink-200">I have read and understood the entire document <b className="text-brand-400">({pct}%)</b></span>
              </label>
            </footer>
          </section>

          {!readOnly && (
            <form onSubmit={sign} className="card h-fit p-6 text-center" noValidate>
              <Ring pct={pct} />
              <div className="mt-2 text-xs text-ink-300">{read ? 'Document read completely' : 'Keep scrolling to read the document'}</div>

              {!supabaseConfigured && profile && (
                <div className="mt-5 rounded-lg border border-brand-500/30 bg-brand-500/10 p-3 text-left text-xs text-ink-200">
                  Demo credentials — Name: <b className="text-white">{targetName}</b> · Student ID: <b className="text-white">{targetId}</b>
                </div>
              )}
              <div className="mt-6 space-y-4 text-left">
                <div>
                  <label className="field-label" htmlFor="sn">Type your full legal name</label>
                  <input id="sn" className="field" placeholder={targetName || 'Enter full legal name'} value={name} onChange={(e) => setName(e.target.value)} disabled={!read} autoComplete="off" />
                  {name && !nameOk && <p className="mt-1 text-[11px] text-bad">Must match your registered name{targetName ? ` (${targetName})` : ''}.</p>}
                </div>
                <div>
                  <label className="field-label" htmlFor="si">Type your Student ID</label>
                  <input id="si" className="field" placeholder={targetId || 'EG/2022/5311'} value={sid} onChange={(e) => setSid(e.target.value)} disabled={!read} autoComplete="off" />
                  {sid && !idOk && <p className="mt-1 text-[11px] text-bad">Must match your registered Student ID.</p>}
                </div>
              </div>

              {error && <div role="alert" className="mt-4 rounded-lg bg-bad/10 px-3 py-2 text-left text-xs font-medium text-bad">{error}</div>}
              {!profile && <p className="mt-4 text-xs text-ink-300"><Link to="/login" className="font-semibold text-brand-400">Log in</Link> to sign.</p>}
              <button className="btn-primary mt-6 w-full" disabled={!canSign}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />} Continue to Signature {!busy && <ArrowRight size={15} />}
              </button>
              <p className="mt-3 text-[11px] leading-snug text-ink-300">Your name, student ID and timestamp are stored as an immutable record.</p>
            </form>
          )}
        </div>

        {readOnly && !profile && (
          <div className="card mx-auto mt-8 flex max-w-3xl flex-wrap items-center justify-between gap-4 p-6">
            <div><div className="font-display font-bold text-white">Ready to start building?</div><div className="text-sm text-ink-300">Join, then sign this agreement digitally to activate access.</div></div>
            <Link to="/join" className="btn-primary">Join Makerspace <ArrowRight size={15} /></Link>
          </div>
        )}
      </div>
    </div>
  );
}
