import { BlurView } from 'expo-blur';
import React from 'react';
import { Platform, StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from '@/theme';

interface GlassCardProps extends ViewProps {
  intensity?: number;
  glowColor?: 'aurora' | 'violet' | 'coral' | 'none';
}

/**
 * 半透明ガラスレイヤー + 繊細な境界線。Warm Futurismの基本サーフェス。
 * Webではネイティブblurの代わりにCSS的な半透明背景へフォールバックする。
 */
export function GlassCard({ style, intensity = 40, glowColor = 'none', children, ...rest }: GlassCardProps) {
  const theme = useTheme();
  const glowStyle = glowColor !== 'none' ? theme.glow[glowColor] : undefined;

  const content = (
    <View
      style={[
        styles.base,
        {
          borderRadius: theme.radii.md,
          borderColor: theme.colors.border,
          backgroundColor: Platform.OS === 'web' ? theme.colors.bgSurface : 'transparent',
        },
        glowStyle,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );

  if (Platform.OS === 'web') {
    return content;
  }

  return (
    <View style={[{ borderRadius: theme.radii.md, overflow: 'hidden' }, glowStyle]}>
      <BlurView intensity={intensity} tint={theme.mode} style={StyleSheet.absoluteFill} />
      <View
        style={[
          styles.base,
          {
            borderRadius: theme.radii.md,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.bgSurface,
          },
          style,
        ]}
        {...rest}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
});
