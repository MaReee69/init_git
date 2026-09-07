-- Phase3: チャット・ブロック強化・デート後アンケート・AIセカンドデート提案。
--
-- 方針:
--   * ブロック/マッチ解除後は「即時非表示」を徹底するため、messages/date_proposals等の
--     可視性判定を「現在activeなマッチの当事者か」で行う専用関数に切り替える。
--   * 相互の再会意思・投票の集計はSECURITY DEFINER関数に閉じ込め、
--     個人の回答（date_feedback / date_proposal_votes）を相手に直接開示しない。
--   * AIセカンドデート提案の作成は、双方の再会意思確認が取れている場合のみ許可する。

-- =========================================================
-- 1. matchesの当事者IDが後から書き換えられないようにする（既存ポリシーの穴を塞ぐ）
--    matches_update_participant は「当事者であること」しか検証しておらず、
--    profile_id_a/bそのものを書き換える更新まで許可してしまっていたため、トリガーで禁止する。
-- =========================================================
create or replace function prevent_matches_identity_change()
returns trigger
language plpgsql
as $$
begin
  if new.profile_id_a <> old.profile_id_a or new.profile_id_b <> old.profile_id_b then
    raise exception 'profile_id_a / profile_id_b cannot be changed after creation';
  end if;
  return new;
end;
$$;

drop trigger if exists matches_prevent_identity_change on matches;
create trigger matches_prevent_identity_change
  before update on matches
  for each row execute function prevent_matches_identity_change();

-- =========================================================
-- 2. is_active_match_participant: activeなマッチの当事者かどうか。
--    ブロック/マッチ解除後にmessages等へアクセスできなくするため、is_match_participant の代わりに使う。
-- =========================================================
create or replace function is_active_match_participant(target_match_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from matches m
    where m.id = target_match_id
      and m.status = 'active'
      and (m.profile_id_a = auth.uid() or m.profile_id_b = auth.uid())
  );
$$;

revoke all on function is_active_match_participant(uuid) from public;
grant execute on function is_active_match_participant(uuid) to authenticated;

-- =========================================================
-- 3. messages: activeなマッチのみアクセス可にポリシーを更新
-- =========================================================
drop policy if exists messages_select_participant on messages;
create policy messages_select_participant on messages
  for select using (is_active_match_participant(match_id));

drop policy if exists messages_insert_participant on messages;
create policy messages_insert_participant on messages
  for insert with check (
    sender_id = auth.uid() and is_active_match_participant(match_id)
  );

drop policy if exists messages_update_participant on messages;
create policy messages_update_participant on messages
  for update using (is_active_match_participant(match_id))
  with check (is_active_match_participant(match_id));

-- Realtime（本物のSupabaseプロジェクトにのみ存在するpublication。ローカルPostgreSQLでは安全にスキップする）
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table messages';
  end if;
end $$;

-- =========================================================
-- 4. voice_assets: 送信済み音声メッセージは、宛先のマッチ当事者も参照できるようにする
--    （所有者以外への開示は「メッセージとして送られた音声」に限定し、それ以外の用途では従来通り本人限定）
-- =========================================================
create policy voice_assets_select_message_recipient on voice_assets
  for select using (
    exists (
      select 1 from messages m
      where m.voice_asset_id = voice_assets.id
        and is_active_match_participant(m.match_id)
    )
  );

-- =========================================================
-- 5. block_profile: ブロック + 既存マッチの即時解除をまとめて行うRPC
-- =========================================================
create or replace function block_profile(p_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;
  if v_me = p_target then
    raise exception 'cannot block self';
  end if;

  insert into blocks (blocker_id, blocked_id) values (v_me, p_target)
  on conflict (blocker_id, blocked_id) do nothing;

  update matches
    set status = 'unmatched', unmatched_by = v_me, unmatched_at = now()
  where status = 'active'
    and ((profile_id_a = v_me and profile_id_b = p_target) or (profile_id_a = p_target and profile_id_b = v_me));

  insert into recommendation_events (profile_id, candidate_profile_id, event_type)
  values (v_me, p_target, 'block');
end;
$$;

revoke all on function block_profile(uuid) from public;
grant execute on function block_profile(uuid) to authenticated;

-- =========================================================
-- 6. date_proposals / date_proposal_votes: activeマッチ限定 + クライアントからの直接書込を封じる
-- =========================================================
drop policy if exists date_proposals_select_participant on date_proposals;
create policy date_proposals_select_participant on date_proposals
  for select using (is_active_match_participant(match_id));

drop policy if exists date_proposals_update_participant on date_proposals;
-- date_proposals の status/confirmed_option_index はcast_date_proposal_vote()経由のみで更新する。
-- クライアントからの直接UPDATEは許可しない（select/insertポリシーのみ残す）。

drop policy if exists date_proposal_votes_select_participant on date_proposal_votes;
create policy date_proposal_votes_select_participant on date_proposal_votes
  for select using (
    exists (select 1 from date_proposals p where p.id = proposal_id and is_active_match_participant(p.match_id))
  );

-- 投票はcast_date_proposal_vote()経由のみに統一し、直接INSERTは許可しない
-- （「両者が同じ案にwantしたら自動的に確定する」処理を必ず経由させるため）。
drop policy if exists date_proposal_votes_insert_self on date_proposal_votes;

-- =========================================================
-- 7. check_mutual_reunion_interest: 個々の回答内容を開示せず、
--    「双方とも再会を希望しているか」という真偽値だけを返す。
-- =========================================================
create or replace function check_mutual_reunion_interest(p_match_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_a uuid;
  v_b uuid;
  v_want_a boolean;
  v_want_b boolean;
begin
  if not is_match_participant(p_match_id) then
    raise exception 'not a participant';
  end if;

  select profile_id_a, profile_id_b into v_a, v_b from matches where id = p_match_id;

  select want_to_meet_again into v_want_a
    from date_feedback where match_id = p_match_id and profile_id = v_a and submitted_at is not null;
  select want_to_meet_again into v_want_b
    from date_feedback where match_id = p_match_id and profile_id = v_b and submitted_at is not null;

  return coalesce(v_want_a, false) and coalesce(v_want_b, false);
end;
$$;

revoke all on function check_mutual_reunion_interest(uuid) from public;
grant execute on function check_mutual_reunion_interest(uuid) to authenticated;

-- =========================================================
-- 8. create_second_date_proposals: 双方の再会意思確認が取れている場合のみ、
--    AIが生成した3案（クライアント側でZod検証済み）をdate_proposalsへ登録する。
-- =========================================================
create or replace function create_second_date_proposals(p_match_id uuid, p_options jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal_id uuid;
begin
  if not is_match_participant(p_match_id) then
    raise exception 'not a participant';
  end if;
  if not check_mutual_reunion_interest(p_match_id) then
    raise exception 'mutual reunion interest not confirmed';
  end if;

  insert into date_proposals (match_id, created_by, options, status)
  values (p_match_id, 'ai', p_options, 'pending')
  returning id into v_proposal_id;

  return v_proposal_id;
end;
$$;

revoke all on function create_second_date_proposals(uuid, jsonb) from public;
grant execute on function create_second_date_proposals(uuid, jsonb) to authenticated;

-- =========================================================
-- 9. cast_date_proposal_vote: 投票を記録し、双方が同じ案に「行きたい」と
--    投票した時点で自動的にdate_proposalsをconfirmedにする。
-- =========================================================
create or replace function cast_date_proposal_vote(p_proposal_id uuid, p_option_index int, p_vote text)
returns table (confirmed boolean, confirmed_option_index int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_match_id uuid;
  v_a uuid;
  v_b uuid;
  v_a_wants boolean;
  v_b_wants boolean;
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;

  select match_id into v_match_id from date_proposals where id = p_proposal_id;
  if v_match_id is null then
    raise exception 'proposal not found';
  end if;
  if not is_active_match_participant(v_match_id) then
    raise exception 'not an active participant';
  end if;

  insert into date_proposal_votes (proposal_id, profile_id, option_index, vote)
  values (p_proposal_id, v_me, p_option_index, p_vote)
  on conflict (proposal_id, profile_id, option_index) do update set vote = excluded.vote;

  select profile_id_a, profile_id_b into v_a, v_b from matches where id = v_match_id;

  select exists(
    select 1 from date_proposal_votes
    where proposal_id = p_proposal_id and profile_id = v_a and option_index = p_option_index and vote = 'want'
  ) into v_a_wants;
  select exists(
    select 1 from date_proposal_votes
    where proposal_id = p_proposal_id and profile_id = v_b and option_index = p_option_index and vote = 'want'
  ) into v_b_wants;

  if v_a_wants and v_b_wants then
    update date_proposals
      set status = 'confirmed', confirmed_option_index = p_option_index
      where id = p_proposal_id and status = 'pending';
    return query select true, p_option_index;
  end if;

  return query select false, null::int;
end;
$$;

revoke all on function cast_date_proposal_vote(uuid, int, text) from public;
grant execute on function cast_date_proposal_vote(uuid, int, text) to authenticated;

-- =========================================================
-- 10. get_shared_availability: 双方の空き時間の「重なり」だけを返す。
--    片方だけの予定（非公開の予定）は一切含まれない。
-- =========================================================
create or replace function get_shared_availability(p_match_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object('weekday', a1.weekday, 'timeBand', a1.time_band)), '[]'::jsonb)
  from matches m
  join availability_slots a1 on a1.profile_id = m.profile_id_a
  join availability_slots a2
    on a2.profile_id = m.profile_id_b
   and a2.weekday = a1.weekday
   and a2.time_band = a1.time_band
  where m.id = p_match_id
    and (m.profile_id_a = auth.uid() or m.profile_id_b = auth.uid());
$$;

revoke all on function get_shared_availability(uuid) from public;
grant execute on function get_shared_availability(uuid) to authenticated;

-- =========================================================
-- 11. get_shared_date_notes: 双方の visibility='shareable' な回答テキストのみを
--    発言者を区別せずまとめて返す。private/safety回答は絶対に含めない。
-- =========================================================
create or replace function get_shared_date_notes(p_match_id uuid)
returns text[]
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(array_agg(a.answer_text order by a.id), '{}'::text[])
  from date_feedback f
  join date_feedback_answers a on a.feedback_id = f.id
  where f.match_id = p_match_id
    and a.visibility = 'shareable'
    and a.answer_text is not null
    and is_match_participant(p_match_id)
$$;

revoke all on function get_shared_date_notes(uuid) from public;
grant execute on function get_shared_date_notes(uuid) to authenticated;
