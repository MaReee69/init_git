import { calculateAge } from './hardFilters';
import type {
  MatchCandidateInput,
  MatchFeatureKey,
  MatchFeatureScores,
  MatchReason,
  MatchScoreResult,
  MatchWeights,
} from './types';

interface FeatureResult {
  value: number; // 0-1
  /** 実際に比較可能な明示情報があった場合のみtrue。falseの場合は理由表示の根拠にしない */
  informative: boolean;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function slotKey(weekday: number, timeBand: string): string {
  return `${weekday}-${timeBand}`;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  a.forEach((v) => {
    if (b.has(v)) intersection += 1;
  });
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function ageFitWithinRange(age: number, min: number, max: number): number {
  if (max <= min) return age === min ? 1 : 0;
  const mid = (min + max) / 2;
  const halfRange = (max - min) / 2;
  return clamp01(1 - Math.abs(age - mid) / halfRange);
}

/** 相互希望の一致: 双方の希望年齢範囲内で、相手の年齢がどれだけ「中心寄り」か */
export function scoreReciprocalFit(
  viewer: MatchCandidateInput,
  candidate: MatchCandidateInput,
  now: Date = new Date(),
): FeatureResult {
  const viewerAge = calculateAge(viewer.birthdate, now);
  const candidateAge = calculateAge(candidate.birthdate, now);
  const candidateFit = ageFitWithinRange(candidateAge, viewer.ageMin, viewer.ageMax);
  const viewerFit = ageFitWithinRange(viewerAge, candidate.ageMin, candidate.ageMax);
  return { value: (candidateFit + viewerFit) / 2, informative: true };
}

/** 価値観質問の相性: 双方が回答済みの共通質問についてのみ比較する */
export function scoreValues(viewer: MatchCandidateInput, candidate: MatchCandidateInput): FeatureResult {
  const candidateAnswers = new Map(candidate.answers.map((a) => [a.questionKey, a.answerChoice]));
  const sharedKeys = viewer.answers.map((a) => a.questionKey).filter((key) => candidateAnswers.has(key));
  if (sharedKeys.length === 0) {
    return { value: 0.5, informative: false };
  }
  const viewerAnswers = new Map(viewer.answers.map((a) => [a.questionKey, a.answerChoice]));
  const agreeCount = sharedKeys.filter((key) => viewerAnswers.get(key) === candidateAnswers.get(key)).length;
  return { value: clamp01(agreeCount / sharedKeys.length), informative: true };
}

const INTENT_SCORE_TABLE: Record<string, number> = {
  'casual|casual': 1,
  'serious|serious': 1,
  'marriage_oriented|marriage_oriented': 1,
  'undecided|undecided': 0.6,
  'marriage_oriented|serious': 0.7,
  'serious|undecided': 0.6,
  'casual|undecided': 0.6,
  'marriage_oriented|undecided': 0.5,
  'casual|marriage_oriented': 0.2, // ハード除外対象だが、テストや将来の緩和のためフォールバック値を定義
  'casual|serious': 0.5,
};

/** 恋愛目的の一致度。完全一致以外は組み合わせテーブルに基づく段階的なスコア */
export function scoreIntent(viewer: MatchCandidateInput, candidate: MatchCandidateInput): FeatureResult {
  const key = [viewer.relationshipIntent, candidate.relationshipIntent].sort().join('|');
  const value = INTENT_SCORE_TABLE[key] ?? 0.5;
  const informative = viewer.relationshipIntent !== 'undecided' || candidate.relationshipIntent !== 'undecided';
  return { value, informative };
}

/** 会いやすい曜日・時間帯の重なり（Jaccard係数） */
export function scoreAvailability(viewer: MatchCandidateInput, candidate: MatchCandidateInput): FeatureResult {
  const viewerSlots = new Set(viewer.availability.map((s) => slotKey(s.weekday, s.timeBand)));
  const candidateSlots = new Set(candidate.availability.map((s) => slotKey(s.weekday, s.timeBand)));
  if (viewerSlots.size === 0 || candidateSlots.size === 0) {
    return { value: 0, informative: false };
  }
  return { value: jaccard(viewerSlots, candidateSlots), informative: true };
}

/** 希望エリア・距離の現実性。緯度経度は使わずエリア文字列と申告距離のみで近似する */
export function scoreLocation(viewer: MatchCandidateInput, candidate: MatchCandidateInput): FeatureResult {
  const viewerArea = viewer.area?.trim().toLowerCase();
  const candidateArea = candidate.area?.trim().toLowerCase();
  if (!viewerArea || !candidateArea) {
    return { value: 0.5, informative: false };
  }
  if (viewerArea === candidateArea) {
    return { value: 1, informative: true };
  }
  return { value: 0.4, informative: true };
}

/** 興味・趣味の近さ（Jaccard係数） */
export function scoreInterests(viewer: MatchCandidateInput, candidate: MatchCandidateInput): FeatureResult {
  const viewerInterests = new Set(viewer.interestKeys);
  const candidateInterests = new Set(candidate.interestKeys);
  if (viewerInterests.size === 0 || candidateInterests.size === 0) {
    return { value: 0.5, informative: false };
  }
  return { value: jaccard(viewerInterests, candidateInterests), informative: true };
}

const COMMUNICATION_COMPAT: Record<string, number> = {
  'text_first|text_first': 1,
  'voice_first|voice_first': 1,
  'balanced|balanced': 1,
  'balanced|text_first': 0.7,
  'balanced|voice_first': 0.7,
  'text_first|voice_first': 0.3,
};

/** 会話スタイルの相性 */
export function scoreCommunicationStyle(viewer: MatchCandidateInput, candidate: MatchCandidateInput): FeatureResult {
  if (!viewer.conversationStyle || !candidate.conversationStyle) {
    return { value: 0.5, informative: false };
  }
  const key = [viewer.conversationStyle, candidate.conversationStyle].sort().join('|');
  return { value: COMMUNICATION_COMPAT[key] ?? 0.5, informative: true };
}

const FEATURE_SCORERS: Record<
  MatchFeatureKey,
  (viewer: MatchCandidateInput, candidate: MatchCandidateInput, now?: Date) => FeatureResult
> = {
  reciprocalFit: scoreReciprocalFit,
  values: scoreValues,
  intent: scoreIntent,
  availability: scoreAvailability,
  location: scoreLocation,
  interests: scoreInterests,
  communicationStyle: scoreCommunicationStyle,
};

const REASON_LABELS: Record<MatchFeatureKey, (viewer: MatchCandidateInput, candidate: MatchCandidateInput) => string> = {
  reciprocalFit: () => '希望する年齢条件がお互いに合っています',
  values: () => '価値観の考え方が近いです',
  intent: (v, c) => (v.relationshipIntent === c.relationshipIntent ? '恋愛に求めるものが同じです' : '恋愛に求めるものの方向性が近いです'),
  availability: () => '会いやすい曜日・時間帯が重なっています',
  location: (v, c) => (v.area && c.area && v.area === c.area ? `${v.area}エリアで会いやすいです` : 'お互いに移動できる範囲です'),
  interests: (v, c) => {
    const shared = c.interestKeys.filter((k) => v.interestKeys.includes(k));
    return shared.length > 0 ? `共通の興味があります` : '興味の傾向が近いです';
  },
  communicationStyle: () => '会話のスタイルが合いそうです',
};

/**
 * 説明可能な初期スコアを計算する純粋関数。
 * LLM単独では順位を決めず、ルールベースの特徴量とその重み付き合計で0-100の「おすすめ度」を出す。
 */
export function computeMatchScore(
  viewer: MatchCandidateInput,
  candidate: MatchCandidateInput,
  weights: MatchWeights,
  now: Date = new Date(),
): MatchScoreResult {
  const featureScores = {} as MatchFeatureScores;
  const informativeFeatures: { feature: MatchFeatureKey; score: number }[] = [];

  (Object.keys(FEATURE_SCORERS) as MatchFeatureKey[]).forEach((feature) => {
    const result = FEATURE_SCORERS[feature](viewer, candidate, now);
    featureScores[feature] = result.value;
    if (result.informative) {
      informativeFeatures.push({ feature, score: result.value * weights[feature] });
    }
  });

  const totalScore = Math.round(
    clamp01(
      (Object.keys(weights) as MatchFeatureKey[]).reduce((sum, key) => sum + featureScores[key] * weights[key], 0),
    ) * 100,
  );

  const reasons: MatchReason[] = informativeFeatures
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ feature }) => ({ feature, label: REASON_LABELS[feature](viewer, candidate) }));

  return { totalScore, featureScores, reasons };
}
