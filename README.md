# スキマッチ（Skimatch）

「好きと予定が合う人に、ちゃんと会える。」 18歳以上限定・音声AIコンシェルジュ型の恋愛マッチングアプリMVP。

詳細仕様は [`docs/PRD.md`](docs/PRD.md)、設計は [`docs/architecture.md`](docs/architecture.md) / [`docs/data-model.md`](docs/data-model.md) / [`docs/security.md`](docs/security.md)、進捗は [`docs/tasks.md`](docs/tasks.md) を参照してください。

> **現在の状況: Phase 2完了。** 認証・オンボーディング・プロフィール作成に加え、説明可能なマッチングエンジン、音声/タップ両対応の候補紹介・いいね・相互マッチ、音声マッチコンシェルジュ（自然言語→検索条件の構造化）が実装済みです。チャット・デート提案はPhase3以降で実装します。

## 技術スタック
Expo (React Native) + TypeScript + Expo Router / Supabase (Auth, Postgres, Storage, Realtime, RLS, pgvector) / TanStack Query / React Hook Form + Zod / Reanimated + Blur + LinearGradient + Haptics / expo-audio。選定理由は [`docs/architecture.md`](docs/architecture.md) を参照。

## セットアップ

### 前提
- Node.js 20+（本リポジトリはNode 22で動作確認）
- npm

### インストール
```bash
npm install
cp .env.example .env
```

`.env` は既定で `EXPO_PUBLIC_USE_MOCK_BACKEND=true` のため、**Supabaseプロジェクトが無くてもそのまま起動できます**（データは端末内のAsyncStorageに保存されるローカルモックバックエンドで動作します）。AI機能（音声認識・条件抽出・応答生成）も `AI_API_KEY` 未設定時は常にモックプロバイダで動作します。

実際のSupabaseプロジェクトに接続する場合は、`.env` に以下を設定してください（値は絶対にコミットしないこと）。
```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_USE_MOCK_BACKEND=false
```

### 起動
```bash
npm run web      # ブラウザで確認（本コンテナ環境ではこれが主な検証手段）
npm run start     # Expo Dev Tools（実機/シミュレータはQRコード等で接続）
npm run ios       # iOSシミュレータ（要macOS）
npm run android   # Androidエミュレータ
```

モックモードでの動作確認手順:
1. `npm run web` を実行
2. 「はじめる（メールで登録）」→ 任意のメールアドレスを入力
3. 確認コード画面で **`123456`** を入力（モックモードの固定コード。画面内にも案内表示あり）
4. 18歳以上確認・利用規約同意 → プロフィール作成方法を選択
   - 「テキストで始める」: フォームに直接入力
   - 「音声で始める」: マイク権限を許可後、「押して話す」→ 数秒後「話し終える」で、モックの文字起こし・条件抽出結果を確認できる
5. プロフィールを完成させるとホーム画面（AIオーブ）に遷移
6. ホーム画面で「押して話す」→ 話し終える、または画面下の入力欄にテキストを入力して「この内容で伝える」を押すと、AIが希望条件（エリア・空き時間・興味・恋愛目的・予算）を抽出してチップ表示します。「この条件で探す」で候補紹介が始まります
7. 候補紹介中は「もう少し詳しく」「次の人」「この人いいかも」「条件を変えて」「今日は終わる」と話しかけるか、画面下のボタンをタップして操作できます。いいね送信・マッチ成立は必ず確認ダイアログを挟みます
8. モックモードでマッチを試すには、2つの異なるメールアドレスで別々にプロフィールを作成し（例: alice@example.com / bob@example.com、性別と「出会いたい相手」を相互に一致させる）、双方から相手に「いいね」を送ると相思相愛でマッチが成立します（同一ブラウザのローカルストレージ内で複数アカウントを行き来して試せます）

### 型チェック・Lint・テスト
```bash
npm run typecheck
npm run lint
npm run test
```

## Supabase（実接続する場合）
[Supabase CLI](https://supabase.com/docs/guides/cli) を導入した上で:
```bash
supabase init      # supabase/config.toml が無い場合のみ
supabase start      # ローカルSupabaseスタックを起動
supabase db reset    # supabase/migrations の適用 + supabase/seed.sql の投入
```
`supabase/migrations/` に全テーブルのDDLとRLSポリシーが含まれています。`supabase/seed.sql` はローカル開発専用のダミーユーザー・プロフィールを投入します（本番環境には絶対に適用しないでください）。

Service Role Key・AI APIキーはクライアント（Expoアプリ）に一切含めません。詳細は [`docs/security.md`](docs/security.md) を参照してください。

### RLS（Row Level Security）の権限テスト

Supabase CLIを使わず、ローカルのPostgreSQLに対してRLSポリシーを直接検証するテストスクリプトを用意しています（`supabase/tests/`）。auth.uid()/auth.role() をSupabaseのGoTrueと同じ仕様でスタブ実装し、複数ユーザーになりすましながら「他人の非公開データを取得できないこと」「ブロック/マッチ/いいねの可視性」「moderation_actionsが一般ユーザーから不可視であること」などを自動検証します。

```bash
# 前提: ローカルにPostgreSQL(psql)がインストール・起動していること
service postgresql start   # 環境に応じて
./scripts/run-rls-tests.sh
```

`supabase/tests/rls_test.sql` に検証項目が列挙されています。最終行に `X passed, Y failed` が出力され、1件でも失敗があれば終了コード1を返します。

## ディレクトリ構成
```
app/                     Expo Router 画面（(auth)/(onboarding)/(tabs)）
src/theme/               Warm Futurism デザイントークン
src/components/          汎用UIコンポーネント
src/features/orb/        AIオーブ（待機/聞き取り/思考/発見/確認の状態機械）
src/features/voice/      push-to-talk録音・波形表示
src/features/matching/   推薦カード等マッチングUI
src/lib/backend/         データアクセス層（Supabase実装 / ローカルモック実装）
src/lib/ai/              STT/LLM/TTS server-only adapterインターフェース + モック実装
src/lib/matching/        マッチングエンジン（ハード条件・スコアリング・探索枠・検索条件適用の純粋関数）
src/schemas/             Zodスキーマ（フォーム・AI抽出結果の検証に共用）
supabase/migrations/     DBスキーマ・RLSポリシー・候補抽出/マッチ成立RPC
supabase/seed.sql        ローカル開発用シードデータ
supabase/tests/          RLS権限テスト（ローカルPostgreSQL用）
scripts/run-rls-tests.sh RLSテスト実行スクリプト
docs/                    PRD・設計・セキュリティ・タスク計画
```

## 既知の制約・残課題（詳細はdocs/tasks.md）
- チャット、音声メッセージ、デート後アンケート、AIセカンドデート提案は未実装（Phase3以降）
- 写真アップロード（Supabase Storage連携）は未実装。候補カードは頭文字プレースホルダーで表示
- 音声波形は実際のマイク振幅ではなく、録音中かどうかに基づく簡易アニメーション
- STT/LLMはすべてモック実装（キーワードベースの抽出ロジック）。TTSはテキスト返却のみで実音声再生は未実装
- 「価値観」特徴量は本人回答UIが未実装のため、実運用では常に中立スコアになる
- エリアのゆるい一致判定は簡易的な同義語辞書ベースで、本格的な地理正規化ではない
- RLS・RPCはローカルPostgreSQLで検証済み（上記スクリプト）だが、実Supabaseプロジェクトでの動作確認は未実施
- 本コンテナ環境にiOS/Androidシミュレータが無いため、実機/シミュレータでの動作確認は各自の開発環境で行ってください（`npm run ios` / `npm run android`）
