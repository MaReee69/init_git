import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Text } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenContainer } from '@/components/ScreenContainer';
import { TextField } from '@/components/TextField';
import { isMockBackend } from '@/lib/backend';
import { emailSchema, type EmailInput } from '@/schemas/auth';
import { useAuth } from '@/state/AuthProvider';
import { useTheme } from '@/theme';

export default function SignInScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { requestOtp } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmailInput>({ resolver: zodResolver(emailSchema), defaultValues: { email: '' } });

  const onSubmit = async (data: EmailInput) => {
    setSubmitError(null);
    try {
      await requestOtp(data.email);
      router.push({ pathname: '/(auth)/verify-otp', params: { email: data.email } });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : '送信に失敗しました');
    }
  };

  return (
    <ScreenContainer>
      <Text style={[theme.typography.title, { color: theme.colors.textPrimary, marginBottom: theme.spacing.sm }]}>
        メールアドレスで登録
      </Text>
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginBottom: theme.spacing.xl }]}>
        入力したメールアドレスに確認コードを送信します。
      </Text>
      {isMockBackend && (
        <Text style={[theme.typography.caption, { color: theme.colors.aurora, marginBottom: theme.spacing.md }]}>
          モックモード: 実際のメールは送信されません。次の画面でコード「123456」を入力してください。
        </Text>
      )}
      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="メールアドレス"
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.email?.message}
          />
        )}
      />
      {submitError && (
        <Text style={[theme.typography.caption, { color: theme.colors.danger, marginBottom: theme.spacing.md }]}>
          {submitError}
        </Text>
      )}
      <PrimaryButton label="確認コードを送る" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />
    </ScreenContainer>
  );
}
