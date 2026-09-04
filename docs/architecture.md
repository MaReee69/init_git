# アーキテクチャ設計

## 1. 技術スタックと選定理由

| 領域 | 選定 | バージョン(2026-09時点でのインストール実績) | 選定理由 |
|---|---|---|---|
| モバイルフレームワーク | Expo (managed) + React Native | expo ~57.0.20 / react-native 0.86.3 | OTA更新、Expo Router、豊富なネイティブモジュール(Blur/Haptics/Audio)がMVP開発速度に直結。iOS/Android/Webを単一コードベースで検証可能 |
| 言語 | TypeScript | ~6.0.3 | フォーム/DBスキーマ/AI出力をZodと組み合わせて型安全に扱うため必須 |
| ルーティング | Expo Router | ~57.0.19 | ファイルベースルーティングでフロー(auth/onboarding/(tabs)等)を宣言的に管理 |
| React | react / react-dom | 19.2.3 | Expo SDK57の既定バージョンに追随 |
| サーバー/DB | Supabase (Postgres + Auth + Storage + Realtime + RLS + pgvector) | @supabase/supabase-js ^2.115 | RLSによる行レベル権限制御、Realtimeでチャット、pgvectorで将来の意味検索に対応。BaaSでMVP速度を優先 |
| サーバー処理 | Supabase Edge Functions（インターフェースのみ、Phase2以降で実装） | - | AI呼び出し・スコアリング等、クライアントにキーを渡せない処理をサーバー側に隔離 |
| データフェッチ/キャッシュ | TanStack Query | ^5.102 | サーバー状態とクライアント状態を分離し、キャッシュ・再試行・楽観的更新を統一的に扱う |
| フォーム | React Hook Form + Zod (+ @hookform/resolvers) | ^7.87 / ^4.5 | プロフィール入力・音声抽出結果のいずれも同じZodスキーマで検証。AI出力もこのスキーマで検証しフォールバック可能にする |
| アニメーション | react-native-reanimated | 4.5.1 | AIオーブ・波形・トランジションを60fps目標でネイティブスレッド駆動するため |
| UI装飾 | expo-blur / expo-linear-gradient / expo-haptics | ~57.0.x | Warm Futurismのガラスレイヤー・グロー・触覚フィードバックを実現 |
| 音声録音 | expo-audio | ~57.0.4 | Expo SDK52以降でexpo-avから移行した標準API。録音・簡易再生に対応 |
| ローカル永続化 | @react-native-async-storage/async-storage / expo-secure-store | 最新 | 非機微データはAsyncStorage、セッション/トークン等はSecureStoreに分離 |
| テスト | jest-expo / @testing-library/react-native | ~57 / ^13 | Expo公式が保守するJestプリセットで実機無しでも単体・コンポーネントテスト可能 |
| Lint | eslint / eslint-config-expo | ^9 / ~57 | Expo公式Lint設定に準拠 |

すべて `npx expo install` が示す SDK57 互換の最新安定版を採用した（2026-09-04時点のnpmレジストリ）。

## 2. 前提・仮定（Assumptions）
実装をブロックしない範囲で以下を仮定した。変更が必要な場合はこのファイルと該当コードを更新する。

1. **Supabase接続**: 実プロジェクトの認証情報は未提供。`EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` が未設定、または `EXPO_PUBLIC_USE_MOCK_BACKEND=true` の場合、`src/lib/backend` はメモリ内モックバックエンドにフォールバックする。本番運用時はSupabaseプロジェクトを作成し、`supabase/migrations` を適用の上、環境変数を設定する。
2. **AIプロバイダ**: `AI_API_KEY`（サーバーサイドのみ、Edge Function想定）が未設定の場合、`src/lib/ai` の各アダプタ（STT/LLM/TTS）はモック実装を返す。本番プロバイダ（例: OpenAI Whisper/GPT、Anthropic Claude、ElevenLabs等）は将来のPhaseでアダプタを追加実装する。
3. **年齢確認**: MVPでは生年月日入力 + 18歳未満をブロックするバリデーション + 利用規約/プライバシー同意チェックボックスのみ。公的書類によるeKYCは将来拡張とし、`profiles.age_verified_method` に `self_declared` を記録する設計だけ用意する。
4. **検証環境**: 本コンテナにiOS/Androidシミュレータは存在しないため、Phase毎の起動確認は `tsc --noEmit`・`eslint`・`jest`・`expo start --web`（またはexpo-doctor相当の静的検証）で行う。実機/シミュレータでの確認手順はREADMEに記載し、ユーザー側での実施を前提とする。
5. **決済・収益化**: MVP要件に明記がないため非スコープとする。

## 3. 全体構成

```
[Expo App (iOS/Android/Web)]
   ├─ Expo Router (app/)
   ├─ UI層: components/, features/*/components
   ├─ 状態: TanStack Query (サーバー状態) + React Context/useReducer (音声UI状態)
   ├─ フォーム: React Hook Form + Zod schemas (src/schemas)
   ├─ データアクセス層: src/lib/backend (Repository interface)
   │     ├─ supabase実装 (src/lib/backend/supabase/*)
   │     └─ mock実装 (src/lib/backend/mock/*)  ← ローカル起動の既定
   └─ AIアダプタ層: src/lib/ai (STT/LLM/TTS Adapter interface)
         ├─ mockプロバイダ（既定・キー不要）
         └─ 実プロバイダ（Phase2以降、サーバー経由のみ）

[Supabase]
   ├─ Auth (Email OTP)
   ├─ Postgres + RLS (supabase/migrations)
   ├─ Storage (photos, voice_assets)
   ├─ Realtime (messages)
   └─ Edge Functions (Phase2以降: AI呼び出し, スコアリング, モデレーション)
```

### レイヤー方針
- **クライアントはSupabase Service Role Keyを一切持たない。** 匿名キーのみ使用し、権限はRLSで担保する。
- **AI APIキーはクライアントに置かない。** クライアントは常にサーバー（Edge Function）経由でAI機能を呼び出す想定とし、Phase1時点ではその境界（Adapterインターフェース）とモック実装のみを用意する。
- データアクセスは `Repository` インターフェース越しに行い、実装を「Supabase」「Mock」で差し替え可能にする（テスト容易性・オフライン開発のため）。

## 4. ディレクトリ構成（Phase1時点）

```
app/                      Expo Router 画面
  _layout.tsx              ルートレイアウト（Provider類）
  index.tsx                 起動判定→リダイレクト
  (auth)/                  未認証フロー
    welcome.tsx
    sign-in.tsx
    verify-otp.tsx
  (onboarding)/            認証後・プロフィール未完了フロー
    age-consent.tsx
    profile-method.tsx      テキスト or 音声を選択
    profile-form.tsx        テキストでの多段フォーム
    voice-onboarding.tsx    push-to-talk 音声オンボーディング
    voice-review.tsx        文字起こし確認画面
  (tabs)/                  メインアプリ（プロフィール完了後）
    index.tsx                ホーム（AIオーブ）
    matches.tsx               補助的な一覧（アクセシビリティ用）
    profile.tsx                自分のプロフィール/設定入口
src/
  theme/                   design tokens (Warm Futurism)
  components/              汎用UI (GlassCard, PrimaryButton, Chip 等)
  features/
    orb/                    AIオーブ状態機械・波形
    voice/                  録音・権限・モック文字起こし
    onboarding/              フォームstep構成
  lib/
    backend/                 Repository interface + supabase/mock実装
    ai/                       STT/LLM/TTS adapter interface + mock実装
    supabaseClient.ts
  schemas/                  Zod schemas（プロフィール、音声抽出結果 等）
  state/                    Reactコンテキスト（Auth, VoiceSession）
supabase/
  migrations/               SQL migration（テーブル + RLS）
  seed.sql                  seedデータ
docs/                      本ドキュメント群
```

## 5. 状態管理方針
- **サーバー由来データ**: TanStack Query（キャッシュキーはRepositoryのメソッド単位）
- **フォーム入力**: React Hook Form（画面ローカル）
- **認証セッション**: React Context（`AuthProvider`）。Supabase Authのセッションを購読し、SecureStoreにトークンを永続化
- **音声セッションUI状態**（オーブの状態、認識中テキスト、抽出条件チップ）: `useReducer` による明示的な状態機械（idle→listening→thinking→result→confirm→...）。Zustand等の追加ライブラリは導入せず、指定技術スタックの範囲で完結させる

## 6. AIアダプタ設計（server-only, 交換可能）
```ts
interface SpeechToTextAdapter {
  transcribe(audio: { uri: string; mimeType: string }): Promise<{ text: string; confidence: number }>
}
interface LlmAdapter {
  extractSearchCriteria(input: { transcript: string; history: ConversationTurn[] }): Promise<SearchCriteria>
  // Phase2以降: explainMatch, draftMessage, secondDateProposal 等を追加
}
interface TextToSpeechAdapter {
  synthesize(input: { text: string }): Promise<{ audioUri: string; durationMs: number }>
}
```
- 実装はすべて `AI_API_KEY` の有無で `mock` / `live` を切り替えるファクトリ関数から取得する。
- クライアントは上記インターフェースを直接叩かず、Phase2以降はEdge Function経由のHTTP呼び出しにラップする（Phase1では型とモックのみ用意し、UIから直接mock adapterを呼ぶ簡易構成）。
- Phase1のUIは push-to-talk（タップ→録音→送信→モック文字起こし→確認→モックAI応答）のみを実装し、将来の低遅延ストリーミング対話は本インターフェースを維持したまま置き換えられるようにする。

## 7. AIオーブ状態機械
状態: `idle | listening | thinking | found | confirm | error`
- 各状態は色・形状・アニメーション・テキストラベルの組み合わせで表現し、色のみに依存しない（アクセシビリティ要件）。
- `Reduce Motion` 有効時は変形・粒子アニメーションを静的なフェード/アイコン切替に縮退する。

## 8. セキュリティ境界（詳細はdocs/security.md）
- RLSを全テーブルに設定し、クライアントは常にログインユーザーのJWTコンテキストでアクセス。
- 生の位置情報は保存しない。エリア名（例: 「渋谷区」）と大まかな移動可能距離のみ。
- 音声原本は文字起こし後に削除がデフォルト。保持は本人選択時のみ・期限付き。

## 9. Phase構成
詳細タスクは docs/tasks.md 参照。Phase1完了後、都度 `tsc`/`eslint`/`jest`/`expo start --web` で検証し、結果を報告してから次Phaseへ進む。
