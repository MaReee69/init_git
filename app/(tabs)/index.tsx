import React, { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { GlassCard } from '@/components/GlassCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenContainer } from '@/components/ScreenContainer';
import { CandidateCard } from '@/features/matching/CandidateCard';
import { AiOrb } from '@/features/orb/AiOrb';
import type { OrbState } from '@/features/orb/types';
import { useVoiceRecorder } from '@/features/voice/useVoiceRecorder';
import { Waveform } from '@/features/voice/Waveform';
import { aiAdapters } from '@/lib/ai';
import type { VoiceCommandIntent } from '@/lib/ai/types';
import type { CandidateListItem } from '@/lib/backend/types';
import { applySearchCriteria } from '@/lib/matching';
import type { SearchCriteria } from '@/schemas/searchCriteria';
import { useCandidates, useLikeProfile, useRecordRecommendationEvent } from '@/state/useMatching';
import { useTheme } from '@/theme';

type Step = 'prompt' | 'criteria_review' | 'searching' | 'no_candidates' | 'browsing' | 'browsing_end' | 'ended';

const INITIAL_PROMPT = '今日はどんな人と話してみたいですか？希望のエリアや会える曜日、興味があれば教えてください。';

const INTENT_LABEL: Record<string, string> = {
  casual: 'カジュアルな出会い',
  serious: '真剣な交際',
  marriage_oriented: '結婚を見据えた交際',
  undecided: 'こだわらない',
};
const BUDGET_LABEL: Record<string, string> = { low: '控えめな予算', mid: '普通の予算', high: '贅沢な予算' };
const WEEKDAY_LABEL = ['日', '月', '火', '水', '木', '金', '土'];
const TIME_BAND_LABEL: Record<string, string> = { morning: '朝', afternoon: '午後', evening: '夜', night: '深夜' };

export default function HomeConciergeScreen() {
  const theme = useTheme();
  const recorder = useVoiceRecorder();
  const candidatesQuery = useCandidates();
  const likeMutation = useLikeProfile();
  const recordEvent = useRecordRecommendationEvent();

  const [step, setStep] = useState<Step>('prompt');
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [promptText, setPromptText] = useState(INITIAL_PROMPT);
  const [manualInput, setManualInput] = useState('');
  const [criteria, setCriteria] = useState<SearchCriteria>({});
  const [pool, setPool] = useState<CandidateListItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [eliminatedBy, setEliminatedBy] = useState<'area' | 'availability' | undefined>();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [confirmLike, setConfirmLike] = useState(false);
  const [matchedName, setMatchedName] = useState<string | null>(null);
  const [askedFollowUp, setAskedFollowUp] = useState(false);

  const currentCandidate = pool[currentIndex];

  const criteriaChips = useMemo(() => {
    const chips: { key: string; label: string }[] = [];
    if (criteria.hardFilters?.area) chips.push({ key: 'area', label: `エリア: ${criteria.hardFilters.area}` });
    (criteria.hardFilters?.availability ?? []).forEach((slot, idx) =>
      chips.push({ key: `avail-${idx}`, label: `${WEEKDAY_LABEL[slot.weekday]}曜${TIME_BAND_LABEL[slot.timeBand]}` }),
    );
    (criteria.softPreferences?.interestKeywords ?? []).forEach((k) => chips.push({ key: `interest-${k}`, label: k }));
    if (criteria.intent) chips.push({ key: 'intent', label: INTENT_LABEL[criteria.intent] ?? criteria.intent });
    if (criteria.budget) chips.push({ key: 'budget', label: BUDGET_LABEL[criteria.budget] });
    return chips;
  }, [criteria]);

  async function processCriteriaTranscript(transcript: string) {
    setOrbState('thinking');
    try {
      const result = await aiAdapters.llm.extractSearchCriteria({ transcript, history: [] });
      setCriteria((prev) => ({
        hardFilters: { ...prev.hardFilters, ...result.criteria.hardFilters },
        softPreferences: { ...prev.softPreferences, ...result.criteria.softPreferences },
        intent: result.criteria.intent ?? prev.intent,
        budget: result.criteria.budget ?? prev.budget,
        dateStyle: result.criteria.dateStyle ?? prev.dateStyle,
      }));

      if (result.followUpQuestion && !askedFollowUp) {
        setAskedFollowUp(true);
        setPromptText(result.followUpQuestion);
        setOrbState('confirm');
        setStep('prompt');
      } else {
        setOrbState('found');
        setStep('criteria_review');
      }
    } catch {
      setOrbState('error');
      setStatusMessage('うまく聞き取れませんでした。もう一度お話しいただくか、下の入力欄をお使いください。');
    }
  }

  async function handleStartRecording() {
    setStatusMessage(null);
    const ok = await recorder.start();
    if (!ok) {
      setStatusMessage('マイクへのアクセスが許可されていません。下の入力欄からテキストで話しかけてください。');
      return;
    }
    setOrbState('listening');
  }

  async function handleStopRecordingForCriteria() {
    const uri = await recorder.stop();
    setOrbState('thinking');
    const transcription = await aiAdapters.stt.transcribe({ uri: uri ?? '' });
    await processCriteriaTranscript(transcription.text);
  }

  function handleManualSubmit() {
    if (manualInput.trim().length === 0) return;
    const text = manualInput.trim();
    setManualInput('');
    void processCriteriaTranscript(text);
  }

  function beginSearch(searchCriteria: SearchCriteria) {
    setOrbState('thinking');
    setStep('searching');
    const result = applySearchCriteria(candidatesQuery.data ?? [], searchCriteria);
    if (result.eliminatedBy) {
      setEliminatedBy(result.eliminatedBy);
      setPool([]);
      setOrbState('confirm');
      setStep('no_candidates');
      return;
    }
    setPool(result.candidates);
    setCurrentIndex(0);
    setEliminatedBy(undefined);
    if (result.candidates.length === 0) {
      setOrbState('confirm');
      setStep('no_candidates');
      return;
    }
    result.candidates.slice(0, 3).forEach((c) => {
      void recordEvent.mutateAsync({ eventType: 'recommendation_impression', candidateProfileId: c.candidate.profileId });
    });
    setOrbState('found');
    setStep('browsing');
  }

  function relaxCondition(kind: 'area' | 'availability') {
    const next: SearchCriteria = {
      ...criteria,
      hardFilters: {
        ...criteria.hardFilters,
        area: kind === 'area' ? undefined : criteria.hardFilters?.area,
        availability: kind === 'availability' ? undefined : criteria.hardFilters?.availability,
      },
    };
    setCriteria(next);
    beginSearch(next);
  }

  function resetAll() {
    setCriteria({});
    setPool([]);
    setCurrentIndex(0);
    setEliminatedBy(undefined);
    setAskedFollowUp(false);
    setPromptText(INITIAL_PROMPT);
    setStatusMessage(null);
    setOrbState('idle');
    setStep('prompt');
  }

  async function handleLike() {
    if (!currentCandidate) return;
    setConfirmLike(false);
    const result = await likeMutation.mutateAsync(currentCandidate.candidate.profileId);
    if (result.matched) {
      setMatchedName(currentCandidate.displayName);
    } else {
      goToNext();
    }
  }

  function goToNext() {
    if (currentIndex + 1 < pool.length) {
      setCurrentIndex((i) => i + 1);
      setOrbState('found');
    } else {
      setStep('browsing_end');
      setOrbState('idle');
    }
  }

  async function executeCommand(intent: VoiceCommandIntent) {
    switch (intent) {
      case 'more_detail':
        setStatusMessage(
          `${currentCandidate?.bio ? currentCandidate.bio : '自己紹介はまだ登録されていません。'}`,
        );
        break;
      case 'next':
        goToNext();
        break;
      case 'like':
        setConfirmLike(true);
        break;
      case 'change_criteria':
        setStep('criteria_review');
        setOrbState('confirm');
        break;
      case 'end_session':
        setStep('ended');
        setOrbState('idle');
        break;
      case 'unknown':
      default:
        setStatusMessage('うまく聞き取れませんでした。もう一度お話しいただくか、下のボタンをお使いください。');
        break;
    }
  }

  async function handleStopRecordingForCommand() {
    const uri = await recorder.stop();
    setOrbState('thinking');
    setStatusMessage(null);
    try {
      const transcription = await aiAdapters.stt.transcribe({ uri: uri ?? '' });
      const intent = await aiAdapters.llm.classifyVoiceCommand(transcription.text);
      await executeCommand(intent);
      if (intent !== 'unknown') setOrbState('found');
      else setOrbState('error');
    } catch {
      setOrbState('error');
      setStatusMessage('うまく聞き取れませんでした。もう一度お話しいただくか、下のボタンをお使いください。');
    }
  }

  return (
    <ScreenContainer>
      <View style={{ alignItems: 'center', marginBottom: theme.spacing.lg }}>
        <AiOrb state={orbState} size={130} />
      </View>

      {recorder.isRecording && (
        <View
          style={{
            alignSelf: 'center',
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: `${theme.colors.danger}22`,
            borderRadius: theme.radii.pill,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.xxs,
            marginBottom: theme.spacing.md,
          }}
        >
          <Text style={{ color: theme.colors.danger, fontWeight: '700' }}>● マイク使用中</Text>
        </View>
      )}
      <View style={{ height: 24, alignItems: 'center', marginBottom: theme.spacing.md }}>
        <Waveform active={recorder.isRecording} />
      </View>

      {step === 'prompt' && (
        <>
          <GlassCard style={{ marginBottom: theme.spacing.md }}>
            <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>{promptText}</Text>
          </GlassCard>
          {!recorder.isRecording ? (
            <PrimaryButton label="押して話す" onPress={handleStartRecording} testID="concierge-start" />
          ) : (
            <PrimaryButton
              label="話し終える"
              variant="danger"
              onPress={handleStopRecordingForCriteria}
              testID="concierge-stop"
            />
          )}
          <View style={{ marginTop: theme.spacing.md }}>
            <TextInput
              value={manualInput}
              onChangeText={setManualInput}
              placeholder="話す代わりにここに入力することもできます"
              placeholderTextColor={theme.colors.textTertiary}
              style={{
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.sm,
                padding: theme.spacing.sm,
                color: theme.colors.textPrimary,
                backgroundColor: theme.colors.bgSurface,
                marginBottom: theme.spacing.sm,
              }}
              onSubmitEditing={handleManualSubmit}
            />
            <PrimaryButton label="この内容で伝える" variant="secondary" onPress={handleManualSubmit} />
          </View>
        </>
      )}

      {step === 'criteria_review' && (
        <>
          <Text style={[theme.typography.subtitle, { color: theme.colors.textPrimary, marginBottom: theme.spacing.sm }]}>
            この条件で探しますか？
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: theme.spacing.md }}>
            {criteriaChips.length === 0 ? (
              <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
                特に条件は指定されていません（全体から探します）
              </Text>
            ) : (
              criteriaChips.map((chip) => <Chip key={chip.key} label={chip.label} accent="aurora" selected />)
            )}
          </View>
          <PrimaryButton label="この条件で探す" onPress={() => beginSearch(criteria)} testID="confirm-search" />
          <View style={{ height: theme.spacing.sm }} />
          <PrimaryButton label="話し直す" variant="secondary" onPress={resetAll} />
        </>
      )}

      {step === 'no_candidates' && (
        <GlassCard>
          <Text style={[theme.typography.body, { color: theme.colors.textPrimary, marginBottom: theme.spacing.md }]}>
            {eliminatedBy === 'area'
              ? 'そのエリア条件に合う方が見つかりませんでした。何を緩めますか？'
              : eliminatedBy === 'availability'
                ? 'その空き時間に合う方が見つかりませんでした。何を緩めますか？'
                : '現在ご紹介できる候補がいません。条件を見直しますか？'}
          </Text>
          {eliminatedBy === 'area' && (
            <PrimaryButton label="エリア条件をやめて探す" onPress={() => relaxCondition('area')} />
          )}
          {eliminatedBy === 'availability' && (
            <PrimaryButton label="空き時間条件をやめて探す" onPress={() => relaxCondition('availability')} />
          )}
          <View style={{ height: theme.spacing.sm }} />
          <PrimaryButton label="最初からやり直す" variant="secondary" onPress={resetAll} />
        </GlassCard>
      )}

      {step === 'browsing' && currentCandidate && (
        <>
          <CandidateCard item={currentCandidate} />
          {statusMessage && (
            <GlassCard style={{ marginTop: theme.spacing.sm }}>
              <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{statusMessage}</Text>
            </GlassCard>
          )}
          <View style={{ marginTop: theme.spacing.md }}>
            {!recorder.isRecording ? (
              <PrimaryButton label="押して話す" onPress={handleStartRecording} />
            ) : (
              <PrimaryButton label="話し終える" variant="danger" onPress={handleStopRecordingForCommand} />
            )}
          </View>
          <Text style={[theme.typography.caption, { color: theme.colors.textTertiary, marginTop: theme.spacing.sm, marginBottom: theme.spacing.xs }]}>
            「もう少し詳しく」「次の人」「この人いいかも」「条件を変えて」「今日は終わる」と話しかけるか、下のボタンをタップしてください。
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
            <PrimaryButton label="もっと詳しく" variant="secondary" onPress={() => executeCommand('more_detail')} />
            <PrimaryButton label="次の人" variant="secondary" onPress={() => executeCommand('next')} />
            <PrimaryButton label="いいね" onPress={() => executeCommand('like')} />
            <PrimaryButton label="条件を変える" variant="secondary" onPress={() => executeCommand('change_criteria')} />
            <PrimaryButton label="今日は終わる" variant="ghost" onPress={() => executeCommand('end_session')} />
          </View>
        </>
      )}

      {step === 'browsing_end' && (
        <GlassCard>
          <Text style={[theme.typography.body, { color: theme.colors.textPrimary, marginBottom: theme.spacing.md }]}>
            今回ご紹介できる候補はこれで全員です。条件を変えて探し直しますか？
          </Text>
          <PrimaryButton label="条件を変えて探す" onPress={() => setStep('criteria_review')} />
          <View style={{ height: theme.spacing.sm }} />
          <PrimaryButton label="今日は終わる" variant="secondary" onPress={() => setStep('ended')} />
        </GlassCard>
      )}

      {step === 'ended' && (
        <GlassCard>
          <Text style={[theme.typography.body, { color: theme.colors.textPrimary, marginBottom: theme.spacing.md }]}>
            今日はここまでにしましょう。またお話ししましょう。
          </Text>
          <PrimaryButton label="もう一度探す" onPress={resetAll} />
        </GlassCard>
      )}

      <ConfirmDialog
        visible={confirmLike}
        title="いいねを送りますか？"
        message={`${currentCandidate?.displayName ?? ''}さんにいいねを送ります。相思相愛になるとマッチが成立します。`}
        confirmLabel="いいねを送る"
        onConfirm={handleLike}
        onCancel={() => setConfirmLike(false)}
      />
      <ConfirmDialog
        visible={!!matchedName}
        title="マッチしました！"
        message={`${matchedName}さんと相思相愛になりました。チャットはPhase3で実装予定です。`}
        confirmLabel="次へ進む"
        onConfirm={() => {
          setMatchedName(null);
          goToNext();
        }}
        onCancel={() => {
          setMatchedName(null);
          goToNext();
        }}
      />
    </ScreenContainer>
  );
}
