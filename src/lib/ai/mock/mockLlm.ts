import { DEFAULT_INTERESTS } from '@/lib/backend/mock/store';
import { voiceExtractedProfileSchema, type VoiceExtractedProfile } from '@/schemas/profile';
import { searchCriteriaSchema, isSearchCriteriaEmpty, type SearchCriteria } from '@/schemas/searchCriteria';
import type { BudgetRange, RelationshipIntent, TimeBand, Weekday } from '@/types/domain';

import type {
  LlmAdapter,
  ProfileExtractionResult,
  SearchCriteriaExtractionResult,
  VoiceCommandIntent,
} from '../types';

const INTENT_KEYWORDS: { keywords: string[]; value: RelationshipIntent }[] = [
  { keywords: ['結婚', '将来'], value: 'marriage_oriented' },
  { keywords: ['真剣', '交際', '恋人'], value: 'serious' },
  { keywords: ['気軽', 'まずは', 'カジュアル'], value: 'casual' },
];

const WEEKDAY_KEYWORDS: { keywords: string[]; weekday: Weekday }[] = [
  { keywords: ['土曜'], weekday: 6 },
  { keywords: ['日曜'], weekday: 0 },
  { keywords: ['週末', '休日'], weekday: 6 },
  { keywords: ['平日'], weekday: 3 },
];

const TIME_BAND_KEYWORDS: { keywords: string[]; timeBand: TimeBand }[] = [
  { keywords: ['朝'], timeBand: 'morning' },
  { keywords: ['午後', '昼'], timeBand: 'afternoon' },
  { keywords: ['夜遅く', '深夜'], timeBand: 'night' },
  { keywords: ['夜'], timeBand: 'evening' },
];

const BUDGET_KEYWORDS: { keywords: string[]; value: BudgetRange }[] = [
  { keywords: ['贅沢', '高め', '奮発'], value: 'high' },
  { keywords: ['リーズナブル', '安め', '節約'], value: 'low' },
  { keywords: ['普通の予算', 'standard'], value: 'mid' },
];

const AREA_PATTERN = /(都内|東京|大阪|横浜|渋谷|新宿|名古屋|福岡|札幌)/;

function findInterestKeys(transcript: string): string[] {
  return DEFAULT_INTERESTS.filter((interest) => transcript.includes(interest.labelJa)).map((i) => i.key);
}

function findIntent(transcript: string): RelationshipIntent | undefined {
  return INTENT_KEYWORDS.find((entry) => entry.keywords.some((k) => transcript.includes(k)))?.value;
}

function findWeekday(transcript: string): Weekday | undefined {
  return WEEKDAY_KEYWORDS.find((entry) => entry.keywords.some((k) => transcript.includes(k)))?.weekday;
}

function findTimeBand(transcript: string): TimeBand | undefined {
  return TIME_BAND_KEYWORDS.find((entry) => entry.keywords.some((k) => transcript.includes(k)))?.timeBand;
}

function findBudget(transcript: string): BudgetRange | undefined {
  return BUDGET_KEYWORDS.find((entry) => entry.keywords.some((k) => transcript.includes(k)))?.value;
}

function findArea(transcript: string): string | undefined {
  return transcript.match(AREA_PATTERN)?.[1];
}

/**
 * モックLLM。実プロバイダ差し替え前提のため、抽出ロジックはキーワードマッチのみ。
 * 声質・話し方等からの属性推測は行わず、明示的な単語一致のみを根拠にする。
 */
function extractProfileFromText(transcript: string): VoiceExtractedProfile {
  const interestKeys = findInterestKeys(transcript);
  const weekday = findWeekday(transcript);
  const timeBand = findTimeBand(transcript);

  const draft: VoiceExtractedProfile = {
    bio: transcript.trim().length > 0 ? transcript : undefined,
    interestKeys: interestKeys.length > 0 ? interestKeys : undefined,
    relationshipIntent: findIntent(transcript),
    area: findArea(transcript),
    availability: weekday !== undefined && timeBand ? [{ weekday, timeBand }] : undefined,
  };

  const parsed = voiceExtractedProfileSchema.safeParse(draft);
  return parsed.success ? parsed.data : {};
}

function extractSearchCriteriaFromText(transcript: string): SearchCriteria {
  const interestKeys = findInterestKeys(transcript);
  const weekday = findWeekday(transcript);
  const timeBand = findTimeBand(transcript);
  const area = findArea(transcript);
  const availability = weekday !== undefined && timeBand ? [{ weekday, timeBand }] : undefined;

  const hasHardFilters = !!area || !!availability;
  const hasSoftPreferences = interestKeys.length > 0;

  const draft: SearchCriteria = {
    hardFilters: hasHardFilters ? { area, availability } : undefined,
    softPreferences: hasSoftPreferences ? { interestKeywords: interestKeys } : undefined,
    intent: findIntent(transcript),
    budget: findBudget(transcript),
  };

  const parsed = searchCriteriaSchema.safeParse(draft);
  return parsed.success ? parsed.data : {};
}

const VOICE_COMMAND_KEYWORDS: { keywords: string[]; intent: VoiceCommandIntent }[] = [
  // 「気になる」は候補を絞る発話（いいね）でも使われうるため、より具体的な語を優先して先に判定する。
  { keywords: ['もう少し詳しく', 'もっと詳しく', '詳しく', '詳細'], intent: 'more_detail' },
  { keywords: ['次の人', '次にして', '違う人', 'スキップ', '次'], intent: 'next' },
  { keywords: ['いいねして', 'いいね', 'この人いいかも', '気になる'], intent: 'like' },
  { keywords: ['条件を変え', '条件変更', '違うタイプ', '条件変えて'], intent: 'change_criteria' },
  { keywords: ['今日は終わる', '終わりにする', 'もうやめる', '終了'], intent: 'end_session' },
];

/**
 * push-to-talkの短い発話を5つの操作コマンドへ分類する。
 * 音声認識の誤り・言い淀み・関係のない発話は無理に確定させず 'unknown' を返し、
 * 呼び出し側で聞き返しやタップ操作への切り替えを促す。
 */
function classifyVoiceCommandFromText(transcript: string): VoiceCommandIntent {
  const trimmed = transcript.trim();
  if (trimmed.length === 0) return 'unknown';
  const match = VOICE_COMMAND_KEYWORDS.find((entry) => entry.keywords.some((k) => trimmed.includes(k)));
  return match?.intent ?? 'unknown';
}

export const mockLlm: LlmAdapter = {
  async extractProfileFromTranscript({ transcript }): Promise<ProfileExtractionResult> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const extracted = extractProfileFromText(transcript);
    const followUpQuestion =
      !extracted.availability || extracted.availability.length === 0
        ? '会いやすい曜日や時間帯はありますか？'
        : undefined;
    return { extracted, followUpQuestion };
  },

  async extractSearchCriteria({ transcript }): Promise<SearchCriteriaExtractionResult> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const criteria = extractSearchCriteriaFromText(transcript);
    const followUpQuestion = isSearchCriteriaEmpty(criteria)
      ? 'もう少し詳しく教えてください。希望のエリアや会える曜日はありますか？'
      : undefined;
    return { criteria, followUpQuestion };
  },

  async classifyVoiceCommand(transcript): Promise<VoiceCommandIntent> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return classifyVoiceCommandFromText(transcript);
  },
};
