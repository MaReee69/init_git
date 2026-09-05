import type { MatchCandidateInput } from './types';

let counter = 0;

export function makeCandidate(overrides: Partial<MatchCandidateInput> = {}): MatchCandidateInput {
  counter += 1;
  return {
    profileId: overrides.profileId ?? `profile-${counter}`,
    birthdate: '1995-06-15',
    gender: 'female',
    area: '東京都渋谷区',
    travelDistanceKm: 20,
    budgetRange: 'mid',
    conversationStyle: 'balanced',
    status: 'active',
    seekingGender: ['male'],
    relationshipIntent: 'serious',
    ageMin: 25,
    ageMax: 40,
    availability: [{ weekday: 6, timeBand: 'afternoon' }],
    interestKeys: ['movie', 'cafe'],
    answers: [],
    ...overrides,
  };
}
