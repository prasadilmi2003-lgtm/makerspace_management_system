import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

const AuthContext = createContext({});

export const MOCK_PROFILES = {
  public: null,
  pending: {
    id: 'usr-pending-001',
    full_name: 'Imesha Rathnayake',
    student_id: 'EG/2023/2267',
    role: 'Pending',
    status: 'Pending_Signature',
    email: 'imesha@eng.ruh.ac.lk',
  },
  user: {
    id: 'usr-student-001',
    full_name: 'Shaminda Perera',
    student_id: 'EG/2022/5311',
    role: 'User',
    status: 'Active',
    email: 'shaminda@eng.ruh.ac.lk',
  },
  keyholder: {
    id: 'usr-kh-004',
    full_name: 'Kasun Jayawardena',
    student_id: 'EG/2021/2201',
    role: 'Keyholder',
    status: 'Active',
    penalty_box: false,
    email: 'kasun@eng.ruh.ac.lk',
  },
  kh_penalty: {
    id: 'usr-kh-007',
    full_name: 'Ruwan Wijesekara',
    student_id: 'EG/2022/4410',
    role: 'Keyholder',
    status: 'Penalty',
    penalty_box: true,
    email: 'ruwan@eng.ruh.ac.lk',
  },
  admin: {
    id: 'usr-admin-001',
    full_name: 'Superadmin Founder',
    student_id: 'STAFF/2020/001',
    role: 'Superadmin',
    status: 'Active',
    email: 'admin@makerspace.ruh.ac.lk',
  },
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [demoRole, setDemoRole] = useState('public'); // 'public' | 'pending' | 'user' | 'keyholder' | 'kh_penalty' | 'admin'

  useEffect(() => {
    // Attempt Supabase session initialization
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    }).catch(() => {
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        setProfileLoading(true);
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      if (data) setProfile(data);
    } catch (error) {
      console.warn('Profile fetch error, defaulting to demo profile:', error.message);
    } finally {
      setLoading(false);
      setProfileLoading(false);
    }
  };

  const setDemoMode = (roleKey) => {
    setDemoRole(roleKey);
    const mock = MOCK_PROFILES[roleKey];
    if (mock) {
      setUser({ id: mock.id, email: mock.email });
      setProfile(mock);
    } else {
      setUser(null);
      setProfile(null);
    }
  };

  const login = async (email, password) => {
    return supabase.auth.signInWithPassword({ email, password });
  };

  const register = async (email, password, metadata) => {
    return supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });
  };

  const logout = async () => {
    setDemoMode('public');
    return supabase.auth.signOut().catch(() => {});
  };

  const refreshProfile = async () => {
    if (user && !user.id.startsWith('usr-')) {
      await fetchProfile(user.id);
    }
  };

  const currentProfile = profile || MOCK_PROFILES[demoRole];
  const activeRole = demoRole !== 'public' ? demoRole : (currentProfile?.role?.toLowerCase() || 'public');

  return (
    <AuthContext.Provider
      value={{
        user,
        profile: currentProfile,
        demoRole,
        activeRole,
        setDemoMode,
        loading: loading || profileLoading,
        login,
        register,
        logout,
        refreshProfile,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
