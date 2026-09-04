import type { SupabaseClient } from '@supabase/supabase-js';

import type { AuthSession } from '@/types/domain';

import type { AuthBackend } from '../types';

export function createSupabaseAuthBackend(client: SupabaseClient): AuthBackend {
  return {
    async requestOtp(email) {
      const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      if (error) throw error;
    },

    async verifyOtp(email, code) {
      const { data, error } = await client.auth.verifyOtp({ email, token: code, type: 'email' });
      if (error) throw error;
      if (!data.user) throw new Error('認証に失敗しました');
      return { userId: data.user.id, email: data.user.email ?? email };
    },

    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },

    async getSession() {
      const { data } = await client.auth.getSession();
      const user = data.session?.user;
      if (!user) return null;
      return { userId: user.id, email: user.email ?? '' };
    },

    subscribe(listener) {
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        const user = session?.user;
        const authSession: AuthSession | null = user ? { userId: user.id, email: user.email ?? '' } : null;
        listener(authSession);
      });
      return () => data.subscription.unsubscribe();
    },
  };
}
