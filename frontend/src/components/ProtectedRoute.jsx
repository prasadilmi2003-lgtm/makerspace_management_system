import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const HOME = { Pending: '/onboarding/sign', User: '/dashboard', Alumni: '/dashboard', Keyholder: '/keyholder', Superadmin: '/admin' };

/**
 * Gate a route group. Works for both real Supabase sessions and the demo-role switcher
 * because both end up as `profile`.
 */
export default function ProtectedRoute({ allowedRoles }) {
  const { profile, loading } = useAuth();

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-ink-950 text-sm text-ink-300">Loading session…</div>;
  }
  if (!profile) return <Navigate to="/login" replace />;
  if (profile.status === 'Pending_Signature') return <Navigate to="/onboarding/sign" replace />;
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to={HOME[profile.role] || '/'} replace />;
  }
  return <Outlet />;
}
