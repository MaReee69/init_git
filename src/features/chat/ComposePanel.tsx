import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { GlassCard } from '@/components/GlassCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { AiOrb } from '@/features/orb/AiOrb';
import type { OrbState } from '@/features/orb/types';
import { deleteLocalRecording } from '@/features/voice/deleteLocalRecording';
import { useVoiceRecorder } from '@/features/voice/useVoiceRecorder';
import { Waveform } from '@/features/voice/Waveform';
import { aiAdapters } from '@/lib/ai';
import { cleanUpTranscriptResilient, draftMessagesResilient } from '@/lib/ai/resilientCalls';
import { computeVoiceRetentionExpiry } from '@/lib/voice/retention';
import { useTheme } from '@/theme';
import type { MessageAiMode } from '@/types/domain';

type VoiceMode = 'own_voice_cleanup' | 'ai_draft' | 'raw_voice_clip';
type Step = 'closed' | 'select' | 'recording' | 'processing' | 'preview';

export interface ComposeSendPayload {
  contentType: 'text' | 'voice';
  body: string;
  aiMode?: MessageAiMode;
  voiceClip?: { retainUntil: string | null };
}

interface ComposePanelProps {
  userId: string;
  onSend: (payload: ComposeSendPayload) => Promise<void>;
}

const MODE_LABEL: Record<VoiceMode, string> = {
  own_voice_cleanup: '自分の言葉モード',
  ai_draft: 'AI文案モード',
  raw_voice_clip: '声のまま送る',
};

export function ComposePanel({ userId, onSend }: ComposePanelProps) {
  const theme = useTheme();
  const recorder = useVoiceRecorder();

  const [plainText, setPlainText] = useState('');
  const [step, setStep] = useState<Step>('closed');
  const [mode, setMode] = useState<VoiceMode | null>(null);
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [transcript, setTranscript] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [drafts, setDrafts] = useState<string[]>([]);
  const [selectedDraft, setSelectedDraft] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pendingVoiceUri, setPendingVoiceUri] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  function reset() {
    setStep('closed');
    setMode(null);
    setOrbState('idle');
    setTranscript('');
    setPreviewText('');
    setDrafts([]);
    setSelectedDraft(0);
    setStatusMessage(null);
    setPendingVoiceUri(null);
  }

  async function handleSendPlainText() {
    const text = plainText.trim();
    if (!text) return;
    setPlainText('');
    await onSend({ contentType: 'text', body: text });
  }

  async function startVoiceMode(selected: VoiceMode) {
    setStatusMessage(null);
    setMode(selected);
    const ok = await recorder.start();
    if (!ok) {
      setStatusMessage('マイクへのアクセスが許可されていません。上のテキスト欄をお使いください。');
      setStep('select');
      return;
    }
    setOrbState('listening');
    setStep('recording');
  }

  async function stopVoiceMode() {
    const uri = await recorder.stop();
    setStep('processing');
    setOrbState('thinking');
    try {
      const transcription = await aiAdapters.stt.transcribe({ uri: uri ?? '' });
      setTranscript(transcription.text);

      if (mode === 'own_voice_cleanup') {
        const result = await cleanUpTranscriptResilient(userId, transcription.text);
        setPreviewText(result.result.cleanedText);
        await deleteLocalRecording(uri);
      } else if (mode === 'ai_draft') {
        const result = await draftMessagesResilient(userId, transcription.text);
        setDrafts(result.result.drafts);
        setSelectedDraft(0);
        setPreviewText(result.result.drafts[0] ?? '');
        await deleteLocalRecording(uri);
      } else if (mode === 'raw_voice_clip') {
        setPreviewText(transcription.text);
        setPendingVoiceUri(uri);
      }
      setOrbState('confirm');
      setStep('preview');
    } catch {
      setStatusMessage('うまく聞き取れませんでした。もう一度お試しいただくか、上のテキスト欄をお使いください。');
      setOrbState('error');
      setStep('select');
    }
  }

  async function confirmSend() {
    if (!mode) return;
    setSending(true);
    try {
      if (mode === 'raw_voice_clip') {
        const expiry = computeVoiceRetentionExpiry(true);
        await onSend({
          contentType: 'voice',
          body: previewText,
          aiMode: 'raw_voice_clip',
          voiceClip: { retainUntil: expiry ? expiry.toISOString() : null },
        });
      } else {
        await onSend({ contentType: 'text', body: previewText, aiMode: mode });
      }
      reset();
    } finally {
      setSending(false);
    }
  }

  if (step === 'closed') {
    return (
      <View style={{ padding: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
        <View style={{ flexDirection: 'row', gap: theme.spacing.xs, marginBottom: theme.spacing.sm }}>
          <TextInput
            value={plainText}
            onChangeText={setPlainText}
            placeholder="メッセージを入力"
            placeholderTextColor={theme.colors.textTertiary}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.sm,
              padding: theme.spacing.sm,
              color: theme.colors.textPrimary,
              backgroundColor: theme.colors.bgSurface,
            }}
            onSubmitEditing={handleSendPlainText}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: theme.spacing.xs, flexWrap: 'wrap' }}>
          <PrimaryButton label="送信" onPress={handleSendPlainText} />
          <PrimaryButton label="🎙 自分の言葉" variant="secondary" onPress={() => setStep('select')} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ padding: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
      {step === 'select' && (
        <>
          <Text style={[theme.typography.subtitle, { color: theme.colors.textPrimary, marginBottom: theme.spacing.sm }]}>
            音声でメッセージを作る
          </Text>
          {statusMessage && (
            <Text style={[theme.typography.caption, { color: theme.colors.danger, marginBottom: theme.spacing.sm }]}>
              {statusMessage}
            </Text>
          )}
          <View style={{ gap: theme.spacing.xs }}>
            <PrimaryButton label="自分の言葉を話して整える" onPress={() => startVoiceMode('own_voice_cleanup')} />
            <PrimaryButton label="AIに文案を作ってもらう" variant="secondary" onPress={() => startVoiceMode('ai_draft')} />
            <PrimaryButton label="声のまま送る" variant="secondary" onPress={() => startVoiceMode('raw_voice_clip')} />
            <PrimaryButton label="やめる" variant="ghost" onPress={reset} />
          </View>
        </>
      )}

      {(step === 'recording' || step === 'processing') && (
        <View style={{ alignItems: 'center' }}>
          <AiOrb state={orbState} size={90} />
          <View style={{ height: 20, marginVertical: theme.spacing.sm }}>
            <Waveform active={recorder.isRecording} />
          </View>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }]}>
            {mode ? MODE_LABEL[mode] : ''}
          </Text>
          {step === 'recording' ? (
            <PrimaryButton label="話し終える" variant="danger" onPress={stopVoiceMode} />
          ) : (
            <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>処理中です…</Text>
          )}
        </View>
      )}

      {step === 'preview' && mode && (
        <>
          <Text style={[theme.typography.label, { color: theme.colors.textTertiary, marginBottom: theme.spacing.xs }]}>
            {MODE_LABEL[mode]} — 送信前に必ず確認してください
          </Text>

          {mode === 'own_voice_cleanup' && (
            <GlassCard style={{ marginBottom: theme.spacing.sm }}>
              <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>元の発話</Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: theme.spacing.xs }]}>
                {transcript}
              </Text>
            </GlassCard>
          )}

          {mode === 'ai_draft' && drafts.length > 1 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: theme.spacing.sm }}>
              {drafts.map((d, idx) => (
                <Chip
                  key={idx}
                  label={`案${idx + 1}`}
                  selected={selectedDraft === idx}
                  onPress={() => {
                    setSelectedDraft(idx);
                    setPreviewText(d);
                  }}
                />
              ))}
            </View>
          )}

          {mode === 'raw_voice_clip' && pendingVoiceUri && (
            <Text style={[theme.typography.caption, { color: theme.colors.textTertiary, marginBottom: theme.spacing.xs }]}>
              🔊 録音済みの音声を送信します（受信側には文字起こしも表示されます）
            </Text>
          )}

          <TextInput
            value={previewText}
            onChangeText={setPreviewText}
            multiline
            style={{
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.sm,
              padding: theme.spacing.sm,
              color: theme.colors.textPrimary,
              backgroundColor: theme.colors.bgSurface,
              minHeight: 60,
              marginBottom: theme.spacing.sm,
            }}
            editable={mode !== 'raw_voice_clip'}
            accessibilityLabel={mode === 'raw_voice_clip' ? '文字起こし結果（音声内容は変更されません）' : '送信するテキスト（編集できます）'}
          />

          <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="送信する" onPress={confirmSend} loading={sending} testID="compose-confirm-send" />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="やめる" variant="secondary" onPress={reset} />
            </View>
          </View>
        </>
      )}
    </View>
  );
}
