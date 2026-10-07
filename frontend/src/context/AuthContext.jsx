import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase, supabaseConfigured } from '../services/supabase';

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
  const loadedFor = useRef(null); // user id whose profile is already in state
  const inFlight = useRef(null);  // { id, promise } for the profile request currently running (shared by all callers)

  /**
   * Load the signed-in user's row from public.users.
   * quiet = background refresh: never flips the app into a loading state (that would remount the current page).
   */
  const fetchProfile = (userId, { quiet = false } = {}) => {
    if (inFlight.current?.id === userId) return inFlight.current.promise; // de-dupe getSession + INITIAL_SESSION + login()
    const promise = loadProfile(userId, quiet);
    inFlight.current = { id: userId, promise };
    return promise;
  };

  const loadProfile = async (userId, quiet) => {
    if (!quiet) setProfileLoading(true);
    try {
      const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
      if (error) throw error;
      if (data) { setProfile(data); loadedFor.current = userId; }
    } catch (error) {
      console.warn('Profile fetch error:', error.message);
    } finally {
      inFlight.current = null;
      setLoading(false);
      setProfileLoading(false);
    }
  };

  useEffect(() => {
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
        // Same user again (tab refocus, token refresh): keep identities stable and do NOT reload anything.
        setUser((u) => (u?.id === session.user.id ? u : session.user));
        if (loadedFor.current !== session.user.id) fetchProfile(session.user.id);
      } else {
        loadedFor.current = null;
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const res = await supabase.auth.signInWithPassword({ email, password });
    if (res.data?.user) {
      // Wait for the profile so the page we navigate to next already knows the user's role (no bounce back to /login).
      setUser((u) => (u?.id === res.data.user.id ? u : res.data.user));
      await fetchProfile(res.data.user.id);
    }
    return res;
  };

  const register = async (email, password, metadata) => {
    return supabase.auth.signUp({
      email,
      password,
      // After the confirmation link, the user lands on /account which routes them by role (new students go to the agreement).
      options: { data: metadata, emailRedirectTo: `${window.location.origin}/account` },
    });
  };

  const logout = async () => {
    setDemoMode('public');
    return supabase.auth.signOut().catch(() => {});
  };

  const refreshProfile = async () => {
    if (user && !user.id.startsWith('usr-')) {
      await fetchProfile(user.id, { quiet: true });
    }
  };

  const currentProfile = profile || MOCK_PROFILES[demoRole];
  // True when a real Supabase session is driving the app (as opposed to the demo-role preview).
  const live = supabaseConfigured && demoRole === 'public' && !!profile && !String(profile.id).startsWith('usr-');
  const activeRole = demoRole !== 'public' ? demoRole : (currentProfile?.role?.toLowerCase() || 'public');

  return (
    <AuthContext.Provider
      value={{
        user,
        profile: currentProfile,
        demoRole,
        activeRole,
        live,
        setDemoMode,
        loading: loading || (profileLoading && !profile),
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
