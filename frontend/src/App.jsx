import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserRouter as Router, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { AmbientBackdrop } from './components/Art';
import Toast from './components/Toast';
import ProtectedRoute from './components/ProtectedRoute';

import Landing from './pages/PublicShowcase';
import ProjectRepository from './pages/ProjectRepository';
import Facility from './pages/Facility';
import LiabilityAgreement from './pages/LiabilityAgreement';
import Dashboard from './pages/Dashboard';
import KeyholderDashboard from './pages/KeyholderDashboard';
import AdminPanel from './pages/AdminPanel';
import Login from './pages/Login';
import Register from './pages/Register';

const ScrollTop = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
};

/** Marketing / onboarding pages: top navbar + footer. */
const PublicLayout = () => (
  <div className="relative isolate flex min-h-screen flex-col">
    <AmbientBackdrop />
    <Navbar />
    <main className="flex-1"><Outlet /></main>
    <Footer />
  </div>
);

const AppContent = () => {
  const [toast, setToast] = useState({ show: false, icon: 'ok', msg: '' });
  const timer = useRef();

  const showToast = useCallback((icon, msg) => {
    clearTimeout(timer.current);
    setToast({ show: true, icon, msg });
    timer.current = setTimeout(() => setToast((t) => ({ ...t, show: false })), 3400);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <>
      <ScrollTop />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/projects" element={<ProjectRepository />} />
          <Route path="/facility" element={<Facility />} />
          <Route path="/guidelines" element={<LiabilityAgreement readOnly onToast={showToast} />} />
          <Route path="/join" element={<Register onToast={showToast} />} />
          <Route path="/register" element={<Navigate to="/join" replace />} />
          <Route path="/login" element={<Login onToast={showToast} />} />
          <Route path="/onboarding/sign" element={<LiabilityAgreement onToast={showToast} />} />
        </Route>

        {/* Dashboards render their own sidebar shell */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard onToast={showToast} />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={['Keyholder', 'Superadmin']} />}>
          <Route path="/keyholder" element={<KeyholderDashboard onToast={showToast} />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={['Superadmin']} />}>
          <Route path="/admin" element={<AdminPanel onToast={showToast} />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toast toast={toast} />
    </>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}
