import { z } from 'zod';

const MIN_AGE = 18;

function isAtLeastAge(birthdate: string, minAge: number): boolean {
  const dob = new Date(birthdate);
  if (Number.isNaN(dob.getTime())) return false;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age >= minAge;
}

export const genderSchema = z.enum(['male', 'female', 'nonbinary', 'self_describe']);
export const relationshipIntentSchema = z.enum(['casual', 'serious', 'marriage_oriented', 'undecided']);
export const conversationStyleSchema = z.enum(['text_first', 'voice_first', 'balanced']);
export const budgetRangeSchema = z.enum(['low', 'mid', 'high']);
export const timeBandSchema = z.enum(['morning', 'afternoon', 'evening', 'night']);
export const weekdaySchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

export const ageConsentSchema = z.object({
  birthdate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '生年月日はYYYY-MM-DD形式で入力してください')
    .refine((v) => isAtLeastAge(v, MIN_AGE), {
      message: '本サービスは18歳以上のみご利用いただけます',
    }),
  termsAgreed: z.boolean().refine((v) => v === true, { message: '利用規約への同意が必要です' }),
  privacyAgreed: z.boolean().refine((v) => v === true, { message: 'プライバシーポリシーへの同意が必要です' }),
});
export type AgeConsentInput = z.infer<typeof ageConsentSchema>;

export const availabilitySlotSchema = z.object({
  weekday: weekdaySchema,
  timeBand: timeBandSchema,
});

export const profileFormSchema = z
  .object({
    displayName: z.string().trim().min(1, '表示名を入力してください').max(30, '30文字以内で入力してください'),
    gender: genderSchema,
    genderSelfDescribe: z.string().trim().max(50).optional(),
    seekingGender: z.array(genderSchema).min(1, '出会いたい相手を1つ以上選択してください'),
    relationshipIntent: relationshipIntentSchema,
    ageMin: z.number().int().min(18).max(99),
    ageMax: z.number().int().min(18).max(99),
    bio: z.string().trim().max(400, '400文字以内で入力してください').optional(),
    conversationStyle: conversationStyleSchema.optional(),
    interestKeys: z.array(z.string()).max(20).optional(),
    area: z.string().trim().min(1, '活動エリアを入力してください').max(50),
    travelDistanceKm: z.number().int().min(1).max(200).optional(),
    budgetRange: budgetRangeSchema.optional(),
    availability: z.array(availabilitySlotSchema).min(1, '会いやすい曜日・時間帯を1つ以上選択してください'),
  })
  .refine((data) => data.ageMin <= data.ageMax, {
    message: '希望年齢範囲が不正です',
    path: ['ageMax'],
  })
  .refine((data) => data.gender !== 'self_describe' || !!data.genderSelfDescribe?.trim(), {
    message: '性別の詳細を入力してください',
    path: ['genderSelfDescribe'],
  });
export type ProfileFormInput = z.infer<typeof profileFormSchema>;

/**
 * 音声会話からAIが抽出できるプロフィール項目のサブセット。
 * サーバー/モックの出力はすべてこのスキーマで検証し、失敗時は安全にフォールバックする。
 */
export const voiceExtractedProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(30).optional(),
  bio: z.string().trim().max(400).optional(),
  area: z.string().trim().max(50).optional(),
  interestKeys: z.array(z.string()).max(20).optional(),
  relationshipIntent: relationshipIntentSchema.optional(),
  availability: z.array(availabilitySlotSchema).optional(),
});
export type VoiceExtractedProfile = z.infer<typeof voiceExtractedProfileSchema>;
