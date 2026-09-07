import type { ScoredCandidate } from '@/lib/matching/types';
import type { DateFeedbackSubmission } from '@/schemas/dateFlow';
import type {
  AuthSession,
  AvailabilitySlot,
  DatingPreferences,
  DateProposal,
  DateProposalOption,
  DateProposalVoteChoice,
  Interest,
  Match,
  Message,
  MessageAiMode,
  MessageContentType,
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

export interface SendMessageInput {
  matchId: string;
  contentType: MessageContentType;
  body?: string;
  aiMode?: MessageAiMode;
  /** 「声のまま送る」モードの場合のみ指定。実音声アップロード(Storage)はPhase4以降 */
  voiceClip?: { retainUntil: string | null };
}

/**
 * マッチ相手だけが使えるチャット。ブロック/マッチ解除後は即座にアクセスできなくなる
 * （バックエンド側でactiveなマッチのみを対象とする）。
 */
export interface ChatBackend {
  listMessages(viewerId: string, matchId: string): Promise<Message[]>;
  sendMessage(viewerId: string, input: SendMessageInput): Promise<Message>;
  /** 自分宛（相手が送った）メッセージを既読にする */
  markRead(viewerId: string, matchId: string): Promise<void>;
  /** 新着があった可能性を通知するだけのシンプルな契約。実データは呼び出し側がlistMessagesで取得する */
  subscribeToMessages(matchId: string, onChange: () => void): () => void;
  reportProfile(
    viewerId: string,
    targetProfileId: string,
    matchId: string | undefined,
    reasonCode: string,
    detail?: string,
  ): Promise<void>;
  /** ブロックすると、対象との既存マッチも即時解除される */
  blockProfile(viewerId: string, targetProfileId: string): Promise<void>;
  unmatch(viewerId: string, matchId: string): Promise<void>;
}

/**
 * デート後アンケート・AIセカンドデート提案。
 * 個々の回答・片方だけの再会意思は相手へ一切開示しない設計（詳細はdocs/security.md）。
 */
export interface DateBackend {
  submitDateFeedback(profileId: string, matchId: string, submission: DateFeedbackSubmission): Promise<void>;
  /** 双方とも再会を希望しているかの真偽値のみを返す。個別の回答は取得できない */
  checkMutualReunionInterest(profileId: string, matchId: string): Promise<boolean>;
  /** 双方の空き時間の「重なり」のみ（非公開の予定そのものは含まない） */
  getSharedAvailability(profileId: string, matchId: string): Promise<Pick<AvailabilitySlot, 'weekday' | 'timeBand'>[]>;
  /** 双方の visibility='shareable' な回答のみを発言者を区別せず集約したもの */
  getSharedDateNotes(profileId: string, matchId: string): Promise<string[]>;
  /** 双方の再会意思確認が取れている場合のみ成功する（未確認ならエラー） */
  createSecondDateProposal(profileId: string, matchId: string, options: DateProposalOption[]): Promise<DateProposal>;
  listDateProposals(profileId: string, matchId: string): Promise<DateProposal[]>;
  castDateProposalVote(
    profileId: string,
    proposalId: string,
    optionIndex: number,
    vote: DateProposalVoteChoice,
  ): Promise<{ confirmed: boolean; confirmedOptionIndex?: number }>;
}

export interface Backend {
  auth: AuthBackend;
  profiles: ProfileBackend;
  matching: MatchingBackend;
  chat: ChatBackend;
  dates: DateBackend;
}
