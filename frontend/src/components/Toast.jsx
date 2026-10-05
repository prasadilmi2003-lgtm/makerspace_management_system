import React from 'react';
import { CircleAlert, CircleCheck } from 'lucide-react';

export default function Toast({ toast }) {
  if (!toast?.show) return null;
  return (
    <div role="status" aria-live="polite" className="fixed bottom-6 right-6 z-[100] flex max-w-sm animate-rise items-start gap-3 rounded-xl border border-brand-500/40 bg-ink-900 px-4 py-3 text-sm text-white shadow-[0_20px_50px_-12px_rgba(0,0,0,.7)]">
      {toast.icon === 'warn' ? <CircleAlert size={18} className="mt-px shrink-0 text-warn" /> : <CircleCheck size={18} className="mt-px shrink-0 text-ok" />}
      <span className="leading-5">{toast.msg}</span>
    </div>
  );
}
