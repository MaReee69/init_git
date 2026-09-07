import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { GlassCard } from '@/components/GlassCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ComposePanel, type ComposeSendPayload } from '@/features/chat/ComposePanel';
import { MessageBubble } from '@/features/chat/MessageBubble';
import { useAuth } from '@/state/AuthProvider';
import { useBlockProfile, useMarkRead, useMessages, useReportProfile, useSendMessage, useUnmatch } from '@/state/useChat';
import { useMyMatches } from '@/state/useMatching';
import { useTheme } from '@/theme';

const REPORT_REASONS: { code: string; label: string }[] = [
  { code: 'harassment', label: '嫌がらせ・迷惑行為' },
  { code: 'inappropriate_content', label: '不適切な内容' },
  { code: 'fake_profile', label: 'なりすまし・虚偽プロフィール' },
  { code: 'other', label: 'その他' },
];

export default function ChatScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();

  const matchesQuery = useMyMatches();
  const match = matchesQuery.data?.find((m) => m.match.id === matchId);

  const messagesQuery = useMessages(matchId);
  const sendMutation = useSendMessage(matchId);
  const markReadMutation = useMarkRead(matchId);
  const blockMutation = useBlockProfile();
  const reportMutation = useReportProfile();
  const unmatchMutation = useUnmatch();

  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [reportDetail, setReportDetail] = useState('');
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [confirmUnmatch, setConfirmUnmatch] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const messages = messagesQuery.data ?? [];

  useEffect(() => {
    if (messages.length > 0) {
      markReadMutation.mutate();
      scrollRef.current?.scrollToEnd({ animated: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  if (!match) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bgBase, padding: theme.spacing.xl }}>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          このマッチは見つかりませんでした（解除された可能性があります）。
        </Text>
        <PrimaryButton label="戻る" variant="secondary" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const counterpart = match.counterpart;

  async function handleSend(payload: ComposeSendPayload) {
    await sendMutation.mutateAsync({
      contentType: payload.contentType,
      body: payload.body,
      aiMode: payload.aiMode,
      voiceClip: payload.voiceClip,
    });
  }

  async function handleReportSubmit() {
    if (!reportReason) return;
    await reportMutation.mutateAsync({
      targetProfileId: counterpart.id,
      matchId,
      reasonCode: reportReason,
      detail: reportDetail.trim() || undefined,
    });
    setReportOpen(false);
    setReportReason(null);
    setReportDetail('');
  }

  async function handleBlock() {
    setConfirmBlock(false);
    setMenuOpen(false);
    await blockMutation.mutateAsync(counterpart.id);
    router.back();
  }

  async function handleUnmatch() {
    setConfirmUnmatch(false);
    setMenuOpen(false);
    await unmatchMutation.mutateAsync(matchId);
    router.back();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bgBase }} edges={['top', 'bottom']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: theme.spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        }}
      >
        <PrimaryButton label="← 戻る" variant="ghost" onPress={() => router.back()} />
        <Text style={[theme.typography.subtitle, { color: theme.colors.textPrimary }]}>{counterpart.displayName}</Text>
        <PrimaryButton label="⋯" variant="ghost" onPress={() => setMenuOpen(true)} />
      </View>

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: theme.spacing.md }}>
        {messages.length === 0 && (
          <GlassCard>
            <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
              マッチしました！最初のメッセージを送ってみましょう。
            </Text>
          </GlassCard>
        )}
        {messages.map((m, idx) => {
          const isOwn = m.senderId === session?.userId;
          const isLastOwn = isOwn && messages.slice(idx + 1).every((later) => later.senderId !== session?.userId);
          return <MessageBubble key={m.id} message={m} isOwn={isOwn} isLastOwn={isLastOwn} />;
        })}
      </ScrollView>

      <ComposePanel userId={session!.userId} onSend={handleSend} />

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <GlassCard style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
            <PrimaryButton
              label="通報する"
              variant="secondary"
              onPress={() => {
                setMenuOpen(false);
                setReportOpen(true);
              }}
            />
            <View style={{ height: theme.spacing.xs }} />
            <PrimaryButton
              label="ブロックする"
              variant="danger"
              onPress={() => {
                setMenuOpen(false);
                setConfirmBlock(true);
              }}
            />
            <View style={{ height: theme.spacing.xs }} />
            <PrimaryButton
              label="マッチを解除する"
              variant="secondary"
              onPress={() => {
                setMenuOpen(false);
                setConfirmUnmatch(true);
              }}
            />
            <View style={{ height: theme.spacing.xs }} />
            <PrimaryButton label="閉じる" variant="ghost" onPress={() => setMenuOpen(false)} />
          </GlassCard>
        </View>
      </Modal>

      <Modal visible={reportOpen} transparent animationType="fade" onRequestClose={() => setReportOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: theme.spacing.xl }}>
          <GlassCard>
            <Text style={[theme.typography.title, { color: theme.colors.textPrimary, marginBottom: theme.spacing.sm }]}>
              通報する
            </Text>
            {REPORT_REASONS.map((r) => (
              <PrimaryButton
                key={r.code}
                label={r.label}
                variant={reportReason === r.code ? 'primary' : 'secondary'}
                onPress={() => setReportReason(r.code)}
              />
            ))}
            <TextInput
              value={reportDetail}
              onChangeText={setReportDetail}
              placeholder="詳細（任意）"
              placeholderTextColor={theme.colors.textTertiary}
              multiline
              style={{
                marginTop: theme.spacing.sm,
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.sm,
                padding: theme.spacing.sm,
                color: theme.colors.textPrimary,
                minHeight: 60,
              }}
            />
            <View style={{ height: theme.spacing.sm }} />
            <PrimaryButton label="通報を送信する" onPress={handleReportSubmit} disabled={!reportReason} />
            <View style={{ height: theme.spacing.xs }} />
            <PrimaryButton label="キャンセル" variant="ghost" onPress={() => setReportOpen(false)} />
          </GlassCard>
        </View>
      </Modal>

      <ConfirmDialog
        visible={confirmBlock}
        title="ブロックしますか？"
        message={`${counterpart.displayName}さんをブロックします。マッチとチャットは即座に解除され、お互いに表示されなくなります。`}
        confirmLabel="ブロックする"
        danger
        onConfirm={handleBlock}
        onCancel={() => setConfirmBlock(false)}
      />
      <ConfirmDialog
        visible={confirmUnmatch}
        title="マッチを解除しますか？"
        message={`${counterpart.displayName}さんとのマッチを解除します。この操作は取り消せません。`}
        confirmLabel="マッチを解除する"
        onConfirm={handleUnmatch}
        onCancel={() => setConfirmUnmatch(false)}
      />
    </SafeAreaView>
  );
}
