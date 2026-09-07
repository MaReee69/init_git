/**
 * 音声データの保持ポリシー（docs/security.md参照）。
 * 既定は「文字起こし完了後に削除」。音声プロフィール・音声メッセージとして
 * 本人が明示的に保存を選んだ場合のみ、期限付きで保持する。
 */

export const VOICE_RETENTION_DAYS = 90;

export interface VoiceAssetLike {
  id: string;
  retainUntil?: string | null;
  deletedAt?: string | null;
}

/**
 * 保存を選んだ場合の保持期限を計算する。選ばなかった場合はnull（=保持しない、
 * 呼び出し側でvoice_asset自体を作らないか即時削除する）。
 */
export function computeVoiceRetentionExpiry(savedByUser: boolean, now: Date = new Date()): Date | null {
  if (!savedByUser) return null;
  const expiry = new Date(now);
  expiry.setDate(expiry.getDate() + VOICE_RETENTION_DAYS);
  return expiry;
}

/**
 * 削除ジョブが対象とすべきレコードか判定する純粋関数。
 * - 既に削除済み(deletedAt設定済み)は対象外
 * - retainUntil未設定（=保持期限なし）は削除対象
 * - retainUntilが現在時刻以前なら削除対象（境界値: ちょうど同時刻は削除対象に含める）
 */
export function isVoiceAssetExpired(asset: VoiceAssetLike, now: Date = new Date()): boolean {
  if (asset.deletedAt) return false;
  if (!asset.retainUntil) return true;
  return new Date(asset.retainUntil).getTime() <= now.getTime();
}

export function selectExpiredVoiceAssets<T extends VoiceAssetLike>(assets: T[], now: Date = new Date()): T[] {
  return assets.filter((asset) => isVoiceAssetExpired(asset, now));
}
