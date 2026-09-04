-- 全テーブルでRLSを有効化し、最小権限のポリシーを設定する。
-- 方針（docs/security.md, docs/data-model.md参照）:
--   * 本人判定は auth.uid() = profile_id（またはFK）で統一
--   * 他人データの閲覧は「相互マッチ済み」かつ「ブロックされていない」場合のみ、必要最小限で許可
--   * Service Role Key を要する書込（match_score_cache, recommendation_events集計, moderation_actions等）は
--     クライアントから直接行わせず、将来Edge Function(service role)経由に統一する。
--     Phase1時点では該当機能は未実装のため、クライアントからの直接書込は許可しない。

-- =========================================================
-- profiles
-- =========================================================
alter table profiles enable row level security;

create policy profiles_select_self on profiles
  for select using (id = auth.uid());

create policy profiles_select_matched on profiles
  for select using (
    is_matched_with(id) and not is_blocked_between(auth.uid(), id)
  );

create policy profiles_insert_self on profiles
  for insert with check (id = auth.uid());

create policy profiles_update_self on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- =========================================================
-- dating_preferences
-- =========================================================
alter table dating_preferences enable row level security;

create policy dating_preferences_owner_all on dating_preferences
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- =========================================================
-- profile_answers
-- =========================================================
alter table profile_answers enable row level security;

create policy profile_answers_owner_all on profile_answers
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- =========================================================
-- interests（マスタデータ: 認証済み全員が参照可、書込は不可）
-- =========================================================
alter table interests enable row level security;

create policy interests_select_authenticated on interests
  for select using (auth.role() = 'authenticated');

-- =========================================================
-- profile_interests
-- =========================================================
alter table profile_interests enable row level security;

create policy profile_interests_owner_all on profile_interests
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- =========================================================
-- availability_slots
-- =========================================================
alter table availability_slots enable row level security;

create policy availability_slots_owner_all on availability_slots
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- =========================================================
-- photos
-- =========================================================
alter table photos enable row level security;

create policy photos_owner_all on photos
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy photos_select_matched on photos
  for select using (
    moderation_status = 'approved'
    and is_matched_with(profile_id)
    and not is_blocked_between(auth.uid(), profile_id)
  );

-- =========================================================
-- likes（送信分のみ本人が参照可。受信一覧は非公開）
-- =========================================================
alter table likes enable row level security;

create policy likes_select_sent on likes
  for select using (from_profile_id = auth.uid());

create policy likes_insert_own on likes
  for insert with check (
    from_profile_id = auth.uid()
    and not is_blocked_between(auth.uid(), to_profile_id)
  );

create policy likes_delete_own on likes
  for delete using (from_profile_id = auth.uid());

-- =========================================================
-- matches
-- =========================================================
alter table matches enable row level security;

create policy matches_select_participant on matches
  for select using (profile_id_a = auth.uid() or profile_id_b = auth.uid());

create policy matches_update_participant on matches
  for update using (profile_id_a = auth.uid() or profile_id_b = auth.uid())
  with check (profile_id_a = auth.uid() or profile_id_b = auth.uid());

-- matchesのinsertはマッチング成立ロジック（Edge Function/service role）経由に統一し、
-- クライアントからの直接insertは許可しない。

-- =========================================================
-- messages
-- =========================================================
alter table messages enable row level security;

create policy messages_select_participant on messages
  for select using (is_match_participant(match_id));

create policy messages_insert_participant on messages
  for insert with check (
    sender_id = auth.uid() and is_match_participant(match_id)
  );

create policy messages_update_participant on messages
  for update using (is_match_participant(match_id))
  with check (is_match_participant(match_id));

-- =========================================================
-- voice_sessions / voice_turns / voice_assets
-- =========================================================
alter table voice_sessions enable row level security;

create policy voice_sessions_owner_all on voice_sessions
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

alter table voice_turns enable row level security;

create policy voice_turns_owner_all on voice_turns
  for all using (
    exists (select 1 from voice_sessions s where s.id = session_id and s.profile_id = auth.uid())
  )
  with check (
    exists (select 1 from voice_sessions s where s.id = session_id and s.profile_id = auth.uid())
  );

alter table voice_assets enable row level security;

create policy voice_assets_owner_all on voice_assets
  for all using (owner_profile_id = auth.uid()) with check (owner_profile_id = auth.uid());

-- =========================================================
-- ai_preference_facts / ai_memory_consents
-- =========================================================
alter table ai_preference_facts enable row level security;

create policy ai_preference_facts_owner_all on ai_preference_facts
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

alter table ai_memory_consents enable row level security;

create policy ai_memory_consents_owner_all on ai_memory_consents
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- =========================================================
-- blocks / reports
-- =========================================================
alter table blocks enable row level security;

create policy blocks_owner_select on blocks
  for select using (blocker_id = auth.uid());

create policy blocks_owner_insert on blocks
  for insert with check (blocker_id = auth.uid());

create policy blocks_owner_delete on blocks
  for delete using (blocker_id = auth.uid());

alter table reports enable row level security;

create policy reports_owner_select on reports
  for select using (reporter_id = auth.uid());

create policy reports_owner_insert on reports
  for insert with check (reporter_id = auth.uid());

-- =========================================================
-- match_score_cache（service role書込のみ。クライアントは自分の分の参照のみ）
-- =========================================================
alter table match_score_cache enable row level security;

create policy match_score_cache_select_self on match_score_cache
  for select using (profile_id = auth.uid());

-- =========================================================
-- recommendation_events（本人分のみ記録・参照可。Phase1時点ではクライアント記録を許可）
-- =========================================================
alter table recommendation_events enable row level security;

create policy recommendation_events_select_self on recommendation_events
  for select using (profile_id = auth.uid());

create policy recommendation_events_insert_self on recommendation_events
  for insert with check (profile_id = auth.uid());

-- =========================================================
-- date_proposals / date_proposal_votes
-- =========================================================
alter table date_proposals enable row level security;

create policy date_proposals_select_participant on date_proposals
  for select using (is_match_participant(match_id));

create policy date_proposals_update_participant on date_proposals
  for update using (is_match_participant(match_id)) with check (is_match_participant(match_id));

alter table date_proposal_votes enable row level security;

create policy date_proposal_votes_select_participant on date_proposal_votes
  for select using (
    exists (select 1 from date_proposals p where p.id = proposal_id and is_match_participant(p.match_id))
  );

create policy date_proposal_votes_insert_self on date_proposal_votes
  for insert with check (
    profile_id = auth.uid()
    and exists (select 1 from date_proposals p where p.id = proposal_id and is_match_participant(p.match_id))
  );

-- =========================================================
-- date_feedback / date_feedback_answers（本人のみ。相手への直接開示は行わない）
-- =========================================================
alter table date_feedback enable row level security;

create policy date_feedback_owner_all on date_feedback
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

alter table date_feedback_answers enable row level security;

create policy date_feedback_answers_owner_all on date_feedback_answers
  for all using (
    exists (select 1 from date_feedback f where f.id = feedback_id and f.profile_id = auth.uid())
  )
  with check (
    exists (select 1 from date_feedback f where f.id = feedback_id and f.profile_id = auth.uid())
  );

-- =========================================================
-- moderation_actions（管理者のみ。Phase4で管理者ロールを導入するまでクライアントからは不可視）
-- =========================================================
alter table moderation_actions enable row level security;
-- ポリシーを意図的に設定しない = authenticatedロールからは常にアクセス不可（Service Role Keyのみ操作可）
