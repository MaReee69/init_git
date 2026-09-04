import React from 'react';
import { Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenContainer } from '@/components/ScreenContainer';
import { isMockBackend } from '@/lib/backend';
import { useAuth } from '@/state/AuthProvider';
import { useMyProfile } from '@/state/useMyProfile';
import { useTheme } from '@/theme';

export default function ProfileScreen() {
  const theme = useTheme();
  const { session, signOut } = useAuth();
  const profileQuery = useMyProfile();
  const profile = profileQuery.data;

  return (
    <ScreenContainer>
      <Text style={[theme.typography.title, { color: theme.colors.textPrimary, marginBottom: theme.spacing.md }]}>
        マイページ
      </Text>

      <GlassCard style={{ marginBottom: theme.spacing.md }}>
        <Text style={[theme.typography.label, { color: theme.colors.textTertiary }]}>アカウント</Text>
        <Text style={[theme.typography.body, { color: theme.colors.textPrimary, marginTop: theme.spacing.xxs }]}>
          {session?.email}
        </Text>
        {isMockBackend && (
          <Text style={[theme.typography.caption, { color: theme.colors.aurora, marginTop: theme.spacing.xs }]}>
            モックバックエンドで動作中（データは端末内にのみ保存されます）
          </Text>
        )}
      </GlassCard>

      <GlassCard style={{ marginBottom: theme.spacing.md }}>
        <Text style={[theme.typography.label, { color: theme.colors.textTertiary }]}>表示名</Text>
        <Text style={[theme.typography.body, { color: theme.colors.textPrimary, marginTop: theme.spacing.xxs }]}>
          {profile?.displayName || '未設定'}
        </Text>
        <Text style={[theme.typography.label, { color: theme.colors.textTertiary, marginTop: theme.spacing.md }]}>
          活動エリア
        </Text>
        <Text style={[theme.typography.body, { color: theme.colors.textPrimary, marginTop: theme.spacing.xxs }]}>
          {profile?.area || '未設定'}
        </Text>
        <Text style={[theme.typography.label, { color: theme.colors.textTertiary, marginTop: theme.spacing.md }]}>
          自己紹介
        </Text>
        <Text style={[theme.typography.body, { color: theme.colors.textPrimary, marginTop: theme.spacing.xxs }]}>
          {profile?.bio || '未設定'}
        </Text>
      </GlassCard>

      <GlassCard style={{ marginBottom: theme.spacing.md }}>
        <Text style={[theme.typography.subtitle, { color: theme.colors.textPrimary, marginBottom: theme.spacing.xs }]}>
          自分のデータ・アカウント
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
          データの閲覧・削除申請、ブロック/通報履歴、AIが覚えていることの確認・削除は今後のPhaseで実装予定です（docs/security.md参照）。
        </Text>
      </GlassCard>

      <View style={{ flex: 1 }} />
      <PrimaryButton label="ログアウト" variant="secondary" onPress={() => signOut()} />
    </ScreenContainer>
  );
}
