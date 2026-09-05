import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { backend } from '@/lib/backend';

import { useAuth } from './AuthProvider';

const CANDIDATES_QUERY_KEY = ['matching', 'candidates'] as const;
const MATCHES_QUERY_KEY = ['matching', 'matches'] as const;

export function useCandidates() {
  const { session } = useAuth();
  return useQuery({
    queryKey: [...CANDIDATES_QUERY_KEY, session?.userId],
    queryFn: () => backend.matching.listCandidates(session!.userId),
    enabled: !!session,
  });
}

export function useMyMatches() {
  const { session } = useAuth();
  return useQuery({
    queryKey: [...MATCHES_QUERY_KEY, session?.userId],
    queryFn: () => backend.matching.listMyMatches(session!.userId),
    enabled: !!session,
  });
}

export function useLikeProfile() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (candidateProfileId: string) => backend.matching.likeProfile(session!.userId, candidateProfileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CANDIDATES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: MATCHES_QUERY_KEY });
    },
  });
}

export function usePassProfile() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (candidateProfileId: string) => backend.matching.passProfile(session!.userId, candidateProfileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CANDIDATES_QUERY_KEY });
    },
  });
}

export function useRecordRecommendationEvent() {
  const { session } = useAuth();
  return useMutation({
    mutationFn: ({
      eventType,
      candidateProfileId,
      metadata,
    }: {
      eventType: Parameters<typeof backend.matching.recordEvent>[1];
      candidateProfileId?: string;
      metadata?: Record<string, unknown>;
    }) => backend.matching.recordEvent(session!.userId, eventType, candidateProfileId, metadata),
  });
}
