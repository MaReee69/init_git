import { mockLlm } from './mock/mockLlm';
import { mockStt } from './mock/mockStt';
import { mockTts } from './mock/mockTts';
import type { AiAdapters } from './types';

/**
 * AIアダプタの選択ポイント。
 * サーバー専用の AI_API_KEY はクライアントから参照できない（意図的）ため、
 * Phase1時点ではクライアントから直接モックアダプタを利用する。
 * Phase2以降、実プロバイダ利用時はEdge Function経由のHTTPアダプタに差し替える。
 */
export const aiAdapters: AiAdapters = {
  stt: mockStt,
  llm: mockLlm,
  tts: mockTts,
};

export const isMockAi = true;

export type { AiAdapters, ConversationTurn, ProfileExtractionResult, TranscriptionResult } from './types';
