import type { SupabaseClient } from '@supabase/supabase-js';

import { computeMatchScore, rankCandidates } from '@/lib/matching';
import type { MatchCandidateInput } from '@/lib/matching/types';
import { DEFAULT_MATCH_WEIGHTS } from '@/lib/matching/weights';
import type { AvailabilitySlot, Gender, Profile, RelationshipIntent } from '@/types/domain';

import type { MatchingBackend } from '../types';
import { rowToMatch, rowToProfile } from './mappers';

interface CandidatePoolRow {
  candidate_id: string;
  display_name: string;
  bio: string | null;
  birthdate: string;
  gender: Gender;
  area: string | null;
  travel_distance_km: number | null;
  budget_range: Profile['budgetRange'] | null;
  conversation_style: Profile['conversationStyle'] | null;
  status: Profile['status'];
  seeking_gender: Gender[];
  relationship_intent: RelationshipIntent;
  age_min: number;
  age_max: number;
  availability: Pick<AvailabilitySlot, 'weekday' | 'timeBand'>[] | null;
  interest_keys: string[] | null;
  answers: { questionKey: string; answerChoice?: string }[] | null;
}

function rowToCandidateInput(row: CandidatePoolRow): MatchCandidateInput {
  return {
    profileId: row.candidate_id,
    birthdate: row.birthdate,
    gender: row.gender,
    area: row.area ?? undefined,
    travelDistanceKm: row.travel_distance_km ?? undefined,
    budgetRange: row.budget_range ?? undefined,
    conversationStyle: row.conversation_style ?? undefined,
    status: row.status,
    seekingGender: row.seeking_gender ?? [],
    relationshipIntent: row.relationship_intent,
    ageMin: row.age_min,
    ageMax: row.age_max,
    availability: row.availability ?? [],
    interestKeys: row.interest_keys ?? [],
    answers: row.answers ?? [],
  };
}

export function createSupabaseMatchingBackend(
  client: SupabaseClient,
  buildViewerCandidateInput: (userId: string) => Promise<MatchCandidateInput | null>,
): MatchingBackend {
  return {
    async listCandidates(viewerId) {
      const viewer = await buildViewerCandidateInput(viewerId);
      if (!viewer) return [];

      const { data, error } = await client.rpc('get_candidate_pool');
      if (error) throw error;

      const rows = (data ?? []) as CandidatePoolRow[];
      const scored = rows.map((row) => {
        const candidate = rowToCandidateInput(row);
        return { candidate, score: computeMatchScore(viewer, candidate, DEFAULT_MATCH_WEIGHTS) };
      });
      const displayInfo = new Map(rows.map((row) => [row.candidate_id, { displayName: row.display_name, bio: row.bio ?? undefined }]));

      return rankCandidates(scored).map((item) => ({
        ...item,
        displayName: displayInfo.get(item.candidate.profileId)?.displayName ?? '',
        bio: displayInfo.get(item.candidate.profileId)?.bio,
      }));
    },

    async likeProfile(viewerId, candidateProfileId) {
      const { error: likeError } = await client
        .from('likes')
        .upsert(
          { from_profile_id: viewerId, to_profile_id: candidateProfileId },
          { onConflict: 'from_profile_id,to_profile_id', ignoreDuplicates: true },
        );
      if (likeError) throw likeError;

      const { error: eventError } = await client
        .from('recommendation_events')
        .insert({ profile_id: viewerId, candidate_profile_id: candidateProfileId, event_type: 'like_sent' });
      if (eventError) throw eventError;

      const { data, error } = await client.rpc('finalize_match', { p_other: candidateProfileId });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      if (!result?.matched) {
        return { matched: false };
      }

      const { data: matchRow, error: matchError } = await client
        .from('matches')
        .select('*')
        .eq('id', result.match_id)
        .single();
      if (matchError) throw matchError;
      return { matched: true, match: rowToMatch(matchRow) };
    },

    async passProfile(viewerId, candidateProfileId) {
      const { error } = await client
        .from('recommendation_events')
        .insert({ profile_id: viewerId, candidate_profile_id: candidateProfileId, event_type: 'pass' });
      if (error) throw error;
    },

    async listMyMatches(viewerId) {
      const { data, error } = await client
        .from('matches')
        .select('*')
        .eq('status', 'active')
        .or(`profile_id_a.eq.${viewerId},profile_id_b.eq.${viewerId}`);
      if (error) throw error;

      const matches = (data ?? []).map(rowToMatch);
      const results = await Promise.all(
        matches.map(async (match) => {
          const counterpartId = match.profileIdA === viewerId ? match.profileIdB : match.profileIdA;
          const { data: profileRow, error: profileError } = await client
            .from('profiles')
            .select('*')
            .eq('id', counterpartId)
            .maybeSingle();
          if (profileError) throw profileError;
          return profileRow ? { match, counterpart: rowToProfile(profileRow) } : null;
        }),
      );
      return results.filter((r): r is { match: (typeof matches)[number]; counterpart: Profile } => r !== null);
    },

    async recordEvent(viewerId, eventType, candidateProfileId, metadata) {
      const { error } = await client.from('recommendation_events').insert({
        profile_id: viewerId,
        candidate_profile_id: candidateProfileId ?? null,
        event_type: eventType,
        metadata: metadata ?? null,
      });
      if (error) throw error;
    },
  };
}
