import { computeVoiceRetentionExpiry, isVoiceAssetExpired, selectExpiredVoiceAssets, VOICE_RETENTION_DAYS } from './retention';

const NOW = new Date('2026-09-07T00:00:00Z');

describe('computeVoiceRetentionExpiry', () => {
  it('保存しない場合はnull（保持しない）', () => {
    expect(computeVoiceRetentionExpiry(false, NOW)).toBeNull();
  });

  it('保存する場合はVOICE_RETENTION_DAYS日後の期限を返す', () => {
    const expiry = computeVoiceRetentionExpiry(true, NOW);
    expect(expiry).not.toBeNull();
    const diffDays = (expiry!.getTime() - NOW.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(VOICE_RETENTION_DAYS, 5);
  });
});

describe('isVoiceAssetExpired', () => {
  it('retainUntil未設定は削除対象', () => {
    expect(isVoiceAssetExpired({ id: 'a' }, NOW)).toBe(true);
  });

  it('retainUntilが未来なら削除対象ではない', () => {
    const future = new Date(NOW.getTime() + 1000 * 60 * 60 * 24).toISOString();
    expect(isVoiceAssetExpired({ id: 'a', retainUntil: future }, NOW)).toBe(false);
  });

  it('retainUntilがちょうど現在時刻なら削除対象（境界値）', () => {
    expect(isVoiceAssetExpired({ id: 'a', retainUntil: NOW.toISOString() }, NOW)).toBe(true);
  });

  it('retainUntilが1ミリ秒でも未来なら削除対象ではない（境界値）', () => {
    const almostNow = new Date(NOW.getTime() + 1).toISOString();
    expect(isVoiceAssetExpired({ id: 'a', retainUntil: almostNow }, NOW)).toBe(false);
  });

  it('既にdeletedAtが設定済みなら再度削除対象にしない', () => {
    expect(
      isVoiceAssetExpired({ id: 'a', retainUntil: undefined, deletedAt: NOW.toISOString() }, NOW),
    ).toBe(false);
  });
});

describe('selectExpiredVoiceAssets', () => {
  it('複数件から削除対象のみを抽出する', () => {
    const past = new Date(NOW.getTime() - 1000).toISOString();
    const future = new Date(NOW.getTime() + 1000).toISOString();
    const assets = [
      { id: 'expired-no-limit' },
      { id: 'expired-past', retainUntil: past },
      { id: 'not-expired', retainUntil: future },
      { id: 'already-deleted', deletedAt: NOW.toISOString() },
    ];
    const result = selectExpiredVoiceAssets(assets, NOW);
    expect(result.map((a) => a.id).sort()).toEqual(['expired-no-limit', 'expired-past']);
  });

  it('空配列を渡しても空配列を返す', () => {
    expect(selectExpiredVoiceAssets([], NOW)).toEqual([]);
  });
});
