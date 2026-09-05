# データモデル設計

対応する実装は `supabase/migrations/`。全テーブルで RLS を有効化する（詳細ポリシーは各migrationファイル、要約は各テーブルの「RLS方針」欄）。

命名規則: テーブル名は複数形スネークケース。主キーは `id uuid default gen_random_uuid()`。作成/更新日時は `created_at` / `updated_at`（トリガーで自動更新）。

## 1. profiles
ユーザー基本プロフィール（1ユーザー1行、`auth.users.id` と同一IDを使用）。

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK, references auth.users(id) | |
| display_name | text | 表示名 |
| birthdate | date | 生年月日（18歳以上をアプリ層+DB制約で検証） |
| gender | text | 自認する性別（列挙: male/female/nonbinary/self_describe） |
| gender_self_describe | text null | self_describe選択時の自由記述 |
| bio | text null | 自己紹介 |
| conversation_style | text null | 会話スタイル（例: text_first/voice_first/balanced） |
| area | text null | 大まかな活動エリア（市区町村レベル、緯度経度は保存しない） |
| travel_distance_km | int null | 移動可能距離の目安 |
| budget_range | text null | 希望予算帯（列挙: low/mid/high） |
| age_verified_method | text default 'self_declared' | 年齢確認方式（将来 'id_document' 等を追加） |
| onboarding_completed_at | timestamptz null | プロフィール作成完了時刻 |
| terms_agreed_at | timestamptz null | 利用規約同意時刻 |
| privacy_agreed_at | timestamptz null | プライバシー同意時刻 |
| status | text default 'active' | active/deactivated/deleted |
| created_at / updated_at | timestamptz | |

RLS方針: 本人は自分の行をSELECT/UPDATE可。他人の行は「相互マッチ済み」の場合のみ直接SELECT可能（`profiles_select_matched`ポリシー）。マッチ前の推薦候補は`profiles`テーブルへの直接SELECTを許可せず、代わりにSECURITY DEFINER関数 `get_candidate_pool()`（auth.uid()を基準にハード条件を満たす候補のみ、スコアリングに必要な列だけを返す）経由で取得する（Phase2実装、`supabase/migrations/20260905000001_matching_rpc.sql`）。

## 2. dating_preferences
恋愛目的・希望相手条件（1ユーザー1行）。

| カラム | 型 | 説明 |
|---|---|---|
| profile_id | uuid PK/FK → profiles.id | |
| seeking_gender | text[] | 出会いたい相手の性別（複数可） |
| relationship_intent | text | casual/serious/marriage_oriented/undecided |
| age_min / age_max | int | 希望年齢範囲 |
| date_style | text null | 会話中心/体験型 等 |
| created_at / updated_at | timestamptz | |

RLS方針: 本人のみSELECT/UPDATE。マッチングスコア計算はサーバー側（Edge Function, service role）で行うため、他ユーザーからの直接参照は許可しない。

## 3. profile_answers
価値観質問への回答（プロフィールを補強するQ&A）。

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| profile_id | uuid FK | |
| question_key | text | 質問ID（例: `values_family`） |
| answer_text | text null | |
| answer_choice | text null | 選択式回答 |
| created_at | timestamptz | |

RLS方針: 本人のみCRUD。相手への開示は推薦理由生成時にサーバー側で要約された形のみ（生回答は開示しない）。

## 4. interests / profile_interests
興味タグのマスタと中間テーブル。

**interests**: `id uuid PK`, `key text unique`, `label_ja text`, `category text null`
**profile_interests**: `profile_id uuid FK`, `interest_id uuid FK`, PK(profile_id, interest_id)

RLS方針: `interests` は認証済みユーザー全員がSELECT可（マスタデータ）。`profile_interests` は本人のみCRUD。マッチ前の候補者の興味は`get_candidate_pool()`が集約して返す（直接テーブルへの他人アクセスは許可しない）。マッチ後はPhase3で候補一覧と同等の参照手段を追加予定。

## 5. availability_slots
会いやすい曜日・時間帯。

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| profile_id | uuid FK | |
| weekday | smallint | 0=日〜6=土 |
| time_band | text | morning/afternoon/evening/night |
| created_at | timestamptz | |

RLS方針: 本人のみCRUD。

## 6. photos
| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| profile_id | uuid FK | |
| storage_path | text | Supabase Storageパス（署名付きURLで配信） |
| position | smallint | 表示順 |
| is_primary | boolean default false | |
| moderation_status | text default 'pending' | pending/approved/rejected |
| created_at | timestamptz | |

RLS方針: 本人のみCRUD。写真アップロード自体は未実装（Phase3以降）で、実装時はマッチ済み相手に限定した参照ポリシーまたはRPC経由での公開を検討する。

## 7. likes
| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| from_profile_id | uuid FK | |
| to_profile_id | uuid FK | |
| created_at | timestamptz | |
| unique(from_profile_id, to_profile_id) | | |

RLS方針: 本人が送信したlikeのみSELECT/INSERT可。受信したlike一覧は原則非公開（「相互マッチ成立まで見えない」仕様。将来「あなたを気になっている」機能を追加する場合は別途設計）。

## 8. matches
相互いいね成立時に生成。

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| profile_id_a / profile_id_b | uuid FK | 常に a<b で正規化し重複防止 |
| matched_at | timestamptz | |
| status | text default 'active' | active/unmatched |
| unmatched_by | uuid null | |
| unmatched_at | timestamptz null | |

RLS方針: `profile_id_a` または `profile_id_b` が自分の場合のみSELECT可。UPDATE(unmatch)は当事者のみ。クライアントからの直接INSERTは許可せず、相互いいねが揃った場合のみSECURITY DEFINER関数 `finalize_match()` が作成する（Phase2実装）。

## 9. messages
| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| match_id | uuid FK | |
| sender_id | uuid FK | |
| content_type | text | text/voice |
| body | text null | 表示用テキスト（音声の場合は文字起こし） |
| voice_asset_id | uuid null FK → voice_assets.id | |
| ai_mode | text null | own_voice_cleanup/ai_draft/raw_voice_clip |
| read_at | timestamptz null | |
| created_at | timestamptz | |

RLS方針: 対応する `matches` の当事者のみSELECT/INSERT。UPDATE(既読)は受信者のみ。ブロック関係がある場合はアプリ層+RLSの両方で不可視化。

## 10. voice_sessions / voice_turns / voice_assets
音声コンシェルジュ・音声メッセージ共通の会話/音声基盤。

**voice_sessions**: `id uuid PK`, `profile_id uuid FK`, `purpose text`(onboarding/search/message/date_feedback), `started_at`, `ended_at null`
**voice_turns**: `id uuid PK`, `session_id uuid FK`, `role text`(user/assistant), `transcript text null`, `confidence numeric null`, `created_at`
**voice_assets**: `id uuid PK`, `owner_profile_id uuid FK`, `storage_path text null`, `purpose text`(profile_answer/message/onboarding), `retain_until timestamptz null`, `deleted_at timestamptz null`, `created_at`

RLS方針: いずれも所有者(`profile_id`/`owner_profile_id`)のみCRUD。生音声は文字起こし完了後に削除ジョブ対象（`retain_until` がnullなら即時削除対象、値があれば期限までのみ保持）。音声メッセージとして送信されたvoice_assetは、送信先のmatch当事者にも期限付き署名URLで限定公開する例外を設ける（Phase3で実装、Phase1ではテーブルのみ）。

## 11. ai_preference_facts
AIが会話から抽出した「明示情報」のみを記録（推測情報は保存しない）。

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| profile_id | uuid FK | |
| fact_key | text | 例: `preferred_weekday`, `preferred_area` |
| fact_value | jsonb | |
| source | text | voice_session/text_form |
| source_session_id | uuid null FK → voice_sessions.id | |
| created_at | timestamptz | |

RLS方針: 本人のみSELECT/DELETE（「AIが覚えていること」画面から削除可能にする）。

## 12. ai_memory_consents
AIメモリの利用同意状態。

| カラム | 型 | 説明 |
|---|---|---|
| profile_id | uuid PK/FK | |
| memory_enabled | boolean default true | |
| updated_at | timestamptz | |

RLS方針: 本人のみCRUD。

## 13. blocks
| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| blocker_id | uuid FK | |
| blocked_id | uuid FK | |
| created_at | timestamptz | |
| unique(blocker_id, blocked_id) | | |

RLS方針: 本人が作成したブロックのみSELECT/INSERT/DELETE可。ブロック有無はマッチング/推薦/チャットのRLSおよびクエリ条件で参照される（安全上、ブロックされた側にブロックされた事実そのものは開示しない）。

## 14. reports
| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| reporter_id | uuid FK | |
| reported_id | uuid FK | |
| match_id | uuid null FK | |
| reason_code | text | |
| detail | text null | |
| status | text default 'open' | open/reviewing/closed |
| created_at | timestamptz | |

RLS方針: 作成者のみSELECT/INSERT（自分の通報履歴の閲覧）。ステータス更新は管理者ロールのみ（Phase4のadmin機構）。

## 15. match_score_cache
説明可能スコアの計算結果キャッシュ（サーバーのみ書込）。

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| profile_id | uuid FK | 閲覧者 |
| candidate_profile_id | uuid FK | |
| total_score | numeric | 0-100（「おすすめ度」） |
| feature_scores | jsonb | 特徴量ごとの0-1スコア |
| reasons | text[] | 表示用の推薦理由（2-3件） |
| computed_at | timestamptz | |

RLS方針: 本人（`profile_id`）のみSELECT可。INSERT/UPDATEはservice roleのみ（クライアントからの書込不可）。

## 16. recommendation_events
学習・改善用イベントログ（Phase1では記録のみ、自動学習は行わない）。

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| profile_id | uuid FK | |
| candidate_profile_id | uuid null FK | |
| event_type | text | recommendation_impression/profile_opened/like_sent/pass/match_created/first_message_sent/reply_received/date_proposal_created/date_proposal_accepted/date_proposal_declined/date_completed/unmatch/block/report |
| metadata | jsonb null | |
| created_at | timestamptz | |

RLS方針: 本人分のみSELECT可。INSERTはservice role経由（クライアントから直接改ざんされないようEdge Function経由に統一。Phase1ではクライアントからのINSERTを本人分のみ許可し、Phase2以降でサーバー集約に寄せる）。

## 17. date_proposals / date_proposal_votes
| date_proposals | 型 | 説明 |
|---|---|---|
| id uuid PK | | |
| match_id uuid FK | | |
| created_by | text | ai/user |
| options | jsonb | 3案（場所/形式、日時候補、所要時間、予算、理由、雨天代替） |
| status | text default 'pending' | pending/confirmed/cancelled |
| confirmed_option_index | int null | |
| created_at | timestamptz | |

| date_proposal_votes | 型 | 説明 |
|---|---|---|
| id uuid PK | | |
| proposal_id uuid FK | | |
| profile_id uuid FK | | |
| option_index | int | |
| vote | text | want/change/other/skip |
| created_at | timestamptz | |

RLS方針: 対応するmatchの当事者のみSELECT/INSERT。相手の投票内容は「同じ案に双方が合意したか」の判定結果のみアプリ層で表示し、生の投票理由は本人にのみ表示する運用とする（Phase3で詳細実装）。

## 18. date_feedback / date_feedback_answers
初回デート後の非公開アンケート。

| date_feedback | 型 | 説明 |
|---|---|---|
| id uuid PK | | |
| match_id uuid FK | | |
| profile_id uuid FK | 回答者 | |
| want_to_meet_again | boolean null | |
| submitted_at | timestamptz null | |
| created_at | timestamptz | |

| date_feedback_answers | 型 | 説明 |
|---|---|---|
| id uuid PK | | |
| feedback_id uuid FK | | |
| question_key text | | |
| answer_text text null | | |
| visibility | text | private/shareable/safety |

RLS方針: 回答者本人のみ全項目SELECT/INSERT可。相手には `visibility='shareable'` かつ本人の事前確認後のみ、サーバー側で要約した内容を別チャネルで提示（生データへの直接RLS越しアクセスは許可しない＝相手プロフィールIDでの直接SELECTは常に拒否）。`safety` 区分はデート推薦に流用せず、通報導線からのみ参照。

## 19. moderation_actions
管理者によるモデレーション記録（Phase4）。

| カラム | 型 | 説明 |
|---|---|---|
| id uuid PK | | |
| target_type | text | profile/photo/message/report |
| target_id uuid | | |
| action | text | warn/hide/suspend/dismiss |
| actor_admin_id uuid | | |
| note text null | | |
| created_at timestamptz | | |

RLS方針: 管理者ロールのみSELECT/INSERT。一般ユーザーからは不可視。

## 20. 共通のRLS実装方針
- 全テーブルで `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` を必須化。
- 「本人判定」は `auth.uid() = profile_id`（または経由するFK）で統一。
- 「マッチ相手判定」は `EXISTS (SELECT 1 FROM matches WHERE status='active' AND (profile_id_a = auth.uid() OR profile_id_b = auth.uid()) AND (profile_id_a = <相手id> OR profile_id_b = <相手id>))` を共通関数化する。
- 「ブロック判定」は `NOT EXISTS (SELECT 1 FROM blocks WHERE (blocker_id, blocked_id) IN ((auth.uid(), 相手), (相手, auth.uid())))` を共通関数化し、可視性判定に必ず組み込む。
- Service Role Key が必要な書込（`match_score_cache`, `recommendation_events` の集計系, `moderation_actions` 等）はクライアントから直接叩かず、将来Edge Function経由に統一する。Phase1時点ではモックバックエンドで代替する。
