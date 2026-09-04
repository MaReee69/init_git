import React from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  helperText?: string;
}

export function TextField({ label, error, helperText, style, ...rest }: TextFieldProps) {
  const theme = useTheme();

  return (
    <View style={styles.wrapper}>
      <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.xxs }]}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.colors.textTertiary}
        style={[
          styles.input,
          theme.typography.body,
          {
            color: theme.colors.textPrimary,
            borderColor: error ? theme.colors.danger : theme.colors.border,
            backgroundColor: theme.colors.bgSurface,
            borderRadius: theme.radii.sm,
            paddingHorizontal: theme.spacing.md,
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text style={[theme.typography.caption, { color: theme.colors.danger, marginTop: theme.spacing.xxs }]}>
          {error}
        </Text>
      ) : helperText ? (
        <Text style={[theme.typography.caption, { color: theme.colors.textTertiary, marginTop: theme.spacing.xxs }]}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
});
