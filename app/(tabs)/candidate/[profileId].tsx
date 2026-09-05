import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { GlassCard } from '@/components/GlassCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenContainer } from '@/components/ScreenContainer';
import { CandidateCard } from '@/features/matching/CandidateCard';
import { useCandidates, useLikeProfile, usePassProfile } from '@/state/useMatching';
import { useTheme } from '@/theme';

const WEEKDAY_LABEL = ['日', '月', '火', '水', '木', '金', '土'];
const TIME_BAND_LABEL: Record<string, string> = {
  morning: '朝',
  afternoon: '午後',
  evening: '夜',
  night: '深夜',
};

export default function CandidateDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  const candidatesQuery = useCandidates();
  const likeMutation = useLikeProfile();
  const passMutation = usePassProfile();
  const [confirmLike, setConfirmLike] = useState(false);
  const [matchedName, setMatchedName] = useState<string | null>(null);

  const item = candidatesQuery.data?.find((c) => c.candidate.profileId === profileId);

  if (!item) {
    return (
      <ScreenContainer>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          候補が見つかりませんでした。一覧からやり直してください。
        </Text>
        <PrimaryButton label="一覧に戻る" onPress={() => router.back()} variant="secondary" />
      </ScreenContainer>
    );
  }

  const handleLike = async () => {
    setConfirmLike(false);
    const result = await likeMutation.mutateAsync(item.candidate.profileId);
    if (result.matched) {
      setMatchedName(item.displayName);
    } else {
      router.back();
    }
  };

  const handlePass = async () => {
    await passMutation.mutateAsync(item.candidate.profileId);
    router.back();
  };

  return (
    <ScreenContainer>
      <CandidateCard item={item} />

      <GlassCard style={{ marginTop: theme.spacing.md }}>
        <Text style={[theme.typography.label, { color: theme.colors.textTertiary, marginBottom: theme.spacing.sm }]}>
          会いやすい曜日・時間帯
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {item.candidate.availability.map((slot, idx) => (
            <Chip key={idx} label={`${WEEKDAY_LABEL[slot.weekday]}曜${TIME_BAND_LABEL[slot.timeBand]}`} accent="coral" />
          ))}
          {item.candidate.availability.length === 0 && (
            <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>情報がありません</Text>
          )}
        </View>
      </GlassCard>

      <GlassCard style={{ marginTop: theme.spacing.md, marginBottom: theme.spacing.lg }}>
        <Text style={[theme.typography.label, { color: theme.colors.textTertiary, marginBottom: theme.spacing.xs }]}>
          おすすめ度について
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
          おすすめ度は、お互いの明示的な希望条件・興味・予定を基にした目安であり、デートの成功や交際を保証するものではありません。
        </Text>
      </GlassCard>

      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.xxl }}>
        <View style={{ flex: 1 }}>
          <PrimaryButton label="見送る" variant="secondary" onPress={handlePass} loading={passMutation.isPending} />
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton label="いいね" onPress={() => setConfirmLike(true)} loading={likeMutation.isPending} />
        </View>
      </View>

      <ConfirmDialog
        visible={confirmLike}
        title="いいねを送りますか？"
        message={`${item.displayName}さんにいいねを送ります。相手にも通知され、相思相愛になるとマッチが成立します。`}
        confirmLabel="いいねを送る"
        onConfirm={handleLike}
        onCancel={() => setConfirmLike(false)}
      />

      <ConfirmDialog
        visible={!!matchedName}
        title="マッチしました！"
        message={`${matchedName}さんと相思相愛になりました。チャットでの会話はPhase3で実装予定です。`}
        confirmLabel="候補一覧に戻る"
        onConfirm={() => {
          setMatchedName(null);
          router.back();
        }}
        onCancel={() => {
          setMatchedName(null);
          router.back();
        }}
      />
    </ScreenContainer>
  );
}
