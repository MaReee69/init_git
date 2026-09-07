import type { AiDraftResult, OwnWordsCleanupResult } from '@/schemas/messaging';
import type { SecondDateProposalResult } from '@/schemas/dateFlow';
import type { VoiceExtractedProfile } from '@/schemas/profile';
import type { SearchCriteria } from '@/schemas/searchCriteria';
import type { BudgetRange, TimeBand, Weekday } from '@/types/domain';

export interface ConversationTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface TranscriptionResult {
  text: string;
  /** 0-1。低い場合はUIで聞き返し・手動修正を促す */
  confidence: number;
}

export interface SpeechToTextAdapter {
  transcribe(input: { uri: string; mimeType?: string }): Promise<TranscriptionResult>;
}

export interface ProfileExtractionResult {
  extracted: VoiceExtractedProfile;
  /** AIが聞き返すべきと判断した場合の追加質問（1問だけ） */
  followUpQuestion?: string;
}

export interface SearchCriteriaExtractionResult {
  criteria: SearchCriteria;
  /** 条件が曖昧な場合だけ、AIが一度に1問だけ聞き返す */
  followUpQuestion?: string;
}

export type VoiceCommandIntent =
  | 'more_detail'
  | 'next'
  | 'like'
  | 'change_criteria'
  | 'end_session'
  | 'unknown';

export interface SecondDateProposalInput {
  /** 双方の空き時間の重なりのみ（個人の予定そのものは渡さない） */
  sharedAvailability: { weekday: Weekday; timeBand: TimeBand }[];
  /** 大まかなエリアのみ（正確な住所・現在地は扱わない） */
  area?: string;
  budget?: BudgetRange;
  /** visibility='shareable'かつ本人確認済みの回答のみを呼び出し側で抽出して渡す */
  shareableNotes: string[];
}

export interface LlmAdapter {
  extractProfileFromTranscript(input: {
    transcript: string;
    history: ConversationTurn[];
  }): Promise<ProfileExtractionResult>;
  extractSearchCriteria(input: { transcript: string; history: ConversationTurn[] }): Promise<SearchCriteriaExtractionResult>;
  classifyVoiceCommand(transcript: string): Promise<VoiceCommandIntent>;
  /** 「自分の言葉モード」: 発話を意味を変えずに読みやすく整える */
  cleanUpTranscript(input: { transcript: string }): Promise<OwnWordsCleanupResult>;
  /** 「AI文案モード」: 伝えたい意図から文案を最大3件作る（自動送信はしない） */
  draftMessages(input: { intent: string }): Promise<AiDraftResult>;
  /** 双方の再会意思確認が取れた場合のみ呼び出される想定のAIセカンドデート提案 */
  generateSecondDateProposals(input: SecondDateProposalInput): Promise<SecondDateProposalResult>;
}

export interface SpeechSynthesisResult {
  /** モックでは実音声を生成せず、読み上げ用テキストのみを返す */
  text: string;
  durationMs: number;
}

export interface TextToSpeechAdapter {
  synthesize(input: { text: string }): Promise<SpeechSynthesisResult>;
}

export interface AiAdapters {
  stt: SpeechToTextAdapter;
  llm: LlmAdapter;
  tts: TextToSpeechAdapter;
}
