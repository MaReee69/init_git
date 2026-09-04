import { DEFAULT_INTERESTS } from '@/lib/backend/mock/store';
import { voiceExtractedProfileSchema, type VoiceExtractedProfile } from '@/schemas/profile';
import type { TimeBand, Weekday } from '@/types/domain';

import type { LlmAdapter, ProfileExtractionResult } from '../types';

const INTENT_KEYWORDS: { keywords: string[]; value: VoiceExtractedProfile['relationshipIntent'] }[] = [
  { keywords: ['結婚', '将来'], value: 'marriage_oriented' },
  { keywords: ['真剣', '交際', '恋人'], value: 'serious' },
  { keywords: ['気軽', 'まずは', 'カジュアル'], value: 'casual' },
];

const WEEKDAY_KEYWORDS: { keywords: string[]; weekday: Weekday }[] = [
  { keywords: ['土曜'], weekday: 6 },
  { keywords: ['日曜'], weekday: 0 },
  { keywords: ['週末'], weekday: 6 },
  { keywords: ['平日'], weekday: 3 },
];

const TIME_BAND_KEYWORDS: { keywords: string[]; timeBand: TimeBand }[] = [
  { keywords: ['朝'], timeBand: 'morning' },
  { keywords: ['午後', '昼'], timeBand: 'afternoon' },
  { keywords: ['夜'], timeBand: 'evening' },
  { keywords: ['夜遅く', '深夜'], timeBand: 'night' },
];

/**
 * モックLLM。実プロバイダ差し替え前提のため、抽出ロジックはキーワードマッチのみ。
 * 声質・話し方等からの属性推測は行わず、明示的な単語一致のみを根拠にする。
 */
function extractFromText(transcript: string): VoiceExtractedProfile {
  const interestKeys = DEFAULT_INTERESTS.filter((interest) => transcript.includes(interest.labelJa)).map(
    (i) => i.key,
  );

  const relationshipIntent = INTENT_KEYWORDS.find((entry) =>
    entry.keywords.some((k) => transcript.includes(k)),
  )?.value;

  const weekday = WEEKDAY_KEYWORDS.find((entry) => entry.keywords.some((k) => transcript.includes(k)))?.weekday;
  const timeBand = TIME_BAND_KEYWORDS.find((entry) => entry.keywords.some((k) => transcript.includes(k)))?.timeBand;

  const areaMatch = transcript.match(/(都内|東京|大阪|横浜|渋谷|新宿|名古屋|福岡|札幌)/);

  const draft: VoiceExtractedProfile = {
    bio: transcript.trim().length > 0 ? transcript : undefined,
    interestKeys: interestKeys.length > 0 ? interestKeys : undefined,
    relationshipIntent,
    area: areaMatch?.[1],
    availability: weekday !== undefined && timeBand ? [{ weekday, timeBand }] : undefined,
  };

  const parsed = voiceExtractedProfileSchema.safeParse(draft);
  return parsed.success ? parsed.data : {};
}

export const mockLlm: LlmAdapter = {
  async extractProfileFromTranscript({ transcript }): Promise<ProfileExtractionResult> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const extracted = extractFromText(transcript);
    const followUpQuestion =
      !extracted.availability || extracted.availability.length === 0
        ? '会いやすい曜日や時間帯はありますか？'
        : undefined;
    return { extracted, followUpQuestion };
  },
};
