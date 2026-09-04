import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface OptionGroupProps<T extends string> {
  label: string;
  options: Option<T>[];
  value: T | T[] | undefined;
  onChange: (value: T) => void;
  multiple?: boolean;
  error?: string;
}

export function OptionGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  multiple,
  error,
}: OptionGroupProps<T>) {
  const theme = useTheme();
  const isSelected = (v: T) => (multiple && Array.isArray(value) ? value.includes(v) : value === v);

  return (
    <View style={styles.wrapper}>
      <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.xs }]}>
        {label}
      </Text>
      <View style={styles.row}>
        {options.map((opt) => {
          const selected = isSelected(opt.value);
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={opt.label}
              style={[
                styles.option,
                {
                  borderRadius: theme.radii.pill,
                  borderColor: selected ? theme.colors.aurora : theme.colors.border,
                  backgroundColor: selected ? `${theme.colors.aurora}22` : theme.colors.bgSurface,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.xs,
                },
              ]}
            >
              <Text style={{ color: selected ? theme.colors.aurora : theme.colors.textPrimary, fontWeight: '600' }}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Text style={[theme.typography.caption, { color: theme.colors.danger, marginTop: theme.spacing.xxs }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  option: {
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 8,
    marginBottom: 8,
  },
});
