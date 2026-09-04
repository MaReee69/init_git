import React, { createContext, useContext, useMemo, useState } from 'react';

import type { VoiceExtractedProfile } from '@/schemas/profile';

interface OnboardingDraftContextValue {
  draft: VoiceExtractedProfile;
  transcript: string;
  setDraft: (patch: VoiceExtractedProfile) => void;
  setTranscript: (text: string) => void;
  clearDraft: () => void;
}

const OnboardingDraftContext = createContext<OnboardingDraftContextValue | null>(null);

/**
 * 音声オンボーディングで抽出した項目を、テキストフォーム画面へ引き継ぐための一時状態。
 * 「最後に本人が一覧で確認する」要件を満たすため、確定はprofile-form側の送信時のみ行う。
 */
export function OnboardingDraftProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraftState] = useState<VoiceExtractedProfile>({});
  const [transcript, setTranscript] = useState('');

  const value = useMemo<OnboardingDraftContextValue>(
    () => ({
      draft,
      transcript,
      setDraft: (patch) => setDraftState((prev) => ({ ...prev, ...patch })),
      setTranscript,
      clearDraft: () => {
        setDraftState({});
        setTranscript('');
      },
    }),
    [draft, transcript],
  );

  return <OnboardingDraftContext.Provider value={value}>{children}</OnboardingDraftContext.Provider>;
}

export function useOnboardingDraft(): OnboardingDraftContextValue {
  const ctx = useContext(OnboardingDraftContext);
  if (!ctx) throw new Error('useOnboardingDraft must be used within OnboardingDraftProvider');
  return ctx;
}
