import type {
  AuthSession,
  AvailabilitySlot,
  DatingPreferences,
  Interest,
  Profile,
} from '@/types/domain';

/**
 * データアクセス層のインターフェース。Supabase実装とMock実装を差し替え可能にする。
 * クライアントはこのインターフェース越しにのみデータへアクセスし、
 * 実際の権限はSupabase側ではRLSが、Mock側ではこの層自体が担保する。
 */
export interface AuthBackend {
  requestOtp(email: string): Promise<void>;
  verifyOtp(email: string, code: string): Promise<AuthSession>;
  signOut(): Promise<void>;
  getSession(): Promise<AuthSession | null>;
  subscribe(listener: (session: AuthSession | null) => void): () => void;
}

export interface ProfileBackend {
  getMyProfile(userId: string): Promise<Profile | null>;
  upsertMyProfile(userId: string, patch: Partial<Omit<Profile, 'id'>>): Promise<Profile>;
  getMyDatingPreferences(userId: string): Promise<DatingPreferences | null>;
  upsertMyDatingPreferences(userId: string, patch: Omit<DatingPreferences, 'profileId'>): Promise<DatingPreferences>;
  replaceMyAvailability(userId: string, slots: Pick<AvailabilitySlot, 'weekday' | 'timeBand'>[]): Promise<AvailabilitySlot[]>;
  replaceMyInterests(userId: string, interestKeys: string[]): Promise<void>;
  listInterests(): Promise<Interest[]>;
}

export interface Backend {
  auth: AuthBackend;
  profiles: ProfileBackend;
}
