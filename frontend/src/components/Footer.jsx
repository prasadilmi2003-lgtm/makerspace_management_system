import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, MapPin, Clock } from 'lucide-react';
import { Logo } from './ui';
import { useAuth } from '../context/AuthContext';

export default function Footer() {
  const { profile } = useAuth();
  return (
    <footer id="contact" className="border-t border-white/10 bg-ink-950/70 text-ink-300 backdrop-blur-sm">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr_1fr_1.2fr] md:px-8">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed">
            A student-driven space for turning ideas into real-world solutions. Faculty of Engineering, University of Ruhuna.
          </p>
        </div>
        <div>
          <h4 className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[.2em] text-white">Explore</h4>
          <ul className="space-y-2.5 text-sm">
            <li><Link to="/projects" className="hover:text-brand-400">Project Repository</Link></li>
            <li><Link to="/facility" className="hover:text-brand-400">Facility Floor Plan</Link></li>
            <li><Link to="/guidelines" className="hover:text-brand-400">Operational Guidelines</Link></li>
            {!profile && <li><Link to="/join" className="hover:text-brand-400">Join the Community</Link></li>}
          </ul>
        </div>
        <div>
          <h4 className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[.2em] text-white">Account</h4>
          <ul className="space-y-2.5 text-sm">
            <li><Link to="/login" className="hover:text-brand-400">Log in</Link></li>
            <li><Link to="/dashboard" className="hover:text-brand-400">Student Dashboard</Link></li>
            <li><Link to="/keyholder" className="hover:text-brand-400">Keyholder Operations</Link></li>
            <li><Link to="/admin" className="hover:text-brand-400">Administration</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[.2em] text-white">Contact</h4>
          <ul className="space-y-3 text-sm">
            <li className="flex gap-2.5"><MapPin size={16} className="mt-0.5 shrink-0 text-brand-500" /> Dept. of Mechanical &amp; Manufacturing Eng., Hapugala, Galle</li>
            <li className="flex gap-2.5"><Mail size={16} className="shrink-0 text-brand-500" /> makerspace@eng.ruh.ac.lk</li>
            <li className="flex gap-2.5"><Clock size={16} className="shrink-0 text-brand-500" /> Mon–Fri · 9:00 – 17:00, Keyholder on site</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/5 py-5 text-center text-xs text-ink-400">
        © 2026 University of Ruhuna · Makerspace Management System · Operational Agreement v2.4
      </div>
    </footer>
  );
}
