import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ allowedRoles = [], requiredStatus = null }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />;
  }

  // Check status
  if (requiredStatus && profile.status !== requiredStatus) {
    // If they need to sign liability but aren't on that page
    if (profile.status === 'Pending_Signature' || profile.status === 'Requires_Reagreement') {
      return <Navigate to="/onboarding/sign" replace />;
    }
    // If they need to be active but are pending
    if (requiredStatus === 'Active' && profile.status !== 'Active') {
       return <Navigate to="/onboarding/sign" replace />;
    }
  }

  // Check roles
  if (allowedRoles.length > 0 && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />; // or an unauthorized page
  }

  return <Outlet />;
};

export default ProtectedRoute;
