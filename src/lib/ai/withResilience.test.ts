import { resetRateLimitState, withResilience } from './withResilience';

describe('withResilience', () => {
  beforeEach(() => {
    resetRateLimitState();
  });

  it('成功時はそのまま結果を返す', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const fallback = jest.fn().mockResolvedValue('fallback');
    const result = await withResilience(fn, { timeoutMs: 100, retries: 2, backoffMs: 1, fallback });
    expect(result).toEqual({ result: 'ok', usedFallback: false, attempts: 1, rateLimited: false });
    expect(fallback).not.toHaveBeenCalled();
  });

  it('1回失敗しても2回目で成功すればフォールバックを使わない', async () => {
    const fn = jest.fn().mockRejectedValueOnce(new Error('network error')).mockResolvedValueOnce('recovered');
    const fallback = jest.fn().mockResolvedValue('fallback');
    const result = await withResilience(fn, { timeoutMs: 100, retries: 2, backoffMs: 1, fallback });
    expect(result.result).toBe('recovered');
    expect(result.attempts).toBe(2);
    expect(result.usedFallback).toBe(false);
  });

  it('タイムアウトが続く場合は安全なフォールバックへ切り替える', async () => {
    const fn = jest.fn().mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve('too-late'), 200)));
    const fallback = jest.fn().mockResolvedValue('safe-template');
    const result = await withResilience(fn, { timeoutMs: 10, retries: 1, backoffMs: 1, fallback });
    expect(result.result).toBe('safe-template');
    expect(result.usedFallback).toBe(true);
    expect(fn).toHaveBeenCalledTimes(2); // 初回 + retries=1回
  });

  it('レート制限を超えた場合はfnを呼ばずフォールバックする', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const fallback = jest.fn().mockResolvedValue('rate-limited-fallback');
    const rateLimit = { key: 'user1:draft', maxPerWindow: 1, windowMs: 10_000 };

    const first = await withResilience(fn, { timeoutMs: 100, retries: 0, backoffMs: 1, fallback, rateLimit });
    expect(first.result).toBe('ok');

    const second = await withResilience(fn, { timeoutMs: 100, retries: 0, backoffMs: 1, fallback, rateLimit });
    expect(second.usedFallback).toBe(true);
    expect(second.rateLimited).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1); // 2回目はfnを呼んでいない
  });

  it('レート制限キーが異なれば独立してカウントされる', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const fallback = jest.fn().mockResolvedValue('fallback');

    const a = await withResilience(fn, {
      timeoutMs: 100,
      retries: 0,
      backoffMs: 1,
      fallback,
      rateLimit: { key: 'userA:draft', maxPerWindow: 1, windowMs: 10_000 },
    });
    const b = await withResilience(fn, {
      timeoutMs: 100,
      retries: 0,
      backoffMs: 1,
      fallback,
      rateLimit: { key: 'userB:draft', maxPerWindow: 1, windowMs: 10_000 },
    });

    expect(a.usedFallback).toBe(false);
    expect(b.usedFallback).toBe(false);
  });
});
