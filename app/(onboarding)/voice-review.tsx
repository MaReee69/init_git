import { useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { GlassCard } from '@/components/GlassCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenContainer } from '@/components/ScreenContainer';
import { DEFAULT_INTERESTS } from '@/lib/backend/mock/store';
import { useOnboardingDraft } from '@/state/OnboardingDraftProvider';
import { useTheme } from '@/theme';

const WEEKDAY_LABEL = ['日', '月', '火', '水', '木', '金', '土'];
const TIME_BAND_LABEL: Record<string, string> = {
  morning: '朝',
  afternoon: '午後',
  evening: '夜',
  night: '深夜',
};
const INTENT_LABEL: Record<string, string> = {
  casual: 'カジュアルな出会い',
  serious: '真剣な交際',
  marriage_oriented: '結婚を見据えた交際',
  undecided: 'まだ決めていない',
};

export default function VoiceReviewScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { draft, transcript } = useOnboardingDraft();

  const interestLabels = (draft.interestKeys ?? []).map(
    (key) => DEFAULT_INTERESTS.find((i) => i.key === key)?.labelJa ?? key,
  );

  return (
    <ScreenContainer>
      <Text style={[theme.typography.title, { color: theme.colors.textPrimary, marginBottom: theme.spacing.sm }]}>
        AIが理解した内容を確認
      </Text>
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginBottom: theme.spacing.lg }]}>
        音声認識の結果と、抽出された項目です。誤りがあれば次の画面で修正できます。
      </Text>

      <GlassCard style={{ marginBottom: theme.spacing.md }}>
        <Text style={[theme.typography.label, { color: theme.colors.textTertiary, marginBottom: theme.spacing.xs }]}>
          文字起こし（モック）
        </Text>
        <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
          {transcript || '（発話が認識されませんでした）'}
        </Text>
      </GlassCard>

      <GlassCard>
        <Text style={[theme.typography.label, { color: theme.colors.textTertiary, marginBottom: theme.spacing.sm }]}>
          抽出された条件
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {draft.area && <Chip label={`エリア: ${draft.area}`} accent="aurora" />}
          {draft.relationshipIntent && (
            <Chip label={INTENT_LABEL[draft.relationshipIntent] ?? draft.relationshipIntent} accent="violet" />
          )}
          {(draft.availability ?? []).map((slot, idx) => (
            <Chip
              key={idx}
              label={`${WEEKDAY_LABEL[slot.weekday]}曜${TIME_BAND_LABEL[slot.timeBand]}`}
              accent="coral"
            />
          ))}
          {interestLabels.map((label) => (
            <Chip key={label} label={label} accent="aurora" />
          ))}
          {!draft.area &&
            !draft.relationshipIntent &&
            (draft.availability ?? []).length === 0 &&
            interestLabels.length === 0 && (
              <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
                明確な条件は抽出されませんでした。次の画面で入力できます。
              </Text>
            )}
        </View>
      </GlassCard>

      <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.sm }}>
        <PrimaryButton
          label="この内容でプロフィールに反映する"
          onPress={() => router.push('/(onboarding)/profile-form')}
        />
        <PrimaryButton
          label="もう一度話す"
          variant="secondary"
          onPress={() => router.push('/(onboarding)/voice-onboarding')}
        />
      </View>
    </ScreenContainer>
  );
}
