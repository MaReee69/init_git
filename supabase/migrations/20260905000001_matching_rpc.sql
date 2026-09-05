-- Phase2: マッチングエンジン用のRPC。
-- 候補抽出（ハード条件）はSECURITY DEFINER関数内でauth.uid()のみを基準に行い、
-- クライアントから任意のprofile_idを渡させない（他人の候補プールを覗けないようにする）。
-- スコア計算自体は純粋関数(src/lib/matching)としてクライアント側に実装し、テスト容易性を確保する。
-- 相互マッチの成立判定・matches行の作成のみ、直接INSERT権限を与えずこのRPC経由に限定する。

-- =========================================================
-- get_candidate_pool: ハード条件で絞り込んだ候補プールを返す
-- =========================================================
create or replace function get_candidate_pool()
returns table (
  candidate_id uuid,
  display_name text,
  bio text,
  birthdate date,
  gender text,
  area text,
  travel_distance_km int,
  budget_range text,
  conversation_style text,
  status text,
  seeking_gender text[],
  relationship_intent text,
  age_min int,
  age_max int,
  availability jsonb,
  interest_keys text[],
  answers jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  with me as (
    select
      p.id,
      p.birthdate,
      p.gender,
      p.area,
      p.travel_distance_km,
      dp.seeking_gender,
      dp.relationship_intent,
      dp.age_min,
      dp.age_max
    from profiles p
    join dating_preferences dp on dp.profile_id = p.id
    where p.id = auth.uid()
  )
  select
    p.id as candidate_id,
    p.display_name,
    p.bio,
    p.birthdate,
    p.gender,
    p.area,
    p.travel_distance_km,
    p.budget_range,
    p.conversation_style,
    p.status,
    dp.seeking_gender,
    dp.relationship_intent,
    dp.age_min,
    dp.age_max,
    coalesce(
      (select jsonb_agg(jsonb_build_object('weekday', a.weekday, 'timeBand', a.time_band))
         from availability_slots a where a.profile_id = p.id),
      '[]'::jsonb
    ) as availability,
    coalesce(
      (select array_agg(i.key) from profile_interests pi join interests i on i.id = pi.interest_id
         where pi.profile_id = p.id),
      '{}'::text[]
    ) as interest_keys,
    coalesce(
      (select jsonb_agg(jsonb_build_object('questionKey', pa.question_key, 'answerChoice', pa.answer_choice))
         from profile_answers pa where pa.profile_id = p.id),
      '[]'::jsonb
    ) as answers
  from profiles p
  join dating_preferences dp on dp.profile_id = p.id
  cross join me
  where auth.uid() is not null
    and p.id <> auth.uid()
    and p.status = 'active'
    -- 年齢範囲（相互）
    and extract(year from age(p.birthdate))::int between me.age_min and me.age_max
    and extract(year from age(me.birthdate))::int between dp.age_min and dp.age_max
    -- 対象性別（相互）
    and me.gender = any(dp.seeking_gender)
    and p.gender = any(me.seeking_gender)
    -- 恋愛目的（明確に相容れない組み合わせのみ除外）
    and not (
      (me.relationship_intent = 'casual' and dp.relationship_intent = 'marriage_oriented') or
      (me.relationship_intent = 'marriage_oriented' and dp.relationship_intent = 'casual')
    )
    -- 距離（エリア一致、またはいずれかが広い移動可能距離を申告）
    and (
      (me.area is not null and p.area is not null and lower(trim(me.area)) = lower(trim(p.area)))
      or coalesce(me.travel_distance_km, 0) >= 30
      or coalesce(p.travel_distance_km, 0) >= 30
    )
    -- ブロック状態
    and not exists (
      select 1 from blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = auth.uid())
    )
    -- 既にいいね/見送り/マッチ済みは再提示しない
    and not exists (select 1 from likes l where l.from_profile_id = auth.uid() and l.to_profile_id = p.id)
    and not exists (
      select 1 from recommendation_events e
      where e.profile_id = auth.uid() and e.candidate_profile_id = p.id and e.event_type = 'pass'
    )
    and not exists (
      select 1 from matches m
      where (m.profile_id_a = auth.uid() and m.profile_id_b = p.id)
         or (m.profile_id_a = p.id and m.profile_id_b = auth.uid())
    );
$$;

revoke all on function get_candidate_pool() from public;
grant execute on function get_candidate_pool() to authenticated;

-- =========================================================
-- finalize_match: 相互いいねが揃った場合のみmatchesへ書き込む。
-- 直接matchesへのINSERT権限は付与せず、この関数経由に限定する。
-- =========================================================
create or replace function finalize_match(p_other uuid)
returns table (matched boolean, match_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_a uuid;
  v_b uuid;
  v_match_id uuid;
  v_reciprocal boolean;
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;
  if v_me = p_other then
    raise exception 'cannot match with self';
  end if;

  select
    exists(select 1 from likes where from_profile_id = v_me and to_profile_id = p_other)
    and exists(select 1 from likes where from_profile_id = p_other and to_profile_id = v_me)
  into v_reciprocal;

  if not v_reciprocal then
    return query select false, null::uuid;
    return;
  end if;

  v_a := least(v_me, p_other);
  v_b := greatest(v_me, p_other);

  select id into v_match_id from matches where profile_id_a = v_a and profile_id_b = v_b;

  if v_match_id is null then
    insert into matches (profile_id_a, profile_id_b) values (v_a, v_b) returning id into v_match_id;
    insert into recommendation_events (profile_id, candidate_profile_id, event_type)
      values (v_me, p_other, 'match_created');
    insert into recommendation_events (profile_id, candidate_profile_id, event_type)
      values (p_other, v_me, 'match_created');
  end if;

  return query select true, v_match_id;
end;
$$;

revoke all on function finalize_match(uuid) from public;
grant execute on function finalize_match(uuid) to authenticated;
