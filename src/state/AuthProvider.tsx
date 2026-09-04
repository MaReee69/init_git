import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { backend } from '@/lib/backend';
import type { AuthSession } from '@/types/domain';

interface AuthContextValue {
  session: AuthSession | null;
  isLoading: boolean;
  requestOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, code: string) => Promise<AuthSession>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    backend.auth.getSession().then((s) => {
      if (mounted) {
        setSession(s);
        setIsLoading(false);
      }
    });
    const unsubscribe = backend.auth.subscribe((s) => setSession(s));
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading,
      requestOtp: (email) => backend.auth.requestOtp(email),
      verifyOtp: (email, code) => backend.auth.verifyOtp(email, code),
      signOut: () => backend.auth.signOut(),
    }),
    [session, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
