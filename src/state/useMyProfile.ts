import { useQuery, useQueryClient } from '@tanstack/react-query';

import { backend } from '@/lib/backend';

import { useAuth } from './AuthProvider';

export const MY_PROFILE_QUERY_KEY = ['profile', 'me'] as const;

export function useMyProfile() {
  const { session } = useAuth();
  const query = useQuery({
    queryKey: [...MY_PROFILE_QUERY_KEY, session?.userId],
    queryFn: () => backend.profiles.getMyProfile(session!.userId),
    enabled: !!session,
  });
  return query;
}

export function useInvalidateMyProfile() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: MY_PROFILE_QUERY_KEY });
}
