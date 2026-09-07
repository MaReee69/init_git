import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { backend } from '@/lib/backend';
import type { DateFeedbackSubmission } from '@/schemas/dateFlow';
import type { DateProposalOption, DateProposalVoteChoice } from '@/types/domain';

import { useAuth } from './AuthProvider';

export function useSubmitDateFeedback(matchId: string) {
  const { session } = useAuth();
  return useMutation({
    mutationFn: (submission: DateFeedbackSubmission) =>
      backend.dates.submitDateFeedback(session!.userId, matchId, submission),
  });
}

export function useMutualReunionInterest(matchId: string | undefined) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['dates', 'mutualInterest', matchId],
    queryFn: () => backend.dates.checkMutualReunionInterest(session!.userId, matchId!),
    enabled: !!session && !!matchId,
  });
}

export function useDateProposals(matchId: string | undefined) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['dates', 'proposals', matchId],
    queryFn: () => backend.dates.listDateProposals(session!.userId, matchId!),
    enabled: !!session && !!matchId,
  });
}

export function useCreateSecondDateProposal(matchId: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (options: DateProposalOption[]) => backend.dates.createSecondDateProposal(session!.userId, matchId, options),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dates', 'proposals', matchId] }),
  });
}

export function useCastDateProposalVote(matchId: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ proposalId, optionIndex, vote }: { proposalId: string; optionIndex: number; vote: DateProposalVoteChoice }) =>
      backend.dates.castDateProposalVote(session!.userId, proposalId, optionIndex, vote),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dates', 'proposals', matchId] }),
  });
}

export async function fetchSecondDateProposalContext(userId: string, matchId: string) {
  const [sharedAvailability, sharedNotes, myProfile] = await Promise.all([
    backend.dates.getSharedAvailability(userId, matchId),
    backend.dates.getSharedDateNotes(userId, matchId),
    backend.profiles.getMyProfile(userId),
  ]);
  return {
    sharedAvailability,
    shareableNotes: sharedNotes,
    area: myProfile?.area,
    budget: myProfile?.budgetRange,
  };
}
