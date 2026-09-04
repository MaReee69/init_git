import { supabase, hasSupabaseCredentials } from '@/lib/supabaseClient';

import { createSupabaseAuthBackend } from './supabase/supabaseAuthBackend';
import { createSupabaseProfileBackend } from './supabase/supabaseProfileBackend';
import { mockAuthBackend } from './mock/mockAuthBackend';
import { mockProfileBackend } from './mock/mockProfileBackend';
import type { Backend } from './types';

const useMockBackend = process.env.EXPO_PUBLIC_USE_MOCK_BACKEND === 'true' || !hasSupabaseCredentials;

/**
 * バックエンド実装の選択ポイント。
 * EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY が未設定、
 * もしくは EXPO_PUBLIC_USE_MOCK_BACKEND=true の場合はローカルモックにフォールバックする。
 */
export const backend: Backend = useMockBackend
  ? { auth: mockAuthBackend, profiles: mockProfileBackend }
  : { auth: createSupabaseAuthBackend(supabase!), profiles: createSupabaseProfileBackend(supabase!) };

export const isMockBackend = useMockBackend;
export { MOCK_OTP_CODE } from './mock/mockAuthBackend';
export type { Backend } from './types';
