import type { ScoredCandidate } from '@/lib/matching/types';
import type {
  AuthSession,
  AvailabilitySlot,
  DatingPreferences,
  Interest,
  Match,
  Profile,
  ProfileAnswer,
  RecommendationEventType,
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
  listMyAvailability(userId: string): Promise<AvailabilitySlot[]>;
  listMyInterestKeys(userId: string): Promise<string[]>;
  listMyAnswers(userId: string): Promise<ProfileAnswer[]>;
}

export interface LikeResult {
  matched: boolean;
  match?: Match;
}

export interface MatchWithCounterpart {
  match: Match;
  counterpart: Profile;
}

/**
 * 候補一覧UI用に、スコア計算結果(ScoredCandidate)へ表示専用フィールドを付加したもの。
 * displayName/bioは本人が明示入力したプロフィール文であり、スコア計算(src/lib/matching)には使わない。
 */
export interface CandidateListItem extends ScoredCandidate {
  displayName: string;
  bio?: string;
}

export interface MatchingBackend {
  /** ハード条件で絞り込み、説明可能なスコアで並べた候補一覧を返す */
  listCandidates(viewerId: string): Promise<CandidateListItem[]>;
  /** いいねを送る。相思相愛ならマッチを作成して返す */
  likeProfile(viewerId: string, candidateProfileId: string): Promise<LikeResult>;
  /** 見送り。以後この候補は再提示しない */
  passProfile(viewerId: string, candidateProfileId: string): Promise<void>;
  listMyMatches(viewerId: string): Promise<MatchWithCounterpart[]>;
  recordEvent(
    viewerId: string,
    eventType: RecommendationEventType,
    candidateProfileId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void>;
}

export interface Backend {
  auth: AuthBackend;
  profiles: ProfileBackend;
  matching: MatchingBackend;
}
