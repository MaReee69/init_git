import type { TextToSpeechAdapter } from '../types';

/**
 * モックTTS。実音声は生成せず、画面表示・スクリーンリーダー用にテキストのみ返す。
 */
export const mockTts: TextToSpeechAdapter = {
  async synthesize({ text }) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const estimatedDurationMs = Math.max(800, text.length * 90);
    return { text, durationMs: estimatedDurationMs };
  },
};
