import type { AuthSession } from '@/types/domain';

import type { AuthBackend } from '../types';
import { readDb, writeDb } from './store';

/** モックモードでは常にこのコードで検証が通る（README/UIに明記する）。 */
export const MOCK_OTP_CODE = '123456';

type Listener = (session: AuthSession | null) => void;
const listeners = new Set<Listener>();

function notify(session: AuthSession | null) {
  listeners.forEach((l) => l(session));
}

function makeUserId(email: string): string {
  // 決定的なID生成（同一メールなら常に同一ユーザー）
  let hash = 0;
  for (let i = 0; i < email.length; i += 1) {
    hash = (hash * 31 + email.charCodeAt(i)) >>> 0;
  }
  return `mock-${hash.toString(16)}`;
}

export const mockAuthBackend: AuthBackend = {
  async requestOtp(email) {
    const normalized = email.trim().toLowerCase();
    await writeDb((db) => ({
      ...db,
      pendingOtp: { ...db.pendingOtp, [normalized]: MOCK_OTP_CODE },
    }));
  },

  async verifyOtp(email, code) {
    const normalized = email.trim().toLowerCase();
    const db = await readDb();
    const expected = db.pendingOtp[normalized];
    if (!expected || expected !== code) {
      throw new Error('認証コードが正しくありません');
    }
    const session: AuthSession = { userId: makeUserId(normalized), email: normalized };
    await writeDb((current) => ({ ...current, session }));
    notify(session);
    return session;
  },

  async signOut() {
    await writeDb((db) => ({ ...db, session: null }));
    notify(null);
  },

  async getSession() {
    const db = await readDb();
    return db.session;
  },

  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
