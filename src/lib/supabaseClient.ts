import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const hasSupabaseCredentials = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * クライアントはSupabaseの匿名キーのみを使用する。Service Role Keyは絶対に含めない。
 * 認証情報が無い場合はnullを返し、呼び出し側（backend factory）がMock実装へフォールバックする。
 */
export const supabase: SupabaseClient | null = hasSupabaseCredentials
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;
