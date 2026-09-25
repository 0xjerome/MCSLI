import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Profile } from '@/types/database';
import type { NationalityClass, UserRole } from '@/domain/types';

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  nationality: NationalityClass;
  country: string;
  city?: string;
}

interface AuthState {
  /** undefined while the initial session is being resolved. */
  session: Session | null | undefined;
  user: User | null;
  profile: Profile | null;
  role: UserRole | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string, captchaToken?: string) => Promise<void>;
  signUp: (input: RegisterInput, captchaToken?: string) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string, captchaToken?: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  resendVerification: (email: string, captchaToken?: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const siteUrl = () => (import.meta.env.VITE_SITE_URL as string | undefined) ?? window.location.origin;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(isSupabaseConfigured ? undefined : null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    setProfileLoading(true);
    try {
      const { data } = await getSupabase().from('profiles').select('*').eq('id', userId).maybeSingle();
      setProfile((data as Profile | null) ?? null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const sb = getSupabase();
    let cancelled = false;
    sb.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      void loadProfile(data.session?.user.id);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      void loadProfile(s?.user.id);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string, captchaToken?: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim().toLowerCase(), password, options: captchaToken ? { captchaToken } : undefined });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (input: RegisterInput, captchaToken?: string) => {
    const { data, error } = await getSupabase().auth.signUp({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      options: {
        emailRedirectTo: `${siteUrl()}/login?verified=1`,
        captchaToken,
        data: { full_name: input.fullName.trim(), phone: input.phone?.trim() ?? '', nationality: input.nationality, country: input.country.trim(), city: input.city?.trim() ?? '' },
      },
    });
    if (error) throw error;
    return { needsEmailConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut();
    setProfile(null);
  }, []);

  const requestPasswordReset = useCallback(async (email: string, captchaToken?: string) => {
    const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${siteUrl()}/reset-password`, captchaToken });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await getSupabase().auth.updateUser({ password });
    if (error) throw error;
  }, []);

  const resendVerification = useCallback(async (email: string, captchaToken?: string) => {
    const { error } = await getSupabase().auth.resend({ type: 'signup', email: email.trim().toLowerCase(), options: { emailRedirectTo: `${siteUrl()}/login?verified=1`, captchaToken } });
    if (error) throw error;
  }, []);

  const refreshProfile = useCallback(async () => loadProfile(session?.user.id), [loadProfile, session?.user.id]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      role: profile?.role ?? null,
      loading: session === undefined || (Boolean(session) && !profile && profileLoading),
      configured: isSupabaseConfigured,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      resendVerification,
      refreshProfile,
    }),
    [session, profile, profileLoading, signIn, signUp, signOut, requestPasswordReset, updatePassword, resendVerification, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
