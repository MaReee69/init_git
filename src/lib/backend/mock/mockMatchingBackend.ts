import { computeMatchScore, passesHardFilters, rankCandidates } from '@/lib/matching';
import type { MatchCandidateInput } from '@/lib/matching/types';
import { DEFAULT_MATCH_WEIGHTS } from '@/lib/matching/weights';
import type { Like, Match, Profile } from '@/types/domain';

import type { MatchingBackend } from '../types';
import { randomId, readDb, writeDb, type MockDb } from './store';

function toCandidateInput(db: MockDb, profileId: string): MatchCandidateInput | null {
  const profile = db.profiles[profileId];
  const prefs = db.preferences[profileId];
  if (!profile || !prefs) return null;
  return {
    profileId,
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
    availability: (db.availability[profileId] ?? []).map((s) => ({ weekday: s.weekday, timeBand: s.timeBand })),
    interestKeys: db.profileInterests[profileId] ?? [],
    answers: (db.profileAnswers[profileId] ?? []).map((a) => ({
      questionKey: a.questionKey,
      answerChoice: a.answerChoice,
    })),
  };
}

function isBlocked(db: MockDb, a: string, b: string): boolean {
  return db.blocks.some((blk) => (blk.blockerId === a && blk.blockedId === b) || (blk.blockerId === b && blk.blockedId === a));
}

function hasBeenActioned(db: MockDb, viewerId: string, candidateId: string): boolean {
  const alreadyLiked = db.likes.some((l) => l.fromProfileId === viewerId && l.toProfileId === candidateId);
  const alreadyPassed = db.recommendationEvents.some(
    (e) => e.profileId === viewerId && e.candidateProfileId === candidateId && e.eventType === 'pass',
  );
  const alreadyMatched = db.matches.some(
    (m) => (m.profileIdA === viewerId || m.profileIdB === viewerId) && (m.profileIdA === candidateId || m.profileIdB === candidateId),
  );
  return alreadyLiked || alreadyPassed || alreadyMatched;
}

export const mockMatchingBackend: MatchingBackend = {
  async listCandidates(viewerId) {
    const db = await readDb();
    const viewer = toCandidateInput(db, viewerId);
    if (!viewer) return [];

    const candidates = Object.keys(db.profiles)
      .filter((id) => id !== viewerId)
      .map((id) => toCandidateInput(db, id))
      .filter((c): c is MatchCandidateInput => c !== null)
      .filter((candidate) =>
        passesHardFilters({
          viewer,
          candidate,
          context: {
            isBlockedEitherDirection: isBlocked(db, viewerId, candidate.profileId),
            alreadyActioned: hasBeenActioned(db, viewerId, candidate.profileId),
          },
        }),
      )
      .map((candidate) => ({
        candidate,
        score: computeMatchScore(viewer, candidate, DEFAULT_MATCH_WEIGHTS),
      }));

    return rankCandidates(candidates).map((scored) => {
      const p = db.profiles[scored.candidate.profileId];
      return { ...scored, displayName: p?.displayName ?? '', bio: p?.bio };
    });
  },

  async likeProfile(viewerId, candidateProfileId) {
    const db = await writeDb((current) => {
      const alreadyLiked = current.likes.some(
        (l) => l.fromProfileId === viewerId && l.toProfileId === candidateProfileId,
      );
      if (alreadyLiked) return current;
      const like: Like = {
        id: randomId('like'),
        fromProfileId: viewerId,
        toProfileId: candidateProfileId,
        createdAt: new Date().toISOString(),
      };
      return { ...current, likes: [...current.likes, like] };
    });

    const reciprocal = db.likes.some((l) => l.fromProfileId === candidateProfileId && l.toProfileId === viewerId);
    if (!reciprocal) {
      return { matched: false };
    }

    const [profileIdA, profileIdB] = [viewerId, candidateProfileId].sort();
    const existingMatch = db.matches.find((m) => m.profileIdA === profileIdA && m.profileIdB === profileIdB);
    if (existingMatch) {
      return { matched: true, match: existingMatch };
    }

    const match: Match = {
      id: randomId('match'),
      profileIdA,
      profileIdB,
      matchedAt: new Date().toISOString(),
      status: 'active',
    };
    await writeDb((current) => ({ ...current, matches: [...current.matches, match] }));
    return { matched: true, match };
  },

  async passProfile(viewerId, candidateProfileId) {
    await writeDb((current) => ({
      ...current,
      recommendationEvents: [
        ...current.recommendationEvents,
        {
          id: randomId('evt'),
          profileId: viewerId,
          candidateProfileId,
          eventType: 'pass',
          createdAt: new Date().toISOString(),
        },
      ],
    }));
  },

  async listMyMatches(viewerId) {
    const db = await readDb();
    return db.matches
      .filter((m) => m.status === 'active' && (m.profileIdA === viewerId || m.profileIdB === viewerId))
      .map((m) => {
        const counterpartId = m.profileIdA === viewerId ? m.profileIdB : m.profileIdA;
        const counterpart: Profile | undefined = db.profiles[counterpartId];
        return counterpart ? { match: m, counterpart } : null;
      })
      .filter((v): v is { match: Match; counterpart: Profile } => v !== null);
  },

  async recordEvent(viewerId, eventType, candidateProfileId, metadata) {
    await writeDb((current) => ({
      ...current,
      recommendationEvents: [
        ...current.recommendationEvents,
        {
          id: randomId('evt'),
          profileId: viewerId,
          candidateProfileId,
          eventType,
          metadata,
          createdAt: new Date().toISOString(),
        },
      ],
    }));
  },
};
