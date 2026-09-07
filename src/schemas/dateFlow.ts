import { z } from 'zod';

import { budgetRangeSchema } from './profile';

export const dateFeedbackVisibilitySchema = z.enum(['private', 'shareable', 'safety']);

export const dateFeedbackAnswerInputSchema = z.object({
  questionKey: z.string().min(1).max(50),
  answerText: z.string().trim().max(500).optional(),
  visibility: dateFeedbackVisibilitySchema,
});
export type DateFeedbackAnswerInput = z.infer<typeof dateFeedbackAnswerInputSchema>;

export const dateFeedbackSubmissionSchema = z.object({
  wantToMeetAgain: z.boolean(),
  answers: z.array(dateFeedbackAnswerInputSchema).max(20),
});
export type DateFeedbackSubmission = z.infer<typeof dateFeedbackSubmissionSchema>;

/**
 * AIセカンドデート提案の1案。正確な住所や非公開の予定は含めず、
 * 場所の形式・大まかな候補日時・所要時間・予算帯・一文の理由・雨天時代替案のみを持つ。
 */
export const dateProposalOptionSchema = z.object({
  placeOrFormat: z.string().trim().min(1).max(60),
  dateTimeCandidate: z.string().trim().min(1).max(60),
  durationMinutes: z.number().int().min(15).max(480),
  budgetRange: budgetRangeSchema,
  reason: z.string().trim().min(1).max(120),
  rainAlternative: z.string().trim().min(1).max(60),
});
export type DateProposalOptionInput = z.infer<typeof dateProposalOptionSchema>;

export const secondDateProposalResultSchema = z.object({
  options: z.array(dateProposalOptionSchema).length(3),
});
export type SecondDateProposalResult = z.infer<typeof secondDateProposalResultSchema>;

export const dateProposalVoteChoiceSchema = z.enum(['want', 'change', 'other', 'skip']);
