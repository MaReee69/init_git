import type { VoiceExtractedProfile } from '@/schemas/profile';
import type { SearchCriteria } from '@/schemas/searchCriteria';

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

export interface LlmAdapter {
  extractProfileFromTranscript(input: {
    transcript: string;
    history: ConversationTurn[];
  }): Promise<ProfileExtractionResult>;
  extractSearchCriteria(input: { transcript: string; history: ConversationTurn[] }): Promise<SearchCriteriaExtractionResult>;
  classifyVoiceCommand(transcript: string): Promise<VoiceCommandIntent>;
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
