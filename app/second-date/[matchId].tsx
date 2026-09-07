import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenContainer } from '@/components/ScreenContainer';
import { generateSecondDateProposalsResilient } from '@/lib/ai/resilientCalls';
import { useAuth } from '@/state/AuthProvider';
import {
  fetchSecondDateProposalContext,
  useCastDateProposalVote,
  useCreateSecondDateProposal,
  useDateProposals,
  useMutualReunionInterest,
} from '@/state/useDates';
import { useTheme } from '@/theme';
import type { DateProposalVoteChoice } from '@/types/domain';

const VOTE_OPTIONS: { value: DateProposalVoteChoice; label: string }[] = [
  { value: 'want', label: '行きたい' },
  { value: 'change', label: '条件を変えたい' },
  { value: 'other', label: '別案がいい' },
  { value: 'skip', label: '今回は見送る' },
];

export default function SecondDateScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();

  const mutualQuery = useMutualReunionInterest(matchId);
  const proposalsQuery = useDateProposals(matchId);
  const createMutation = useCreateSecondDateProposal(matchId);
  const voteMutation = useCastDateProposalVote(matchId);

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [myVotes, setMyVotes] = useState<Record<number, DateProposalVoteChoice>>({});
  const [confirmedMessage, setConfirmedMessage] = useState<string | null>(null);

  const latestProposal = proposalsQuery.data?.[0];

  async function handleGenerate() {
    if (!session) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const context = await fetchSecondDateProposalContext(session.userId, matchId);
      const result = await generateSecondDateProposalsResilient(session.userId, context);
      if (result.result.options.length === 0) {
        setGenerateError('現在AIがセカンドデート提案を作成できません。しばらくしてからもう一度お試しください。');
        return;
      }
      await createMutation.mutateAsync(result.result.options);
    } catch {
      setGenerateError('提案の作成に失敗しました。双方が「また会いたい」を選んでいるか確認してください。');
    } finally {
      setGenerating(false);
    }
  }

  async function handleVote(optionIndex: number, vote: DateProposalVoteChoice) {
    if (!latestProposal) return;
    setMyVotes((prev) => ({ ...prev, [optionIndex]: vote }));
    const result = await voteMutation.mutateAsync({ proposalId: latestProposal.id, optionIndex, vote });
    if (result.confirmed) {
      setConfirmedMessage('日程が確定しました！');
    }
  }

  if (mutualQuery.isLoading) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={theme.colors.aurora} />
      </ScreenContainer>
    );
  }

  if (!mutualQuery.data) {
    return (
      <ScreenContainer>
        <GlassCard>
          <Text style={[theme.typography.title, { color: theme.colors.textPrimary, marginBottom: theme.spacing.sm }]}>
            まだ利用できません
          </Text>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
            AIセカンドデート提案は、双方がデート後アンケートで「また会いたい」を選んだ場合にのみ利用できます。片方だけが希望した場合、その事実が相手に伝わることはありません。
          </Text>
        </GlassCard>
        <View style={{ marginTop: theme.spacing.lg }}>
          <PrimaryButton
            label="デート後アンケートに回答する"
            onPress={() => router.push({ pathname: '/date-feedback/[matchId]', params: { matchId } })}
          />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Text style={[theme.typography.title, { color: theme.colors.textPrimary, marginBottom: theme.spacing.sm }]}>
        AIセカンドデート提案
      </Text>
      <Text style={[theme.typography.caption, { color: theme.colors.textTertiary, marginBottom: theme.spacing.lg }]}>
        双方が共有した空き時間・大まかなエリア・共有可の感想だけから3案を作成します。正確な住所や非公開の予定は使いません。
      </Text>

      {confirmedMessage && (
        <GlassCard glowColor="aurora" style={{ marginBottom: theme.spacing.md }}>
          <Text style={[theme.typography.subtitle, { color: theme.colors.textPrimary }]}>{confirmedMessage}</Text>
        </GlassCard>
      )}

      {!latestProposal && (
        <GlassCard>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginBottom: theme.spacing.md }]}>
            まだ提案がありません。AIに3つの案を作ってもらいましょう。
          </Text>
          {generateError && (
            <Text style={[theme.typography.caption, { color: theme.colors.danger, marginBottom: theme.spacing.sm }]}>
              {generateError}
            </Text>
          )}
          <PrimaryButton label="AIに提案してもらう" onPress={handleGenerate} loading={generating} />
        </GlassCard>
      )}

      {latestProposal &&
        latestProposal.options.map((option, index) => {
          const isConfirmed = latestProposal.status === 'confirmed';
          const isConfirmedOption = latestProposal.confirmedOptionIndex === index;
          if (isConfirmed && !isConfirmedOption) return null;
          return (
            <GlassCard
              key={index}
              style={{ marginBottom: theme.spacing.md }}
              glowColor={isConfirmedOption ? 'aurora' : 'violet'}
            >
              <Text style={[theme.typography.subtitle, { color: theme.colors.textPrimary, marginBottom: theme.spacing.xs }]}>
                案{index + 1}: {option.placeOrFormat}
              </Text>
              <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
                📅 {option.dateTimeCandidate}（約{option.durationMinutes}分）
              </Text>
              <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
                💰 予算: {option.budgetRange === 'low' ? '控えめ' : option.budgetRange === 'high' ? '贅沢' : '普通'}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textTertiary, marginTop: theme.spacing.xs }]}>
                理由: {option.reason}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
                雨天時: {option.rainAlternative}
              </Text>

              {!isConfirmed && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs, marginTop: theme.spacing.sm }}>
                  {VOTE_OPTIONS.map((v) => (
                    <PrimaryButton
                      key={v.value}
                      label={v.label}
                      variant={myVotes[index] === v.value ? 'primary' : 'secondary'}
                      onPress={() => handleVote(index, v.value)}
                    />
                  ))}
                </View>
              )}
              {isConfirmedOption && (
                <Text style={[theme.typography.label, { color: theme.colors.aurora, marginTop: theme.spacing.sm }]}>
                  ✦ この案で確定しました
                </Text>
              )}
            </GlassCard>
          );
        })}
    </ScreenContainer>
  );
}
