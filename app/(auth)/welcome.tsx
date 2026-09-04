import { useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenContainer } from '@/components/ScreenContainer';
import { AiOrb } from '@/features/orb/AiOrb';
import { useTheme } from '@/theme';

export default function WelcomeScreen() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <ScreenContainer scroll={false}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl }}>
        <AiOrb state="idle" size={140} />
        <Text
          style={[
            theme.typography.display,
            { color: theme.colors.textPrimary, textAlign: 'center', marginTop: theme.spacing.xxl },
          ]}
        >
          今日は、どんな人と{'\n'}出会いたい？
        </Text>
        <Text
          style={[
            theme.typography.body,
            { color: theme.colors.textSecondary, textAlign: 'center', marginTop: theme.spacing.md },
          ]}
        >
          好きと予定が合う人に、ちゃんと会える。{'\n'}
          AIコンシェルジュがあなたに合う相手を、理由つきで紹介します。
        </Text>
      </View>
      <View style={{ padding: theme.spacing.xl, gap: theme.spacing.sm }}>
        <PrimaryButton
          label="はじめる（メールで登録）"
          onPress={() => router.push('/(auth)/sign-in')}
          testID="welcome-start"
        />
        <Text style={[theme.typography.caption, { color: theme.colors.textTertiary, textAlign: 'center' }]}>
          18歳以上の方のみご利用いただけます
        </Text>
      </View>
    </ScreenContainer>
  );
}
