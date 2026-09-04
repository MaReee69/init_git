import { Stack } from 'expo-router';
import React from 'react';

import { OnboardingDraftProvider } from '@/state/OnboardingDraftProvider';

export default function OnboardingLayout() {
  return (
    <OnboardingDraftProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </OnboardingDraftProvider>
  );
}
