import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenContainer } from '@/components/ScreenContainer';
import { TextField } from '@/components/TextField';
import { backend } from '@/lib/backend';
import { ageConsentSchema, type AgeConsentInput } from '@/schemas/profile';
import { useAuth } from '@/state/AuthProvider';
import { useInvalidateMyProfile } from '@/state/useMyProfile';
import { useTheme } from '@/theme';

function Checkbox({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          borderWidth: 1.5,
          borderColor: checked ? theme.colors.aurora : theme.colors.borderStrong,
          backgroundColor: checked ? theme.colors.aurora : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: theme.spacing.sm,
        }}
      >
        {checked && <Text style={{ color: theme.colors.bgBase, fontWeight: '700' }}>✓</Text>}
      </View>
      <Text style={[theme.typography.body, { color: theme.colors.textPrimary, flex: 1 }]}>{label}</Text>
    </Pressable>
  );
}

export default function AgeConsentScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const invalidateProfile = useInvalidateMyProfile();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AgeConsentInput>({
    resolver: zodResolver(ageConsentSchema),
    defaultValues: { birthdate: '', termsAgreed: false, privacyAgreed: false },
  });

  const termsAgreed = watch('termsAgreed');
  const privacyAgreed = watch('privacyAgreed');

  const onSubmit = async (data: AgeConsentInput) => {
    if (!session) return;
    setSubmitError(null);
    try {
      const now = new Date().toISOString();
      await backend.profiles.upsertMyProfile(session.userId, {
        birthdate: data.birthdate,
        termsAgreedAt: now,
        privacyAgreedAt: now,
        ageVerifiedMethod: 'self_declared',
      });
      invalidateProfile();
      router.replace('/(onboarding)/profile-method');
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : '保存に失敗しました');
    }
  };

  return (
    <ScreenContainer>
      <Text style={[theme.typography.title, { color: theme.colors.textPrimary, marginBottom: theme.spacing.sm }]}>
        年齢確認・同意事項
      </Text>
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginBottom: theme.spacing.xl }]}>
        スキマッチは18歳以上の方のみご利用いただけます。生年月日は本人申告に基づき記録されます。
      </Text>
      <Controller
        control={control}
        name="birthdate"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="生年月日 (YYYY-MM-DD)"
            placeholder="2000-01-01"
            keyboardType="numbers-and-punctuation"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.birthdate?.message}
            helperText="例: 2000-01-01"
          />
        )}
      />
      <Checkbox
        checked={!!termsAgreed}
        onToggle={() => setValue('termsAgreed', !termsAgreed, { shouldValidate: true })}
        label="利用規約に同意する"
      />
      {errors.termsAgreed && (
        <Text style={[theme.typography.caption, { color: theme.colors.danger }]}>{errors.termsAgreed.message}</Text>
      )}
      <Checkbox
        checked={!!privacyAgreed}
        onToggle={() => setValue('privacyAgreed', !privacyAgreed, { shouldValidate: true })}
        label="プライバシーポリシーに同意する"
      />
      {errors.privacyAgreed && (
        <Text style={[theme.typography.caption, { color: theme.colors.danger, marginBottom: theme.spacing.md }]}>
          {errors.privacyAgreed.message}
        </Text>
      )}
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
      <View style={{ marginTop: theme.spacing.lg }}>
        <PrimaryButton label="同意して次へ" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />
      </View>
    </ScreenContainer>
  );
}
