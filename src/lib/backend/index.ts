import { supabase, hasSupabaseCredentials } from '@/lib/supabaseClient';

import { mockAuthBackend } from './mock/mockAuthBackend';
import { mockMatchingBackend } from './mock/mockMatchingBackend';
import { mockProfileBackend } from './mock/mockProfileBackend';
import { createSupabaseAuthBackend } from './supabase/supabaseAuthBackend';
import { createSupabaseMatchingBackend } from './supabase/supabaseMatchingBackend';
import { createSupabaseProfileBackend } from './supabase/supabaseProfileBackend';
import type { Backend } from './types';
import { buildViewerCandidateInput } from './viewerCandidateInput';

const useMockBackend = process.env.EXPO_PUBLIC_USE_MOCK_BACKEND === 'true' || !hasSupabaseCredentials;

function createBackend(): Backend {
  if (useMockBackend) {
    return { auth: mockAuthBackend, profiles: mockProfileBackend, matching: mockMatchingBackend };
  }
  const client = supabase!;
  const profiles = createSupabaseProfileBackend(client);
  const matching = createSupabaseMatchingBackend(client, (userId) => buildViewerCandidateInput(profiles, userId));
  return { auth: createSupabaseAuthBackend(client), profiles, matching };
}

/**
 * バックエンド実装の選択ポイント。
 * EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY が未設定、
 * もしくは EXPO_PUBLIC_USE_MOCK_BACKEND=true の場合はローカルモックにフォールバックする。
 */
export const backend: Backend = createBackend();

export const isMockBackend = useMockBackend;
export { MOCK_OTP_CODE } from './mock/mockAuthBackend';
export type { Backend } from './types';
