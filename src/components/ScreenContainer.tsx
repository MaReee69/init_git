import React from 'react';
import { ScrollView, StyleSheet, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

interface ScreenContainerProps extends ViewProps {
  scroll?: boolean;
}

export function ScreenContainer({ children, style, scroll = true, ...rest }: ScreenContainerProps) {
  const theme = useTheme();
  const Wrapper = scroll ? ScrollView : View;
  const contentProps = scroll ? { contentContainerStyle: styles.scrollContent } : {};

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.bgBase }]} edges={['top', 'bottom']}>
      <Wrapper
        style={[styles.flex, style]}
        {...contentProps}
        {...rest}
      >
        {children}
      </Wrapper>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
});
