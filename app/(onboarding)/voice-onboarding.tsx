import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenContainer } from '@/components/ScreenContainer';
import { AiOrb } from '@/features/orb/AiOrb';
import type { OrbState } from '@/features/orb/types';
import { useVoiceRecorder } from '@/features/voice/useVoiceRecorder';
import { Waveform } from '@/features/voice/Waveform';
import { aiAdapters } from '@/lib/ai';
import { useOnboardingDraft } from '@/state/OnboardingDraftProvider';
import { useTheme } from '@/theme';

const PROMPT_TEXT =
  'あなたについて教えてください。休日の過ごし方、興味のあること、どんな出会いを探しているかなど、自由にお話しください。';

export default function VoiceOnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const recorder = useVoiceRecorder();
  const { transcript, setDraft, setTranscript } = useOnboardingDraft();

  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [followUpQuestion, setFollowUpQuestion] = useState<string | null>(null);
  const [askedFollowUp, setAskedFollowUp] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleStart = async () => {
    setErrorMessage(null);
    const ok = await recorder.start();
    if (!ok) {
      setErrorMessage('マイクへのアクセスが許可されていません。設定から許可するか、テキスト入力に切り替えてください。');
      setOrbState('error');
      return;
    }
    setOrbState('listening');
  };

  const handleStop = async () => {
    const uri = await recorder.stop();
    setOrbState('thinking');
    try {
      const transcription = await aiAdapters.stt.transcribe({ uri: uri ?? '' });
      setLastTranscript(transcription.text);
      const result = await aiAdapters.llm.extractProfileFromTranscript({
        transcript: transcription.text,
        history: [],
      });
      setDraft(result.extracted);
      setTranscript(`${transcript ? `${transcript}\n` : ''}${transcription.text}`.trim());

      if (result.followUpQuestion && !askedFollowUp) {
        setFollowUpQuestion(result.followUpQuestion);
        setAskedFollowUp(true);
        setOrbState('confirm');
      } else {
        setOrbState('found');
        setTimeout(() => router.push('/(onboarding)/voice-review'), 600);
      }
    } catch {
      setErrorMessage('うまく聞き取れませんでした。もう一度お試しください。');
      setOrbState('error');
    }
  };

  return (
    <ScreenContainer scroll={false}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl }}>
        {recorder.isRecording && (
          <View
            style={{
              position: 'absolute',
              top: theme.spacing.md,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: `${theme.colors.danger}22`,
              borderRadius: theme.radii.pill,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.xxs,
            }}
            accessibilityLiveRegion="polite"
          >
            <Text style={{ color: theme.colors.danger, fontWeight: '700' }}>● マイク使用中</Text>
          </View>
        )}

        <AiOrb state={orbState} size={150} />

        <View style={{ height: 32, marginTop: theme.spacing.md }}>
          <Waveform active={recorder.isRecording} />
        </View>

        <GlassCard style={{ marginTop: theme.spacing.xl, width: '100%' }}>
          <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
            {followUpQuestion ?? PROMPT_TEXT}
          </Text>
        </GlassCard>

        {lastTranscript.length > 0 && (
          <GlassCard style={{ marginTop: theme.spacing.md, width: '100%' }}>
            <Text style={[theme.typography.label, { color: theme.colors.textTertiary, marginBottom: theme.spacing.xxs }]}>
              認識結果（確認前）
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{lastTranscript}</Text>
          </GlassCard>
        )}

        {errorMessage && (
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.danger, marginTop: theme.spacing.md, textAlign: 'center' },
            ]}
          >
            {errorMessage}
          </Text>
        )}
      </View>

      <View style={{ padding: theme.spacing.xl, gap: theme.spacing.sm }}>
        {!recorder.isRecording ? (
          <PrimaryButton label="押して話す" onPress={handleStart} testID="voice-start" />
        ) : (
          <PrimaryButton label="話し終える" onPress={handleStop} variant="danger" testID="voice-stop" />
        )}
        <PrimaryButton
          label="テキスト入力に切り替える"
          variant="ghost"
          onPress={() => router.push('/(onboarding)/profile-form')}
        />
      </View>
    </ScreenContainer>
  );
}
