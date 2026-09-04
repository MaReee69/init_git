import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Text, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { OptionGroup } from '@/components/OptionGroup';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenContainer } from '@/components/ScreenContainer';
import { TextField } from '@/components/TextField';
import { backend } from '@/lib/backend';
import { profileFormSchema, type ProfileFormInput } from '@/schemas/profile';
import { useAuth } from '@/state/AuthProvider';
import { useOnboardingDraft } from '@/state/OnboardingDraftProvider';
import { useInvalidateMyProfile } from '@/state/useMyProfile';
import { useTheme } from '@/theme';
import type { TimeBand, Weekday } from '@/types/domain';

const GENDER_OPTIONS = [
  { value: 'male', label: '男性' },
  { value: 'female', label: '女性' },
  { value: 'nonbinary', label: 'ノンバイナリー' },
  { value: 'self_describe', label: 'その他（自由記述）' },
] as const;

const INTENT_OPTIONS = [
  { value: 'casual', label: 'カジュアルな出会い' },
  { value: 'serious', label: '真剣な交際' },
  { value: 'marriage_oriented', label: '結婚を見据えた交際' },
  { value: 'undecided', label: 'まだ決めていない' },
] as const;

const CONVERSATION_STYLE_OPTIONS = [
  { value: 'text_first', label: 'テキスト中心' },
  { value: 'voice_first', label: '会話中心' },
  { value: 'balanced', label: 'バランス型' },
] as const;

const BUDGET_OPTIONS = [
  { value: 'low', label: '〜5千円' },
  { value: 'mid', label: '5千〜1万円' },
  { value: 'high', label: '1万円以上' },
] as const;

const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: 1, label: '月' },
  { value: 2, label: '火' },
  { value: 3, label: '水' },
  { value: 4, label: '木' },
  { value: 5, label: '金' },
  { value: 6, label: '土' },
  { value: 0, label: '日' },
];
const TIME_BANDS: { value: TimeBand; label: string }[] = [
  { value: 'morning', label: '朝' },
  { value: 'afternoon', label: '午後' },
  { value: 'evening', label: '夜' },
  { value: 'night', label: '深夜' },
];

export default function ProfileFormScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const { draft } = useOnboardingDraft();
  const invalidateProfile = useInvalidateMyProfile();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const interestsQuery = useQuery({ queryKey: ['interests'], queryFn: () => backend.profiles.listInterests() });

  const defaultValues = useMemo<ProfileFormInput>(
    () => ({
      displayName: draft.displayName ?? '',
      gender: 'self_describe',
      genderSelfDescribe: '',
      seekingGender: [],
      relationshipIntent: draft.relationshipIntent ?? 'undecided',
      ageMin: 20,
      ageMax: 45,
      bio: draft.bio ?? '',
      conversationStyle: 'balanced',
      interestKeys: draft.interestKeys ?? [],
      area: draft.area ?? '',
      travelDistanceKm: 20,
      budgetRange: 'mid',
      availability: draft.availability ?? [],
    }),
    [draft],
  );

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormInput>({ resolver: zodResolver(profileFormSchema), defaultValues });

  const gender = watch('gender');
  const seekingGender = watch('seekingGender');
  const interestKeys = watch('interestKeys') ?? [];
  const availability = watch('availability');

  const toggleSeekingGender = (value: ProfileFormInput['seekingGender'][number]) => {
    const set = new Set(seekingGender);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    setValue('seekingGender', Array.from(set), { shouldValidate: true });
  };

  const toggleInterest = (key: string) => {
    const set = new Set(interestKeys);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    setValue('interestKeys', Array.from(set));
  };

  const toggleAvailability = (weekday: Weekday, timeBand: TimeBand) => {
    const exists = availability.some((s) => s.weekday === weekday && s.timeBand === timeBand);
    const next = exists
      ? availability.filter((s) => !(s.weekday === weekday && s.timeBand === timeBand))
      : [...availability, { weekday, timeBand }];
    setValue('availability', next, { shouldValidate: true });
  };

  const onSubmit = async (data: ProfileFormInput) => {
    if (!session) return;
    setSubmitError(null);
    try {
      await backend.profiles.upsertMyProfile(session.userId, {
        displayName: data.displayName,
        gender: data.gender,
        genderSelfDescribe: data.genderSelfDescribe,
        bio: data.bio,
        conversationStyle: data.conversationStyle,
        area: data.area,
        travelDistanceKm: data.travelDistanceKm,
        budgetRange: data.budgetRange,
        onboardingCompletedAt: new Date().toISOString(),
      });
      await backend.profiles.upsertMyDatingPreferences(session.userId, {
        seekingGender: data.seekingGender,
        relationshipIntent: data.relationshipIntent,
        ageMin: data.ageMin,
        ageMax: data.ageMax,
      });
      await backend.profiles.replaceMyAvailability(session.userId, data.availability);
      await backend.profiles.replaceMyInterests(session.userId, data.interestKeys ?? []);
      invalidateProfile();
      router.replace('/(tabs)');
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : '保存に失敗しました');
    }
  };

  return (
    <ScreenContainer>
      <Text style={[theme.typography.title, { color: theme.colors.textPrimary, marginBottom: theme.spacing.xs }]}>
        プロフィール作成
      </Text>
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginBottom: theme.spacing.lg }]}>
        内容はいつでも見直し・修正できます。
      </Text>

      <Controller
        control={control}
        name="displayName"
        render={({ field }) => (
          <TextField
            label="表示名"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.displayName?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="gender"
        render={({ field }) => (
          <OptionGroup label="性別" options={[...GENDER_OPTIONS]} value={field.value} onChange={field.onChange} />
        )}
      />
      {gender === 'self_describe' && (
        <Controller
          control={control}
          name="genderSelfDescribe"
          render={({ field }) => (
            <TextField
              label="性別（自由記述）"
              value={field.value}
              onChangeText={field.onChange}
              error={errors.genderSelfDescribe?.message}
            />
          )}
        />
      )}

      <OptionGroup
        label="出会いたい相手"
        options={[...GENDER_OPTIONS].filter((o) => o.value !== 'self_describe')}
        value={seekingGender}
        onChange={toggleSeekingGender}
        multiple
        error={errors.seekingGender?.message}
      />

      <Controller
        control={control}
        name="relationshipIntent"
        render={({ field }) => (
          <OptionGroup label="恋愛目的" options={[...INTENT_OPTIONS]} value={field.value} onChange={field.onChange} />
        )}
      />

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="ageMin"
            render={({ field }) => (
              <TextField
                label="希望年齢（下限）"
                keyboardType="number-pad"
                value={String(field.value)}
                onChangeText={(v) => field.onChange(Number(v) || 18)}
                error={errors.ageMin?.message}
              />
            )}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="ageMax"
            render={({ field }) => (
              <TextField
                label="希望年齢（上限）"
                keyboardType="number-pad"
                value={String(field.value)}
                onChangeText={(v) => field.onChange(Number(v) || 99)}
                error={errors.ageMax?.message}
              />
            )}
          />
        </View>
      </View>

      <Controller
        control={control}
        name="bio"
        render={({ field }) => (
          <TextField
            label="自己紹介"
            multiline
            numberOfLines={4}
            style={{ minHeight: 96, paddingTop: theme.spacing.sm }}
            value={field.value}
            onChangeText={field.onChange}
            error={errors.bio?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="conversationStyle"
        render={({ field }) => (
          <OptionGroup
            label="会話スタイル"
            options={[...CONVERSATION_STYLE_OPTIONS]}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />

      <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.xs }]}>
        興味
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: theme.spacing.md }}>
        {(interestsQuery.data ?? []).map((interest) => (
          <Chip
            key={interest.key}
            label={interest.labelJa}
            selected={interestKeys.includes(interest.key)}
            onPress={() => toggleInterest(interest.key)}
          />
        ))}
      </View>

      <Controller
        control={control}
        name="area"
        render={({ field }) => (
          <TextField
            label="活動エリア（市区町村レベル）"
            placeholder="例: 東京都渋谷区"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.area?.message}
            helperText="正確な住所ではなく、大まかなエリアを入力してください"
          />
        )}
      />

      <Controller
        control={control}
        name="travelDistanceKm"
        render={({ field }) => (
          <TextField
            label="移動可能距離の目安（km）"
            keyboardType="number-pad"
            value={String(field.value ?? '')}
            onChangeText={(v) => field.onChange(Number(v) || undefined)}
          />
        )}
      />

      <Controller
        control={control}
        name="budgetRange"
        render={({ field }) => (
          <OptionGroup label="希望予算" options={[...BUDGET_OPTIONS]} value={field.value} onChange={field.onChange} />
        )}
      />

      <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: theme.spacing.xs }]}>
        会いやすい曜日・時間帯
      </Text>
      {WEEKDAYS.map((wd) => (
        <View key={wd.value} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.xxs }}>
          <Text style={{ width: 28, color: theme.colors.textSecondary }}>{wd.label}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', flex: 1 }}>
            {TIME_BANDS.map((tb) => (
              <Chip
                key={tb.value}
                label={tb.label}
                selected={availability.some((s) => s.weekday === wd.value && s.timeBand === tb.value)}
                onPress={() => toggleAvailability(wd.value, tb.value)}
              />
            ))}
          </View>
        </View>
      ))}
      {errors.availability && (
        <Text style={[theme.typography.caption, { color: theme.colors.danger, marginBottom: theme.spacing.md }]}>
          {errors.availability.message}
        </Text>
      )}

      <Text style={[theme.typography.caption, { color: theme.colors.textTertiary, marginTop: theme.spacing.md }]}>
        写真の登録はPhase2以降で対応予定です（Supabase Storage連携）。
      </Text>

      {submitError && (
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.danger, marginTop: theme.spacing.md, marginBottom: theme.spacing.sm },
          ]}
        >
          {submitError}
        </Text>
      )}

      <View style={{ marginTop: theme.spacing.lg, marginBottom: theme.spacing.xxl }}>
        <PrimaryButton label="プロフィールを完成させる" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />
      </View>
    </ScreenContainer>
  );
}
