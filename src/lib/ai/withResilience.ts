/**
 * AIアダプタ呼び出しに共通のタイムアウト・再試行・レート制限・フォールバックを付与するラッパー。
 * 実プロバイダに差し替えた際も、この関数を通すだけで同じ耐障害性を得られるようにする。
 */

export class AiTimeoutError extends Error {
  constructor(message = 'AI呼び出しがタイムアウトしました') {
    super(message);
    this.name = 'AiTimeoutError';
  }
}

export interface RateLimitOptions {
  /** レート制限を区別するキー（例: `${userId}:draftMessages`） */
  key: string;
  maxPerWindow: number;
  windowMs: number;
}

export interface ResilienceOptions<T> {
  /** 1回の呼び出しに許容する最大時間(ms)。既定8000ms */
  timeoutMs?: number;
  /** タイムアウト/失敗時の追加リトライ回数。既定2（=最大3試行） */
  retries?: number;
  /** リトライ間の基本待機時間(ms)。指数バックオフで増加する。既定300ms */
  backoffMs?: number;
  rateLimit?: RateLimitOptions;
  /** 全リトライ失敗時、またはレート制限時に返す安全なフォールバック値 */
  fallback: () => T | Promise<T>;
}

export interface ResilienceResult<T> {
  result: T;
  usedFallback: boolean;
  attempts: number;
  rateLimited: boolean;
}

const rateLimitState = new Map<string, number[]>();

export function checkRateLimit(key: string, maxPerWindow: number, windowMs: number, now = Date.now()): boolean {
  const timestamps = (rateLimitState.get(key) ?? []).filter((t) => now - t < windowMs);
  if (timestamps.length >= maxPerWindow) {
    rateLimitState.set(key, timestamps);
    return false;
  }
  timestamps.push(now);
  rateLimitState.set(key, timestamps);
  return true;
}

/** テスト用: レート制限の内部状態をリセットする */
export function resetRateLimitState(): void {
  rateLimitState.clear();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new AiTimeoutError()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function withResilience<T>(fn: () => Promise<T>, options: ResilienceOptions<T>): Promise<ResilienceResult<T>> {
  const { timeoutMs = 8000, retries = 2, backoffMs = 300, rateLimit, fallback } = options;

  if (rateLimit && !checkRateLimit(rateLimit.key, rateLimit.maxPerWindow, rateLimit.windowMs)) {
    return { result: await fallback(), usedFallback: true, attempts: 0, rateLimited: true };
  }

  let attempt = 0;
  while (attempt <= retries) {
    attempt += 1;
    try {
      const result = await withTimeout(fn(), timeoutMs);
      return { result, usedFallback: false, attempts: attempt, rateLimited: false };
    } catch {
      if (attempt <= retries) {
        await sleep(backoffMs * 2 ** (attempt - 1));
      }
    }
  }

  return { result: await fallback(), usedFallback: true, attempts: attempt, rateLimited: false };
}
