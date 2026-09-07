import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { OptionGroup } from '@/components/OptionGroup';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenContainer } from '@/components/ScreenContainer';
import { useVoiceRecorder } from '@/features/voice/useVoiceRecorder';
import { aiAdapters } from '@/lib/ai';
import { useAuth } from '@/state/AuthProvider';
import { useSubmitDateFeedback } from '@/state/useDates';
import { useTheme } from '@/theme';
import type { DateFeedbackVisibility } from '@/types/domain';

interface QuestionDef {
  key: string;
  label: string;
  fixedVisibility?: DateFeedbackVisibility;
  choices?: string[];
}

const QUESTIONS: QuestionDef[] = [
  { key: 'fun_moment', label: '何が楽しかったですか？' },
  { key: 'style_preference', label: '次は会話中心と体験型のどちらがよいですか？', choices: ['会話中心', '体験型', 'どちらでも'] },
  { key: 'logistics_pref', label: '希望の時間・予算・エリアがあれば教えてください' },
  {
    key: 'avoid',
    label: '避けたいことや気になったことがあれば教えてください（この回答は相手には一切共有されません）',
    fixedVisibility: 'safety',
  },
];

export default function DateFeedbackScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const submitMutation = useSubmitDateFeedback(matchId);
  const recorder = useVoiceRecorder();

  const [wantToMeetAgain, setWantToMeetAgain] = useState<boolean | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [visibility, setVisibility] = useState<Record<string, DateFeedbackVisibility>>(
    Object.fromEntries(QUESTIONS.map((q) => [q.key, q.fixedVisibility ?? 'shareable'])),
  );
  const [recordingKey, setRecordingKey] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function toggleRecording(questionKey: string) {
    if (recordingKey === questionKey) {
      const uri = await recorder.stop();
      setRecordingKey(null);
      try {
        const transcription = await aiAdapters.stt.transcribe({ uri: uri ?? '' });
        setAnswers((prev) => ({ ...prev, [questionKey]: transcription.text }));
      } catch {
        setStatusMessage('うまく聞き取れませんでした。テキストで入力してください。');
      }
      return;
    }
    setStatusMessage(null);
    const ok = await recorder.start();
    if (!ok) {
      setStatusMessage('マイクへのアクセスが許可されていません。テキストで入力してください。');
      return;
    }
    setRecordingKey(questionKey);
  }

  async function handleSubmit() {
    if (wantToMeetAgain === null) {
      setStatusMessage('「また会いたいですか？」への回答は必須です。');
      return;
    }
    await submitMutation.mutateAsync({
      wantToMeetAgain,
      answers: QUESTIONS.filter((q) => answers[q.key]?.trim()).map((q) => ({
        questionKey: q.key,
        answerText: answers[q.key].trim(),
        visibility: visibility[q.key],
      })),
    });
    setSubmitted(true);
  }

  if (!session) return null;

  if (submitted) {
    return (
      <ScreenContainer>
        <GlassCard glowColor="aurora">
          <Text style={[theme.typography.title, { color: theme.colors.textPrimary, marginBottom: theme.spacing.sm }]}>
            回答ありがとうございました
          </Text>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
            回答は非公開です。双方が「また会いたい」を選んだ場合のみ、AIセカンドデート提案が利用できるようになります。片方だけが希望した場合、その事実が相手に伝わることはありません。
          </Text>
        </GlassCard>
        <View style={{ marginTop: theme.spacing.lg }}>
          <PrimaryButton label="マッチ一覧に戻る" onPress={() => router.push('/(tabs)/matches')} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Text style={[theme.typography.title, { color: theme.colors.textPrimary, marginBottom: theme.spacing.sm }]}>
        デート後アンケート（非公開）
      </Text>
      <Text style={[theme.typography.caption, { color: theme.colors.textTertiary, marginBottom: theme.spacing.lg }]}>
        回答は相手には表示されません。「共有する」に設定した項目のみ、双方合意の上でAIセカンドデート提案の参考に使われます。
      </Text>

      <GlassCard style={{ marginBottom: theme.spacing.md }}>
        <Text style={[theme.typography.subtitle, { color: theme.colors.textPrimary, marginBottom: theme.spacing.sm }]}>
          また会いたいですか？
        </Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <PrimaryButton
            label="また会いたい"
            variant={wantToMeetAgain === true ? 'primary' : 'secondary'}
            onPress={() => setWantToMeetAgain(true)}
          />
          <PrimaryButton
            label="今回は見送りたい"
            variant={wantToMeetAgain === false ? 'primary' : 'secondary'}
            onPress={() => setWantToMeetAgain(false)}
          />
        </View>
      </GlassCard>

      {QUESTIONS.map((q) => (
        <GlassCard key={q.key} style={{ marginBottom: theme.spacing.md }}>
          <Text style={[theme.typography.subtitle, { color: theme.colors.textPrimary, marginBottom: theme.spacing.sm }]}>
            {q.label}
          </Text>

          {q.choices ? (
            <OptionGroup
              label=""
              options={q.choices.map((c) => ({ value: c, label: c }))}
              value={answers[q.key]}
              onChange={(v) => setAnswers((prev) => ({ ...prev, [q.key]: v }))}
            />
          ) : (
            <>
              <TextInput
                value={answers[q.key] ?? ''}
                onChangeText={(text) => setAnswers((prev) => ({ ...prev, [q.key]: text }))}
                multiline
                placeholder={recordingKey === q.key ? '録音中…' : '音声またはテキストで回答'}
                placeholderTextColor={theme.colors.textTertiary}
                style={{
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.sm,
                  padding: theme.spacing.sm,
                  color: theme.colors.textPrimary,
                  backgroundColor: theme.colors.bgSurface,
                  minHeight: 50,
                  marginBottom: theme.spacing.xs,
                }}
              />
              <PrimaryButton
                label={recordingKey === q.key ? '話し終える' : '🎙 音声で答える'}
                variant={recordingKey === q.key ? 'danger' : 'secondary'}
                onPress={() => toggleRecording(q.key)}
              />
            </>
          )}

          {!q.fixedVisibility && (
            <View style={{ flexDirection: 'row', gap: theme.spacing.xs, marginTop: theme.spacing.sm }}>
              <PrimaryButton
                label="共有する"
                variant={visibility[q.key] === 'shareable' ? 'primary' : 'secondary'}
                onPress={() => setVisibility((prev) => ({ ...prev, [q.key]: 'shareable' }))}
              />
              <PrimaryButton
                label="共有しない"
                variant={visibility[q.key] === 'private' ? 'primary' : 'secondary'}
                onPress={() => setVisibility((prev) => ({ ...prev, [q.key]: 'private' }))}
              />
            </View>
          )}
          {q.fixedVisibility === 'safety' && (
            <Text style={[theme.typography.caption, { color: theme.colors.textTertiary, marginTop: theme.spacing.xs }]}>
              この項目はデート提案に使われず、必要に応じて安全のための対応にのみ使われます。
            </Text>
          )}
        </GlassCard>
      ))}

      {statusMessage && (
        <Text style={[theme.typography.caption, { color: theme.colors.danger, marginBottom: theme.spacing.md }]}>
          {statusMessage}
        </Text>
      )}

      <View style={{ marginBottom: theme.spacing.xxl }}>
        <PrimaryButton label="回答を送信する" onPress={handleSubmit} loading={submitMutation.isPending} />
      </View>
    </ScreenContainer>
  );
}
