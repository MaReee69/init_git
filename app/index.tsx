import { Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/state/AuthProvider';
import { useMyProfile } from '@/state/useMyProfile';
import { useTheme } from '@/theme';

export default function Index() {
  const { session, isLoading: authLoading } = useAuth();
  const theme = useTheme();
  const profileQuery = useMyProfile();

  if (authLoading || (session && profileQuery.isLoading)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bgBase }}>
        <ActivityIndicator color={theme.colors.aurora} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/welcome" />;
  }

  const profile = profileQuery.data;
  if (!profile?.termsAgreedAt || !profile?.privacyAgreedAt) {
    return <Redirect href="/(onboarding)/age-consent" />;
  }
  if (!profile?.onboardingCompletedAt) {
    return <Redirect href="/(onboarding)/profile-method" />;
  }
  return <Redirect href="/(tabs)" />;
}
