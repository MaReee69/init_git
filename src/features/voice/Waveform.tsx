import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useTheme } from '@/theme';

const BAR_COUNT = 5;

function Bar({ active, delay, color }: { active: boolean; delay: number; color: string }) {
  const height = useSharedValue(0.3);
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    cancelAnimation(height);
    if (!active || reduceMotion) {
      height.value = withTiming(active ? 0.6 : 0.3, { duration: 150 });
      return;
    }
    height.value = withRepeat(
      withTiming(1, { duration: 420 + delay, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [active, reduceMotion, delay, height]);

  const style = useAnimatedStyle(() => ({
    height: `${height.value * 100}%`,
  }));

  return (
    <View style={styles.barTrack}>
      <Animated.View style={[styles.bar, style, { backgroundColor: color }]} />
    </View>
  );
}

/** 音声認識中に表示する波形。マイク入力の実振幅ではなく、録音中かどうかで動きを表現する簡易版 */
export function Waveform({ active }: { active: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <Bar key={i} active={active} delay={i * 60} color={theme.colors.aurora} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 32,
    gap: 4,
  },
  barTrack: {
    width: 6,
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: 6,
    borderRadius: 3,
  },
});
