import { z } from 'zod';

export const emailSchema = z.object({
  email: z.string().trim().min(1, 'メールアドレスを入力してください').email('メールアドレスの形式が正しくありません'),
});
export type EmailInput = z.infer<typeof emailSchema>;

export const otpSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, '6桁の確認コードを入力してください'),
});
export type OtpInput = z.infer<typeof otpSchema>;
