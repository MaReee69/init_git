import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/theme';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
  accent?: 'aurora' | 'violet' | 'coral';
}

/**
 * AIが会話から抽出した条件（希望エリア・曜日・目的 等）を短く表示するチップ。
 */
export function Chip({ label, selected, onPress, onRemove, accent = 'aurora' }: ChipProps) {
  const theme = useTheme();
  const accentColor = theme.colors[accent];

  return (
    <Pressable
      onPress={onRemove ?? onPress}
      accessibilityRole={onPress || onRemove ? 'button' : 'text'}
      accessibilityLabel={onRemove ? `${label}を削除` : label}
      style={[
        styles.chip,
        {
          borderRadius: theme.radii.pill,
          borderColor: selected ? accentColor : theme.colors.border,
          backgroundColor: selected ? `${accentColor}22` : theme.colors.bgSurface,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.xxs,
        },
      ]}
    >
      <Text style={[styles.label, { color: selected ? accentColor : theme.colors.textSecondary }]}>{label}</Text>
      {onRemove ? <Text style={[styles.remove, { color: theme.colors.textTertiary }]}> ×</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 8,
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  remove: {
    fontSize: 13,
    marginLeft: 2,
  },
});
