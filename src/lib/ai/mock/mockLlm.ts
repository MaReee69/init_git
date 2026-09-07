import { DEFAULT_INTERESTS } from '@/lib/backend/mock/store';
import { aiDraftResultSchema, ownWordsCleanupResultSchema, type AiDraftResult, type OwnWordsCleanupResult } from '@/schemas/messaging';
import { secondDateProposalResultSchema, type SecondDateProposalResult } from '@/schemas/dateFlow';
import { voiceExtractedProfileSchema, type VoiceExtractedProfile } from '@/schemas/profile';
import { searchCriteriaSchema, isSearchCriteriaEmpty, type SearchCriteria } from '@/schemas/searchCriteria';
import type { BudgetRange, RelationshipIntent, TimeBand, Weekday } from '@/types/domain';

import type {
  LlmAdapter,
  ProfileExtractionResult,
  SearchCriteriaExtractionResult,
  SecondDateProposalInput,
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

const FILLER_WORDS = ['えーっと', 'えっと', 'あの、', 'あのー', 'まあ', 'なんか', 'ちょっとその'];
const WEEKDAY_LABEL = ['日', '月', '火', '水', '木', '金', '土'];
const TIME_BAND_LABEL: Record<TimeBand, string> = { morning: '朝', afternoon: '午後', evening: '夜', night: '深夜' };

/**
 * 「自分の言葉モード」: 言い淀み等の言葉を取り除き、文末を整える程度に留め、
 * 意味を書き換えたり本人が言っていないニュアンスを足したりしない。
 */
function cleanUpTranscriptText(transcript: string): OwnWordsCleanupResult {
  let cleaned = transcript.trim();
  FILLER_WORDS.forEach((filler) => {
    cleaned = cleaned.split(filler).join('');
  });
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  if (cleaned.length > 0 && !/[。！？.!?]$/.test(cleaned)) {
    cleaned += '。';
  }
  return { originalText: transcript, cleanedText: cleaned.length > 0 ? cleaned : transcript };
}

/**
 * 「AI文案モード」: 伝えたい意図（本人の発話）をもとに、丁寧さの異なる3つの言い回しへ変換する。
 * 本人が話していない具体的な事実（日時・場所等）を新たに作り出さない。
 */
function draftMessagesFromIntent(intent: string): AiDraftResult {
  const trimmed = intent.trim();
  if (trimmed.length === 0) {
    return { drafts: ['（伝えたい内容をもう少し詳しくお話しください）'] };
  }
  const drafts = [
    `${trimmed}と思っています。もしよければ聞かせてください！`,
    `${trimmed}のですが、いかがでしょうか？`,
    `${trimmed}です。ご都合の良いときに教えてもらえたら嬉しいです。`,
  ];
  return { drafts };
}

/**
 * AIセカンドデート提案（モック）。正確な位置・非公開の予定は入力に含まれない前提で、
 * 共有された空き時間の重なり・大まかなエリア・予算・共有可の一言だけから3案を組み立てる。
 */
function generateSecondDateProposalsFromInput(input: SecondDateProposalInput): SecondDateProposalResult {
  const slot = input.sharedAvailability[0];
  const dateTimeCandidate = slot ? `${WEEKDAY_LABEL[slot.weekday]}曜${TIME_BAND_LABEL[slot.timeBand]}` : '来週末の午後';
  const area = input.area ?? 'お互いに移動しやすいエリア';
  const budget = input.budget ?? 'mid';
  const noteHint = input.shareableNotes.find((n) => n.trim().length > 0);
  const reasonSuffix = noteHint ? `お二人が話していた「${noteHint}」を踏まえたご提案です。` : 'お二人の希望を踏まえたご提案です。';

  return {
    options: [
      {
        placeOrFormat: `${area}のカフェでゆっくり話す`,
        dateTimeCandidate,
        durationMinutes: 90,
        budgetRange: budget,
        reason: `静かに話せる場所を希望されていたため。${reasonSuffix}`,
        rainAlternative: '駅直結のカフェへ変更',
      },
      {
        placeOrFormat: `${area}の美術館・展示を見て回る`,
        dateTimeCandidate,
        durationMinutes: 120,
        budgetRange: budget,
        reason: `会話のきっかけが増えやすい体験型のご提案です。${reasonSuffix}`,
        rainAlternative: '屋内展示のみのコースに変更',
      },
      {
        placeOrFormat: `${area}を軽く散歩してランチ`,
        dateTimeCandidate,
        durationMinutes: 100,
        budgetRange: budget,
        reason: `気軽に自然な会話が生まれやすい組み合わせです。${reasonSuffix}`,
        rainAlternative: '屋内のランチのみに短縮',
      },
    ],
  };
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

  async cleanUpTranscript({ transcript }): Promise<OwnWordsCleanupResult> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const draft = cleanUpTranscriptText(transcript);
    const parsed = ownWordsCleanupResultSchema.safeParse(draft);
    return parsed.success ? parsed.data : { originalText: transcript, cleanedText: transcript };
  },

  async draftMessages({ intent }): Promise<AiDraftResult> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const draft = draftMessagesFromIntent(intent);
    const parsed = aiDraftResultSchema.safeParse(draft);
    return parsed.success ? parsed.data : { drafts: ['（文案の生成に失敗しました。ご自身の言葉でお試しください）'] };
  },

  async generateSecondDateProposals(input): Promise<SecondDateProposalResult> {
    await new Promise((resolve) => setTimeout(resolve, 700));
    const draft = generateSecondDateProposalsFromInput(input);
    const parsed = secondDateProposalResultSchema.safeParse(draft);
    if (parsed.success) return parsed.data;
    throw new Error('second date proposal validation failed');
  },
};
