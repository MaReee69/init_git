import type { RelationshipIntent } from '@/types/domain';

import type { HardFilterContext, MatchCandidateInput } from './types';

/**
 * 明示的に入力された年齢範囲同士のみを比較する距離しきい値（km）。
 * 実際の位置情報(緯度経度)は保存しないMVP方針のため、
 * 「この距離以上移動できる」と本人が申告している場合は、
 * エリア文字列が違っても同一都市圏内とみなして候補から除外しない、という近似ルール。
 * （docs/architecture.mdの前提・仮定に追記）
 */
export const REACHABLE_TRAVEL_DISTANCE_KM = 30;

/** 恋愛目的の組み合わせのうち、明確に相容れないと判断してハード除外する組（順不同） */
const INCOMPATIBLE_INTENT_PAIRS: ReadonlySet<string> = new Set(['casual|marriage_oriented']);

function intentPairKey(a: RelationshipIntent, b: RelationshipIntent): string {
  return [a, b].sort().join('|');
}

export function calculateAge(birthdate: string, atDate: Date = new Date()): number {
  const dob = new Date(birthdate);
  if (Number.isNaN(dob.getTime())) return 0;
  let age = atDate.getFullYear() - dob.getFullYear();
  const monthDiff = atDate.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && atDate.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

/** 双方の希望年齢範囲に、相手の実年齢が収まっているか（相互条件） */
export function isMutualAgeRangeMatch(
  viewer: MatchCandidateInput,
  candidate: MatchCandidateInput,
  now: Date = new Date(),
): boolean {
  const viewerAge = calculateAge(viewer.birthdate, now);
  const candidateAge = calculateAge(candidate.birthdate, now);
  const candidateFitsViewer = candidateAge >= viewer.ageMin && candidateAge <= viewer.ageMax;
  const viewerFitsCandidate = viewerAge >= candidate.ageMin && viewerAge <= candidate.ageMax;
  return candidateFitsViewer && viewerFitsCandidate;
}

/** 双方が「出会いたい相手」に相手の性別を含めているか（相互条件） */
export function isMutualGenderMatch(viewer: MatchCandidateInput, candidate: MatchCandidateInput): boolean {
  return viewer.seekingGender.includes(candidate.gender) && candidate.seekingGender.includes(viewer.gender);
}

/** 明確に相容れない恋愛目的の組み合わせだけをハード除外する（それ以外はスコアで評価） */
export function isIntentCompatible(viewer: MatchCandidateInput, candidate: MatchCandidateInput): boolean {
  return !INCOMPATIBLE_INTENT_PAIRS.has(intentPairKey(viewer.relationshipIntent, candidate.relationshipIntent));
}

/**
 * 正確な位置情報を保存しないため、エリア文字列の一致、または
 * いずれかが広い移動可能距離を申告している場合のみ「現実的に会える」とみなす近似ルール。
 */
export function isLocationReachable(viewer: MatchCandidateInput, candidate: MatchCandidateInput): boolean {
  const viewerArea = viewer.area?.trim().toLowerCase();
  const candidateArea = candidate.area?.trim().toLowerCase();
  if (viewerArea && candidateArea && viewerArea === candidateArea) return true;
  const viewerWillingToTravel = (viewer.travelDistanceKm ?? 0) >= REACHABLE_TRAVEL_DISTANCE_KM;
  const candidateWillingToTravel = (candidate.travelDistanceKm ?? 0) >= REACHABLE_TRAVEL_DISTANCE_KM;
  return viewerWillingToTravel || candidateWillingToTravel;
}

export interface HardFilterInput {
  viewer: MatchCandidateInput;
  candidate: MatchCandidateInput;
  context: HardFilterContext;
  now?: Date;
}

/**
 * 候補抽出のハード条件（年齢範囲・対象性別・恋愛目的・距離・ブロック状態）。
 * すべて満たした場合のみ true。ここを通過した候補だけがスコア計算の対象になる。
 */
export function passesHardFilters({ viewer, candidate, context, now }: HardFilterInput): boolean {
  if (viewer.profileId === candidate.profileId) return false;
  if (candidate.status !== 'active') return false;
  if (context.isBlockedEitherDirection) return false;
  if (context.alreadyActioned) return false;
  if (!isMutualAgeRangeMatch(viewer, candidate, now)) return false;
  if (!isMutualGenderMatch(viewer, candidate)) return false;
  if (!isIntentCompatible(viewer, candidate)) return false;
  if (!isLocationReachable(viewer, candidate)) return false;
  return true;
}
