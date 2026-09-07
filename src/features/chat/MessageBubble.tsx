import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';
import type { Message } from '@/types/domain';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  isLastOwn: boolean;
}

const AI_MODE_LABEL: Record<string, string> = {
  own_voice_cleanup: '自分の言葉（音声入力）',
  ai_draft: 'AI文案',
  raw_voice_clip: '声のメッセージ',
};

export function MessageBubble({ message, isOwn, isLastOwn }: MessageBubbleProps) {
  const theme = useTheme();

  return (
    <View style={{ alignItems: isOwn ? 'flex-end' : 'flex-start', marginBottom: theme.spacing.sm }}>
      {message.aiMode && (
        <Text style={[theme.typography.caption, { color: theme.colors.textTertiary, marginBottom: 2 }]}>
          {message.contentType === 'voice' ? '🔊 ' : ''}
          {AI_MODE_LABEL[message.aiMode] ?? message.aiMode}
        </Text>
      )}
      <View
        style={{
          maxWidth: '80%',
          borderRadius: theme.radii.md,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          backgroundColor: isOwn ? theme.colors.aurora : theme.colors.bgSurfaceStrong,
          borderWidth: isOwn ? 0 : StyleSheet.hairlineWidth,
          borderColor: theme.colors.border,
        }}
      >
        <Text style={{ color: isOwn ? theme.colors.bgBase : theme.colors.textPrimary }}>
          {message.body ?? '（内容なし）'}
        </Text>
      </View>
      <Text style={[theme.typography.caption, { color: theme.colors.textTertiary, marginTop: 2 }]}>
        {new Date(message.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
        {isOwn && isLastOwn ? (message.readAt ? '　既読' : '　未読') : ''}
      </Text>
    </View>
  );
}
