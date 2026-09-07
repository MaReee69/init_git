import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { GlassCard } from '@/components/GlassCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenContainer } from '@/components/ScreenContainer';
import { CandidateCard } from '@/features/matching/CandidateCard';
import { useCandidates, useLikeProfile, useMyMatches, usePassProfile } from '@/state/useMatching';
import { useTheme } from '@/theme';

/**
 * 音声操作の代替として、タップ操作だけで候補閲覧・いいね・見送り・マッチ確認を完結できる画面。
 */
export default function MatchesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const candidatesQuery = useCandidates();
  const matchesQuery = useMyMatches();
  const likeMutation = useLikeProfile();
  const passMutation = usePassProfile();
  const [confirmLikeId, setConfirmLikeId] = useState<string | null>(null);
  const [matchedName, setMatchedName] = useState<string | null>(null);

  const candidates = candidatesQuery.data ?? [];
  const matches = matchesQuery.data ?? [];
  const confirmTarget = candidates.find((c) => c.candidate.profileId === confirmLikeId);

  const handleLike = async () => {
    if (!confirmTarget) return;
    setConfirmLikeId(null);
    const result = await likeMutation.mutateAsync(confirmTarget.candidate.profileId);
    if (result.matched) setMatchedName(confirmTarget.displayName);
  };

  return (
    <ScreenContainer>
      <Text style={[theme.typography.title, { color: theme.colors.textPrimary, marginBottom: theme.spacing.md }]}>
        候補一覧（補助機能）
      </Text>
      <Text style={[theme.typography.caption, { color: theme.colors.textTertiary, marginBottom: theme.spacing.lg }]}>
        音声操作の代わりに、タップだけでも候補の確認・いいね・見送りができます。
      </Text>

      {candidatesQuery.isLoading && <ActivityIndicator color={theme.colors.aurora} />}

      {!candidatesQuery.isLoading && candidates.length === 0 && (
        <GlassCard style={{ marginBottom: theme.spacing.lg }}>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
            現在ご紹介できる候補がいません。条件を見直すか、しばらく経ってからまた確認してください。
          </Text>
        </GlassCard>
      )}

      {candidates.map((item) => (
        <Pressable
          key={item.candidate.profileId}
          onPress={() =>
            router.push({ pathname: '/(tabs)/candidate/[profileId]', params: { profileId: item.candidate.profileId } })
          }
          style={{ marginBottom: theme.spacing.md }}
          accessibilityRole="button"
          accessibilityLabel={`${item.displayName}さんの詳細を見る`}
        >
          <CandidateCard item={item} compact />
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label="見送る"
                variant="secondary"
                onPress={() => passMutation.mutate(item.candidate.profileId)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="いいね" onPress={() => setConfirmLikeId(item.candidate.profileId)} />
            </View>
          </View>
        </Pressable>
      ))}

      <Text
        style={[
          theme.typography.title,
          { color: theme.colors.textPrimary, marginTop: theme.spacing.xl, marginBottom: theme.spacing.md },
        ]}
      >
        マッチ一覧
      </Text>
      {matches.length === 0 ? (
        <GlassCard>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
            まだマッチはありません。相思相愛になると、ここに表示されます。
          </Text>
        </GlassCard>
      ) : (
        matches.map(({ match, counterpart }) => (
          <GlassCard key={match.id} style={{ marginBottom: theme.spacing.sm }} glowColor="violet">
            <Text style={[theme.typography.subtitle, { color: theme.colors.textPrimary, marginBottom: theme.spacing.sm }]}>
              {counterpart.displayName}
            </Text>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  label="チャットを開く"
                  onPress={() => router.push({ pathname: '/chat/[matchId]', params: { matchId: match.id } })}
                />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  label="デート後アンケート"
                  variant="secondary"
                  onPress={() =>
                    router.push({ pathname: '/date-feedback/[matchId]', params: { matchId: match.id } })
                  }
                />
              </View>
            </View>
            <View style={{ marginTop: theme.spacing.sm }}>
              <PrimaryButton
                label="セカンドデート提案"
                variant="ghost"
                onPress={() => router.push({ pathname: '/second-date/[matchId]', params: { matchId: match.id } })}
              />
            </View>
          </GlassCard>
        ))
      )}

      <ConfirmDialog
        visible={!!confirmTarget}
        title="いいねを送りますか？"
        message={`${confirmTarget?.displayName ?? ''}さんにいいねを送ります。相思相愛になるとマッチが成立します。`}
        confirmLabel="いいねを送る"
        onConfirm={handleLike}
        onCancel={() => setConfirmLikeId(null)}
      />

      <ConfirmDialog
        visible={!!matchedName}
        title="マッチしました！"
        message={`${matchedName}さんと相思相愛になりました。`}
        confirmLabel="閉じる"
        onConfirm={() => setMatchedName(null)}
        onCancel={() => setMatchedName(null)}
      />
    </ScreenContainer>
  );
}
