import type { VoiceExtractedProfile } from '@/schemas/profile';

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

export interface LlmAdapter {
  extractProfileFromTranscript(input: {
    transcript: string;
    history: ConversationTurn[];
  }): Promise<ProfileExtractionResult>;
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
