import { useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenContainer } from '@/components/ScreenContainer';
import { useTheme } from '@/theme';

export default function ProfileMethodScreen() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <ScreenContainer>
      <Text style={[theme.typography.title, { color: theme.colors.textPrimary, marginBottom: theme.spacing.sm }]}>
        プロフィールを作成しましょう
      </Text>
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginBottom: theme.spacing.xl }]}>
        キーボード入力、AIとの音声会話のどちらでも登録を完了できます。
      </Text>

      <GlassCard glowColor="aurora" style={{ marginBottom: theme.spacing.md }}>
        <Text style={[theme.typography.subtitle, { color: theme.colors.textPrimary, marginBottom: theme.spacing.xs }]}>
          AIと話して登録する
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: theme.spacing.md }]}>
          タップして話すだけで、AIが内容を整理してプロフィール項目を埋めます。最後に内容を必ず確認できます。
        </Text>
        <PrimaryButton label="音声で始める" onPress={() => router.push('/(onboarding)/voice-onboarding')} />
      </GlassCard>

      <GlassCard>
        <Text style={[theme.typography.subtitle, { color: theme.colors.textPrimary, marginBottom: theme.spacing.xs }]}>
          テキストで入力する
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: theme.spacing.md }]}>
          フォームに直接入力してプロフィールを作成します。
        </Text>
        <PrimaryButton
          label="テキストで始める"
          variant="secondary"
          onPress={() => router.push('/(onboarding)/profile-form')}
        />
      </GlassCard>
      <View style={{ flex: 1 }} />
    </ScreenContainer>
  );
}
