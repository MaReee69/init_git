import React from 'react';
import { Modal, Text, View } from 'react-native';

import { useTheme } from '@/theme';

import { GlassCard } from './GlassCard';
import { PrimaryButton } from './PrimaryButton';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

/**
 * いいね送信・条件の大幅な緩和など「重要な操作」の実行前に必ず挟む確認ダイアログ。
 * AIが自動で確定させず、必ず本人のタップ操作で確認する。
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'キャンセル',
  onConfirm,
  onCancel,
  danger,
}: ConfirmDialogProps) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          padding: theme.spacing.xl,
        }}
      >
        <GlassCard glowColor={danger ? 'coral' : 'aurora'}>
          <Text
            style={[theme.typography.title, { color: theme.colors.textPrimary, marginBottom: theme.spacing.sm }]}
            accessibilityRole="header"
          >
            {title}
          </Text>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginBottom: theme.spacing.lg }]}>
            {message}
          </Text>
          <PrimaryButton
            label={confirmLabel}
            onPress={onConfirm}
            variant={danger ? 'danger' : 'primary'}
            testID="confirm-dialog-confirm"
          />
          <View style={{ height: theme.spacing.xs }} />
          <PrimaryButton label={cancelLabel} onPress={onCancel} variant="ghost" testID="confirm-dialog-cancel" />
        </GlassCard>
      </View>
    </Modal>
  );
}
