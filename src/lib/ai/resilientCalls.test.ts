import { mockLlm } from './mock/mockLlm';
import { cleanUpTranscriptResilient, draftMessagesResilient, generateSecondDateProposalsResilient } from './resilientCalls';
import type { LlmAdapter } from './types';
import { resetRateLimitState } from './withResilience';

function makeFailingLlm(): LlmAdapter {
  const fail = () => Promise.reject(new Error('boom'));
  return {
    extractProfileFromTranscript: fail,
    extractSearchCriteria: fail,
    classifyVoiceCommand: fail,
    cleanUpTranscript: fail,
    draftMessages: fail,
    generateSecondDateProposals: fail,
  } as unknown as LlmAdapter;
}

describe('resilientCalls', () => {
  beforeEach(() => {
    resetRateLimitState();
  });

  it('cleanUpTranscriptResilient: 正常系はモックLLMの結果を返す', async () => {
    const result = await cleanUpTranscriptResilient('user1', 'えーっと、土曜に会いたいです', mockLlm);
    expect(result.usedFallback).toBe(false);
    expect(result.result.cleanedText).not.toContain('えーっと');
  });

  it('cleanUpTranscriptResilient: 失敗時は原文をそのまま安全に返す（内容を失わない）', async () => {
    const failing = makeFailingLlm();
    const result = await cleanUpTranscriptResilient('user2', '元のテキスト', failing);
    expect(result.usedFallback).toBe(true);
    expect(result.result).toEqual({ originalText: '元のテキスト', cleanedText: '元のテキスト' });
  });

  it('draftMessagesResilient: 失敗時は安全なテンプレートを返す', async () => {
    const failing = makeFailingLlm();
    const result = await draftMessagesResilient('user3', '週末に会いたいと伝えたい', failing);
    expect(result.usedFallback).toBe(true);
    expect(result.result.drafts).toHaveLength(1);
    expect(result.result.drafts[0]).toContain('AI文案を作成できません');
  });

  it('generateSecondDateProposalsResilient: 正常系は3案を返す', async () => {
    const result = await generateSecondDateProposalsResilient(
      'user4',
      { sharedAvailability: [{ weekday: 6, timeBand: 'afternoon' }], area: '東京都渋谷区', shareableNotes: [] },
      mockLlm,
    );
    expect(result.usedFallback).toBe(false);
    expect(result.result.options).toHaveLength(3);
  });

  it('generateSecondDateProposalsResilient: 失敗時は架空の提案を作らず空配列を返す', async () => {
    const failing = makeFailingLlm();
    const result = await generateSecondDateProposalsResilient(
      'user5',
      { sharedAvailability: [], shareableNotes: [] },
      failing,
    );
    expect(result.usedFallback).toBe(true);
    expect(result.result.options).toEqual([]);
  });

  it('generateSecondDateProposalsResilient: レート制限(3回/5分)を超えるとフォールバックする', async () => {
    const input = { sharedAvailability: [], shareableNotes: [] };
    await generateSecondDateProposalsResilient('user6', input, mockLlm);
    await generateSecondDateProposalsResilient('user6', input, mockLlm);
    await generateSecondDateProposalsResilient('user6', input, mockLlm);
    const fourth = await generateSecondDateProposalsResilient('user6', input, mockLlm);
    expect(fourth.rateLimited).toBe(true);
    expect(fourth.result.options).toEqual([]);
  });
});
