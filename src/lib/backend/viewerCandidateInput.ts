import type { MatchCandidateInput } from '@/lib/matching/types';

import type { ProfileBackend } from './types';

/**
 * ProfileBackend越しに「自分自身」の情報を集め、マッチングエンジンが扱う
 * MatchCandidateInput形式に変換する。Supabase実装ではRPCで候補プールのみを取得するため、
 * 閲覧者自身のデータはこの関数でRLS越しに（＝自分の行として）組み立てる。
 */
export async function buildViewerCandidateInput(
  profiles: ProfileBackend,
  userId: string,
): Promise<MatchCandidateInput | null> {
  const [profile, prefs, availability, interestKeys, answers] = await Promise.all([
    profiles.getMyProfile(userId),
    profiles.getMyDatingPreferences(userId),
    profiles.listMyAvailability(userId),
    profiles.listMyInterestKeys(userId),
    profiles.listMyAnswers(userId),
  ]);

  if (!profile || !prefs) return null;

  return {
    profileId: userId,
    birthdate: profile.birthdate,
    gender: profile.gender,
    area: profile.area,
    travelDistanceKm: profile.travelDistanceKm,
    budgetRange: profile.budgetRange,
    conversationStyle: profile.conversationStyle,
    status: profile.status,
    seekingGender: prefs.seekingGender,
    relationshipIntent: prefs.relationshipIntent,
    ageMin: prefs.ageMin,
    ageMax: prefs.ageMax,
    availability: availability.map((s) => ({ weekday: s.weekday, timeBand: s.timeBand })),
    interestKeys,
    answers: answers.map((a) => ({ questionKey: a.questionKey, answerChoice: a.answerChoice })),
  };
}
