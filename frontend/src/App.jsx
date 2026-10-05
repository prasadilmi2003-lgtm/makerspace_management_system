import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import LiabilityAgreement from './pages/LiabilityAgreement';
import Dashboard from './pages/Dashboard';
import ProtectedRoute from './components/ProtectedRoute';

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      
      {/* Needs auth, but allows pending signatures */}
      <Route element={<ProtectedRoute />}>
        <Route path="/onboarding/sign" element={<LiabilityAgreement />} />
      </Route>

      {/* Needs auth AND active status */}
      <Route element={<ProtectedRoute requiredStatus="Active" />}>
        <Route path="/dashboard" element={<Dashboard />} />
        {/* We can add role-specific routes later, e.g., <Route element={<ProtectedRoute allowedRoles={['Keyholder', 'Superadmin']} />} /> */}
      </Route>
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
