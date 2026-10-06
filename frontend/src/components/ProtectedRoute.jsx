import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const HOME = { Pending: '/onboarding/sign', User: '/dashboard', Alumni: '/dashboard', Keyholder: '/keyholder', Superadmin: '/keyholder' };

/** /account: wait for the profile, then send the user to the page for their role. */
export function RoleHome() {
  const { profile, loading, user } = useAuth();
  // A session exists but its profile has not arrived yet: wait instead of bouncing to /login.
  if (loading || (user && !profile)) return <div className="grid min-h-screen place-items-center bg-ink-950 text-sm text-ink-300">Loading session…</div>;
  if (!profile) return <Navigate to="/login" replace />;
  if (profile.status === 'Pending_Signature' || profile.status === 'Requires_Reagreement') return <Navigate to="/onboarding/sign" replace />;
  return <Navigate to={HOME[profile.role] || '/'} replace />;
}

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
  if (profile.status === 'Pending_Signature' || profile.status === 'Requires_Reagreement') return <Navigate to="/onboarding/sign" replace />;
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to={HOME[profile.role] || '/'} replace />;
  }
  return <Outlet />;
}
