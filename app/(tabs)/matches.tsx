import React from 'react';
import { Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { ScreenContainer } from '@/components/ScreenContainer';
import { useTheme } from '@/theme';

/**
 * スワイプ一覧は音声コンシェルジュの補助・アクセシビリティ用途として提供する。
 * 候補一覧・いいね・マッチ機能はPhase2で実装する。
 */
export default function MatchesScreen() {
  const theme = useTheme();
  return (
    <ScreenContainer>
      <Text style={[theme.typography.title, { color: theme.colors.textPrimary, marginBottom: theme.spacing.md }]}>
        一覧（補助機能）
      </Text>
      <GlassCard>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          候補一覧・いいね・相互マッチはPhase2で実装します。音声操作が難しい場合の代替導線として、この画面からもタップ操作で同じ機能を利用できるようにする予定です。
        </Text>
      </GlassCard>
      <View style={{ flex: 1 }} />
    </ScreenContainer>
  );
}
