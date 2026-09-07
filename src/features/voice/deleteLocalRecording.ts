import { File } from 'expo-file-system';

/**
 * 「自分の言葉モード」「AI文案モード」で使った録音は、文字起こし完了後にこの関数で
 * 端末上のファイルを即時削除する（音声プロフィール・音声メッセージとして本人が明示的に
 * 保存を選んだ場合を除き、生の音声を残さない方針）。
 * ベストエフォートでの削除のため、失敗してもUIフローは継続する。
 */
export async function deleteLocalRecording(uri: string | null | undefined): Promise<void> {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // 端末やプラットフォームによっては削除できない場合がある。致命的ではないため無視する。
  }
}
