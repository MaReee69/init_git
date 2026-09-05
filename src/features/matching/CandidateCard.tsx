import React from 'react';
import { Text, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { GlassCard } from '@/components/GlassCard';
import type { CandidateListItem } from '@/lib/backend/types';
import type { MatchFeatureKey } from '@/lib/matching/types';
import { useTheme } from '@/theme';

const FEATURE_ACCENT: Record<MatchFeatureKey, 'aurora' | 'violet' | 'coral'> = {
  reciprocalFit: 'violet',
  values: 'violet',
  intent: 'violet',
  availability: 'coral',
  location: 'aurora',
  interests: 'aurora',
  communicationStyle: 'coral',
};

function calculateAgeDisplay(birthdate: string): number {
  const dob = new Date(birthdate);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age;
}

interface CandidateCardProps {
  item: CandidateListItem;
  compact?: boolean;
}

/**
 * 推薦カード。写真は未実装(Phase2)のため、頭文字によるプレースホルダーを表示する。
 * 「おすすめ度」は0-100の目安であり、デート成功率や交際確率と断定しない表現にする。
 */
export function CandidateCard({ item, compact }: CandidateCardProps) {
  const theme = useTheme();
  const initial = item.displayName ? item.displayName.charAt(0) : '？';
  const age = calculateAgeDisplay(item.candidate.birthdate);

  return (
    <GlassCard glowColor="aurora" style={{ width: '100%' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.md }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: theme.radii.pill,
            backgroundColor: theme.colors.bgSurfaceStrong,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: theme.spacing.md,
          }}
          accessibilityLabel={`${item.displayName}のプロフィール画像（未設定）`}
        >
          <Text style={[theme.typography.title, { color: theme.colors.aurora }]}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[theme.typography.subtitle, { color: theme.colors.textPrimary }]}>
            {item.displayName}（{age}歳）
          </Text>
          {item.candidate.area && (
            <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>{item.candidate.area}</Text>
          )}
        </View>
        <View
          style={{
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: theme.spacing.xxs,
            borderRadius: theme.radii.pill,
            backgroundColor: `${theme.colors.violet}22`,
          }}
          accessibilityLabel={`おすすめ度 ${item.score.totalScore}点（目安であり成功を保証するものではありません）`}
        >
          <Text style={[theme.typography.label, { color: theme.colors.violet }]}>{item.score.totalScore}</Text>
        </View>
      </View>

      {item.isExplorationPick && (
        <Text style={[theme.typography.caption, { color: theme.colors.textTertiary, marginBottom: theme.spacing.sm }]}>
          ✦ 新しいタイプの候補です
        </Text>
      )}

      {!compact && item.bio && (
        <Text
          style={[theme.typography.body, { color: theme.colors.textSecondary, marginBottom: theme.spacing.md }]}
          numberOfLines={3}
        >
          {item.bio}
        </Text>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {item.score.reasons.map((reason) => (
          <Chip key={reason.feature} label={reason.label} accent={FEATURE_ACCENT[reason.feature]} />
        ))}
      </View>
    </GlassCard>
  );
}
