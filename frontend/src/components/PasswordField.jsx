import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// Password input with a show/hide toggle (hidden by default) and an inline validation message.
export default function PasswordField({ id, label, value, onChange, error, placeholder = '••••••••', autoComplete, hint }) {
  const [visible, setVisible] = useState(false);
  const errId = `${id}-err`;
  return (
    <div>
      <label className="field-label" htmlFor={id}>{label}</label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className={`field pr-11 ${error ? '!border-bad' : ''}`}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errId : undefined}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-ink-300 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      {error ? <p id={errId} role="alert" className="mt-1.5 text-xs font-medium text-bad">{error}</p>
        : hint ? <p className="mt-1.5 text-xs text-ink-300">{hint}</p> : null}
    </div>
  );
}
