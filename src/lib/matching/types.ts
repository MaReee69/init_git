import type {
  AvailabilitySlot,
  BudgetRange,
  ConversationStyle,
  Gender,
  Profile,
  ProfileAnswer,
  RelationshipIntent,
} from '@/types/domain';

/**
 * マッチングエンジンが扱う「本人が明示入力した情報」のみのビュー。
 * 写真・声・返信速度など、明示情報以外は一切含めない。
 */
export interface MatchCandidateInput {
  profileId: string;
  birthdate: string;
  gender: Gender;
  area?: string;
  travelDistanceKm?: number;
  budgetRange?: BudgetRange;
  conversationStyle?: ConversationStyle;
  status: Profile['status'];
  seekingGender: Gender[];
  relationshipIntent: RelationshipIntent;
  ageMin: number;
  ageMax: number;
  availability: Pick<AvailabilitySlot, 'weekday' | 'timeBand'>[];
  interestKeys: string[];
  answers: Pick<ProfileAnswer, 'questionKey' | 'answerChoice'>[];
}

export interface HardFilterContext {
  isBlockedEitherDirection: boolean;
  /** 既に相互マッチ済み、または既にいいね/見送り済みで再提示すべきでない場合はtrue */
  alreadyActioned: boolean;
}

export type MatchFeatureKey =
  | 'reciprocalFit'
  | 'values'
  | 'intent'
  | 'availability'
  | 'location'
  | 'interests'
  | 'communicationStyle';

export type MatchFeatureScores = Record<MatchFeatureKey, number>;

export type MatchWeights = Record<MatchFeatureKey, number>;

export interface MatchReason {
  feature: MatchFeatureKey;
  label: string;
}

export interface MatchScoreResult {
  totalScore: number; // 0-100の「おすすめ度」
  featureScores: MatchFeatureScores;
  reasons: MatchReason[];
}

export interface ScoredCandidate {
  candidate: MatchCandidateInput;
  score: MatchScoreResult;
  isExplorationPick: boolean;
}
