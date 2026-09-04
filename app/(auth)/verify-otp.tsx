import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Text } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenContainer } from '@/components/ScreenContainer';
import { TextField } from '@/components/TextField';
import { otpSchema, type OtpInput } from '@/schemas/auth';
import { useAuth } from '@/state/AuthProvider';
import { useTheme } from '@/theme';

export default function VerifyOtpScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { verifyOtp, requestOtp } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OtpInput>({ resolver: zodResolver(otpSchema), defaultValues: { code: '' } });

  const onSubmit = async (data: OtpInput) => {
    setSubmitError(null);
    try {
      await verifyOtp(email, data.code);
      router.replace('/');
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : '確認コードが正しくありません');
    }
  };

  return (
    <ScreenContainer>
      <Text style={[theme.typography.title, { color: theme.colors.textPrimary, marginBottom: theme.spacing.sm }]}>
        確認コードを入力
      </Text>
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginBottom: theme.spacing.xl }]}>
        {email} に送信された6桁のコードを入力してください。
      </Text>
      <Controller
        control={control}
        name="code"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="確認コード"
            placeholder="123456"
            keyboardType="number-pad"
            maxLength={6}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.code?.message}
          />
        )}
      />
      {submitError && (
        <Text style={[theme.typography.caption, { color: theme.colors.danger, marginBottom: theme.spacing.md }]}>
          {submitError}
        </Text>
      )}
      <PrimaryButton label="確認して続ける" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />
      <PrimaryButton
        label="コードを再送する"
        variant="ghost"
        onPress={() => requestOtp(email).catch(() => undefined)}
      />
    </ScreenContainer>
  );
}
