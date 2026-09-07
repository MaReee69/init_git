import type { AiDraftResult, OwnWordsCleanupResult } from '@/schemas/messaging';
import type { SecondDateProposalResult } from '@/schemas/dateFlow';

import { aiAdapters } from './index';
import type { LlmAdapter, SecondDateProposalInput } from './types';
import { withResilience, type ResilienceResult } from './withResilience';

/**
 * UIが直接呼び出す「耐障害性つき」AI呼び出し。
 * 実プロバイダに差し替えても、タイムアウト・再試行・レート制限・フォールバックは変わらない。
 */

export async function cleanUpTranscriptResilient(
  userId: string,
  transcript: string,
  llm: LlmAdapter = aiAdapters.llm,
): Promise<ResilienceResult<OwnWordsCleanupResult>> {
  return withResilience(() => llm.cleanUpTranscript({ transcript }), {
    timeoutMs: 8000,
    retries: 2,
    backoffMs: 300,
    rateLimit: { key: `${userId}:cleanUpTranscript`, maxPerWindow: 10, windowMs: 60_000 },
    fallback: () => ({ originalText: transcript, cleanedText: transcript }),
  });
}

export async function draftMessagesResilient(
  userId: string,
  intent: string,
  llm: LlmAdapter = aiAdapters.llm,
): Promise<ResilienceResult<AiDraftResult>> {
  return withResilience(() => llm.draftMessages({ intent }), {
    timeoutMs: 8000,
    retries: 2,
    backoffMs: 300,
    rateLimit: { key: `${userId}:draftMessages`, maxPerWindow: 10, windowMs: 60_000 },
    fallback: () => ({ drafts: ['（現在AI文案を作成できません。しばらくしてからもう一度お試しいただくか、ご自身の言葉でお送りください）'] }),
  });
}

export async function generateSecondDateProposalsResilient(
  userId: string,
  input: SecondDateProposalInput,
  llm: LlmAdapter = aiAdapters.llm,
): Promise<ResilienceResult<SecondDateProposalResult>> {
  return withResilience(() => llm.generateSecondDateProposals(input), {
    timeoutMs: 10_000,
    retries: 2,
    backoffMs: 400,
    rateLimit: { key: `${userId}:secondDateProposals`, maxPerWindow: 3, windowMs: 300_000 },
    // 空配列を安全なフォールバックとし、UI側で「現在提案できません」と案内する（架空の提案を作らない）
    fallback: () => ({ options: [] }),
  });
}
