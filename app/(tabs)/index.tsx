import React from 'react';
import { Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { ScreenContainer } from '@/components/ScreenContainer';
import { AiOrb } from '@/features/orb/AiOrb';
import { useMyProfile } from '@/state/useMyProfile';
import { useTheme } from '@/theme';

export default function HomeScreen() {
  const theme = useTheme();
  const profileQuery = useMyProfile();
  const displayName = profileQuery.data?.displayName;

  return (
    <ScreenContainer scroll={false}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl }}>
        <AiOrb state="idle" size={160} />
        <Text
          style={[
            theme.typography.title,
            { color: theme.colors.textPrimary, textAlign: 'center', marginTop: theme.spacing.xl },
          ]}
        >
          {displayName ? `おかえりなさい、${displayName}さん` : '今日は、どんな人と話してみたい？'}
        </Text>

        <GlassCard style={{ marginTop: theme.spacing.xl, width: '100%' }} glowColor="violet">
          <Text style={[theme.typography.subtitle, { color: theme.colors.textPrimary, marginBottom: theme.spacing.xs }]}>
            音声マッチコンシェルジュ
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            Phase1ではAIオーブと基本ナビゲーションのみを実装しています。自然言語での相手探し・条件チップ表示・候補紹介はPhase2で実装予定です（docs/tasks.md参照）。
          </Text>
        </GlassCard>
      </View>
    </ScreenContainer>
  );
}
