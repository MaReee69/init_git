import type { SupabaseClient } from '@supabase/supabase-js';

import type { AvailabilitySlot } from '@/types/domain';

import type { DateBackend } from '../types';
import { rowToDateProposal } from './mappers';

export function createSupabaseDateBackend(client: SupabaseClient): DateBackend {
  return {
    async submitDateFeedback(profileId, matchId, submission) {
      const { data: feedbackRow, error: feedbackError } = await client
        .from('date_feedback')
        .upsert(
          {
            match_id: matchId,
            profile_id: profileId,
            want_to_meet_again: submission.wantToMeetAgain,
            submitted_at: new Date().toISOString(),
          },
          { onConflict: 'match_id,profile_id' },
        )
        .select('id')
        .single();
      if (feedbackError) throw feedbackError;

      const feedbackId = feedbackRow.id as string;

      if (submission.answers.length > 0) {
        const rows = submission.answers.map((a) => ({
          feedback_id: feedbackId,
          question_key: a.questionKey,
          answer_text: a.answerText ?? null,
          visibility: a.visibility,
        }));
        const { error: answersError } = await client.from('date_feedback_answers').insert(rows);
        if (answersError) throw answersError;
      }
    },

    async checkMutualReunionInterest(_profileId, matchId) {
      const { data, error } = await client.rpc('check_mutual_reunion_interest', { p_match_id: matchId });
      if (error) throw error;
      return Boolean(data);
    },

    async getSharedAvailability(_profileId, matchId) {
      const { data, error } = await client.rpc('get_shared_availability', { p_match_id: matchId });
      if (error) throw error;
      return (data ?? []) as Pick<AvailabilitySlot, 'weekday' | 'timeBand'>[];
    },

    async getSharedDateNotes(_profileId, matchId) {
      const { data, error } = await client.rpc('get_shared_date_notes', { p_match_id: matchId });
      if (error) throw error;
      return (data ?? []) as string[];
    },

    async createSecondDateProposal(_profileId, matchId, options) {
      const { data, error } = await client.rpc('create_second_date_proposals', {
        p_match_id: matchId,
        p_options: options,
      });
      if (error) throw error;
      const { data: proposalRow, error: fetchError } = await client
        .from('date_proposals')
        .select('*')
        .eq('id', data as string)
        .single();
      if (fetchError) throw fetchError;
      return rowToDateProposal(proposalRow);
    },

    async listDateProposals(_profileId, matchId) {
      const { data, error } = await client
        .from('date_proposals')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(rowToDateProposal);
    },

    async castDateProposalVote(_profileId, proposalId, optionIndex, vote) {
      const { data, error } = await client.rpc('cast_date_proposal_vote', {
        p_proposal_id: proposalId,
        p_option_index: optionIndex,
        p_vote: vote,
      });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      return {
        confirmed: Boolean(result?.confirmed),
        confirmedOptionIndex: result?.confirmed_option_index ?? undefined,
      };
    },
  };
}
