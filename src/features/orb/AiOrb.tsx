import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useTheme } from '@/theme';

import { ORB_STATE_LABEL, type OrbState } from './types';

interface AiOrbProps {
  state: OrbState;
  size?: number;
}

const STATE_ICON: Record<OrbState, string> = {
  idle: '',
  listening: '〜〜〜',
  thinking: '···',
  found: '✦',
  confirm: '？',
  error: '！',
};

const STATE_SHAPE_RADIUS_RATIO: Record<OrbState, number> = {
  idle: 0.5,
  listening: 0.5,
  thinking: 0.32,
  found: 0.5,
  confirm: 0.5,
  error: 0.4,
};

export function AiOrb({ state, size = 160 }: AiOrbProps) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();

  const breathe = useSharedValue(1);
  const pulseRing = useSharedValue(0);
  const rotate = useSharedValue(0);
  const shakeX = useSharedValue(0);
  const burst = useSharedValue(1);

  useEffect(() => {
    cancelAnimation(breathe);
    cancelAnimation(pulseRing);
    cancelAnimation(rotate);
    cancelAnimation(shakeX);
    cancelAnimation(burst);
    breathe.value = 1;
    pulseRing.value = 0;
    rotate.value = 0;
    shakeX.value = 0;
    burst.value = 1;

    if (reduceMotion) {
      return;
    }

    switch (state) {
      case 'idle':
        breathe.value = withRepeat(withTiming(1.06, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true);
        break;
      case 'listening':
        pulseRing.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.out(Easing.ease) }), -1, false);
        breathe.value = withRepeat(withTiming(1.1, { duration: 500, easing: Easing.inOut(Easing.sin) }), -1, true);
        break;
      case 'thinking':
        rotate.value = withRepeat(withTiming(360, { duration: 2200, easing: Easing.linear }), -1, false);
        break;
      case 'found':
        burst.value = withSequence(
          withTiming(1.25, { duration: 220, easing: Easing.out(Easing.back(2)) }),
          withTiming(1, { duration: 220, easing: Easing.inOut(Easing.ease) }),
        );
        break;
      case 'confirm':
        pulseRing.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.ease) }), -1, false);
        break;
      case 'error':
        shakeX.value = withSequence(
          withTiming(-8, { duration: 60 }),
          withTiming(8, { duration: 60 }),
          withTiming(-6, { duration: 60 }),
          withTiming(6, { duration: 60 }),
          withTiming(0, { duration: 60 }),
        );
        break;
      default:
        break;
    }
  }, [state, reduceMotion, breathe, pulseRing, rotate, shakeX, burst]);

  const coreStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: reduceMotion ? 1 : breathe.value * burst.value },
      { translateX: reduceMotion ? 0 : shakeX.value },
      { rotate: reduceMotion ? '0deg' : `${rotate.value}deg` },
    ],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0 : 1 - pulseRing.value,
    transform: [{ scale: reduceMotion ? 1 : 1 + pulseRing.value * 0.5 }],
  }));

  const stateColor =
    state === 'thinking'
      ? theme.colors.violet
      : state === 'confirm'
        ? theme.colors.violet
        : state === 'found'
          ? theme.colors.coral
          : state === 'error'
            ? theme.colors.danger
            : theme.colors.aurora;

  return (
    <View style={styles.wrapper} accessibilityRole="image" accessibilityLabel={`AIオーブ: ${ORB_STATE_LABEL[state]}`}>
      <View style={[styles.ringContainer, { width: size, height: size }]}>
        {(state === 'listening' || state === 'confirm') && (
          <Animated.View
            style={[
              styles.ring,
              ringStyle,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                borderColor: stateColor,
              },
            ]}
          />
        )}
        <Animated.View
          style={[
            coreStyle,
            {
              width: size * 0.72,
              height: size * 0.72,
              borderRadius: size * 0.72 * STATE_SHAPE_RADIUS_RATIO[state],
              backgroundColor: stateColor,
              shadowColor: stateColor,
              shadowOpacity: 0.5,
              shadowRadius: 30,
              shadowOffset: { width: 0, height: 0 },
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <Text style={[styles.icon, { color: theme.colors.bgBase }]}>{STATE_ICON[state]}</Text>
        </Animated.View>
      </View>
      <Text style={[theme.typography.subtitle, { color: theme.colors.textSecondary, marginTop: theme.spacing.md }]}>
        {ORB_STATE_LABEL[state]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  ringContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
  },
  icon: {
    fontSize: 22,
    fontWeight: '700',
  },
});
