import { z } from 'zod';

/**
 * メッセージ作成の3モード。どのモードでもAIによる自動送信は禁止し、
 * プレビュー・修正・送信確認を必須にする（UI側で強制する）。
 */
export const messageComposeModeSchema = z.enum(['own_voice_cleanup', 'ai_draft', 'raw_voice_clip']);
export type MessageComposeMode = z.infer<typeof messageComposeModeSchema>;

/** 「自分の言葉モード」: 発話を意味を変えずに読みやすく整えた結果 */
export const ownWordsCleanupResultSchema = z.object({
  originalText: z.string().trim().min(1).max(1000),
  cleanedText: z.string().trim().min(1).max(1000),
});
export type OwnWordsCleanupResult = z.infer<typeof ownWordsCleanupResultSchema>;

/** 「AI文案モード」: 意図の発話から作られる文案（最大3件） */
export const aiDraftResultSchema = z.object({
  drafts: z.array(z.string().trim().min(1).max(300)).min(1).max(3),
});
export type AiDraftResult = z.infer<typeof aiDraftResultSchema>;

export const messageContentTypeSchema = z.enum(['text', 'voice']);
