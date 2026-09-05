# タスク計画（Phase別）

進め方: 各Phase完了時に「起動確認・型チェック・lint・テスト」を実行し、結果と残課題を報告してから次Phaseへ進む。

## Phase 1（本ドキュメント作成時点で着手・完了目標）
- [x] docs/PRD.md, architecture.md, data-model.md, security.md, tasks.md 作成
- [x] Expoプロジェクト初期化（TypeScript, Expo Router）
- [x] 環境変数サンプル（.env.example）
- [x] Supabaseクライアント + ローカルモックバックエンド
- [x] 認証（メール/OTPのUIとモックフロー）
- [x] オンボーディング（18歳以上確認・利用規約/プライバシー同意）
- [x] プロフィール作成（テキスト入力フォーム: RHF+Zod）
- [x] push-to-talk音声オンボーディングのモック、文字起こし確認画面、マイク権限処理
- [x] 基本ナビゲーション（Expo Router）とWarm Futurismデザインシステム（design tokens）
- [x] AIオーブの待機/聞き取り/思考/候補発見/確認状態、音声波形、Reduce Motion対応
- [x] DB migrationとRLSの初版
- [x] seedデータ
- [x] README（セットアップ・起動・テスト手順）
- [x] 型チェック・lint・テスト・起動確認の実施と報告

## Phase 2（完了）
- [x] マッチングエンジン: ハード条件（年齢範囲・対象性別・恋愛目的・距離・ブロック状態）による候補絞込
- [x] 特徴量計算（reciprocal_fit, values, intent, availability, location, interests, communication_style）の純粋関数実装
- [x] 初期重み（reciprocal_fit .20 / values .20 / intent .15 / availability .20 / location .10 / interests .10 / communication_style .05）を設定ファイルで変更可能にする（`src/lib/matching/weights.ts`。DB化は将来拡張として設計上は差し替え容易）
- [x] 推薦カード・詳細画面・いいね・見送り・相互マッチ
- [x] 音声マッチコンシェルジュ: 自然言語→構造化条件（hard_filters/soft_preferences/intent/budget/date_style）抽出、条件チップ表示・確認
- [x] 音声コマンド（詳しく/次/いいね/条件変更/終わる）と重要操作（いいね送信・条件の大幅な緩和）の確認フロー
- [x] STT/LLM/TTS server-only adapter + mockプロバイダ整備（`extractSearchCriteria`/`classifyVoiceCommand`を追加）
- [x] スコア計算・ハード条件・検索条件適用の単体テスト（境界値、音声誤認識、除外条件） — 93テスト
- [x] RLSを含む権限テスト（ローカルPostgreSQLで実RLSを検証、`scripts/run-rls-tests.sh` で19件全てPASS）

残課題（Phase3以降）:
- 音声波形は簡易アニメーション（実振幅解析ではない）
- TTSは文字起こしテキストの返却のみで実音声再生は未実装
- エリアのゆるい一致判定（`areaLooselyMatches`）は簡易的な同義語辞書ベースで、本格的な地理正規化ではない
- 価値観質問（values特徴量）は`profile_answers`テーブル・スコアリングロジックとも実装済みだが、回答入力UIは未実装のため実運用では常に中立スコアになる
- Supabase実装（RPC・RLS）はローカルPostgreSQLでの検証のみ。実Supabaseプロジェクトでの動作確認は未実施

## Phase 3（Phase2完了後）
- [ ] マッチ後リアルタイムチャット（Supabase Realtime）、既読状態
- [ ] 通報・ブロックのアプリ内導線
- [ ] 音声メッセージ作成3モード（自分の言葉モード/AI文案モード/声のまま送る）＋プレビュー・送信確認必須
- [ ] 初回デート後の非公開アンケート（音声/選択式）
- [ ] 双方の再会意思の秘匿つき相互確認
- [ ] 双方合意時のみのAIセカンドデート提案、3案への投票
- [ ] AI adapterのタイムアウト・再試行・レート制限・フォールバック
- [ ] 位置・非公開予定・private回答・片方だけの再会意思の非開示をテストで確認
- [ ] 音声データ削除ジョブのテスト

## Phase 4（Phase3完了後）
- [ ] recommendation_events記録の充実、任意のデート結果フィードバック
- [ ] 管理・モデレーション画面、モデレーションキュー、監査ログ
- [ ] アカウント削除申請フローの実装
- [ ] 将来のオフライン評価用データセット定義・指標定義ドキュメント（MLモデルは自動学習しない）
- [ ] 個人単位ではなく集計で確認する分析SQL
- [ ] 全テスト・セキュリティ確認の実行

## 最終監査（Phase4完了後）
- [ ] 独立レビュアーとして認証・認可・RLS・秘密情報・個人情報・ブロック/通報・年齢確認・プロンプトインジェクション・依存関係・エラー処理・アクセシビリティ・テスト不足を確認
- [ ] docs/release-audit.md に重大度別（Critical/High/Medium/Low）で再現方法・影響・修正案を記録
- [ ] Critical/Highは修正し回帰テストを実施
- [ ] 実行した検証コマンドと結果を明記（推測で合格としない）

## 参考: MVPに含めない機能（再掲）
顔の魅力度採点／写真からの属性推測／完全自動メッセージ送信／デート成功確率の断定表示／位置の常時追跡／課金・ライブ配信・音声通話などの大型機能／実データ不足段階での複雑なML学習
