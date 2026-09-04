import type { SpeechToTextAdapter } from '../types';

/**
 * モックSTT。実際の音声内容は解析せず、デモ用の例文をローテーションで返す。
 * 本番プロバイダに差し替える際も SpeechToTextAdapter インターフェースは変更不要。
 */
const SAMPLE_TRANSCRIPTS = [
  '都内で働いていて、休日はゆっくり出かけたいです。映画が好きで、気軽に会える人を探しています。',
  '週末の午後に会えると嬉しいです。カフェ巡りと美術館が好きで、真剣に将来のことも考えられる相手がいいです。',
  '平日の夜に会えることが多いです。料理と旅行が好きで、まずはお茶しながら話せる人がいいなと思っています。',
];

let callCount = 0;

export const mockStt: SpeechToTextAdapter = {
  async transcribe() {
    const text = SAMPLE_TRANSCRIPTS[callCount % SAMPLE_TRANSCRIPTS.length];
    callCount += 1;
    // 実運用のSTTを模した遅延
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { text, confidence: 0.86 };
  },
};
