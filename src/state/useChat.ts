import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { backend } from '@/lib/backend';
import type { SendMessageInput } from '@/lib/backend/types';

import { useAuth } from './AuthProvider';

function messagesKey(matchId: string) {
  return ['chat', 'messages', matchId] as const;
}

export function useMessages(matchId: string | undefined) {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: messagesKey(matchId ?? ''),
    queryFn: () => backend.chat.listMessages(session!.userId, matchId!),
    enabled: !!session && !!matchId,
    refetchInterval: 4000,
  });

  useEffect(() => {
    if (!matchId) return undefined;
    const unsubscribe = backend.chat.subscribeToMessages(matchId, () => {
      queryClient.invalidateQueries({ queryKey: messagesKey(matchId) });
    });
    return unsubscribe;
  }, [matchId, queryClient]);

  return query;
}

export function useSendMessage(matchId: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<SendMessageInput, 'matchId'>) =>
      backend.chat.sendMessage(session!.userId, { ...input, matchId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: messagesKey(matchId) }),
  });
}

export function useMarkRead(matchId: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => backend.chat.markRead(session!.userId, matchId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: messagesKey(matchId) }),
  });
}

export function useReportProfile() {
  const { session } = useAuth();
  return useMutation({
    mutationFn: ({
      targetProfileId,
      matchId,
      reasonCode,
      detail,
    }: {
      targetProfileId: string;
      matchId?: string;
      reasonCode: string;
      detail?: string;
    }) => backend.chat.reportProfile(session!.userId, targetProfileId, matchId, reasonCode, detail),
  });
}

export function useBlockProfile() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targetProfileId: string) => backend.chat.blockProfile(session!.userId, targetProfileId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['matching', 'matches'] }),
  });
}

export function useUnmatch() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (matchId: string) => backend.chat.unmatch(session!.userId, matchId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['matching', 'matches'] }),
  });
}
