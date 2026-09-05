-- RLS / 権限の自動検証スクリプト。
-- 前提: _local_test_setup.sql と supabase/migrations/*.sql を適用済みのDBに対し、
-- postgres（スーパーユーザー）で接続して実行する。
-- SET ROLE authenticated + request.jwt.claims でなりすまし、各ユーザーの視点でRLSを検証する。
-- 実行方法や結果は docs/security.md および README を参照。

-- ===== テストヘルパー =====

create or replace function test_assert(cond boolean, label text) returns void
language plpgsql as $$
begin
  if cond then
    raise notice 'PASS: %', label;
  else
    raise warning 'FAIL: %', label;
  end if;
end;
$$;

create or replace function test_expect_error(p_sql text, p_label text) returns void
language plpgsql as $$
begin
  execute p_sql;
  raise warning 'FAIL: % (エラーになるべき操作が成功してしまった)', p_label;
exception when others then
  raise notice 'PASS: % (正しく拒否された: %)', p_label, sqlerrm;
end;
$$;

create or replace function test_expect_success(p_sql text, p_label text) returns void
language plpgsql as $$
begin
  execute p_sql;
  raise notice 'PASS: %', p_label;
exception when others then
  raise warning 'FAIL: % (想定外のエラー: %)', p_label, sqlerrm;
end;
$$;

create table if not exists test_ids (name text primary key, id uuid not null);
grant select, insert, update on test_ids to authenticated, anon;

create or replace function test_as(p_name text) returns void language plpgsql as $$
declare
  v_id uuid;
begin
  reset role;
  select id into v_id from test_ids where name = p_name;
  if v_id is null then
    raise exception 'unknown test user: %', p_name;
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_id, 'role', 'authenticated')::text, false);
  set role authenticated;
end;
$$;

create or replace function test_as_admin() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', false);
end;
$$;

grant execute on all functions in schema public to authenticated, anon;

-- ===== テストデータ =====

insert into auth.users (id, email) values
  (gen_random_uuid(), 'alice@test.local'),
  (gen_random_uuid(), 'bob@test.local'),
  (gen_random_uuid(), 'erin@test.local'),
  (gen_random_uuid(), 'dave@test.local')
on conflict do nothing;

insert into test_ids (name, id)
select split_part(email, '@', 1), id from auth.users
where email in ('alice@test.local', 'bob@test.local', 'erin@test.local', 'dave@test.local')
on conflict (name) do update set id = excluded.id;

-- alice: 女性、男性希望、serious、渋谷
select test_as('alice');
insert into profiles (id, display_name, birthdate, gender, area, travel_distance_km, conversation_style, onboarding_completed_at, terms_agreed_at, privacy_agreed_at)
values ((select id from test_ids where name = 'alice'), 'あおい', '1995-06-15', 'female', '東京都渋谷区', 20, 'balanced', now(), now(), now());
insert into dating_preferences (profile_id, seeking_gender, relationship_intent, age_min, age_max)
values ((select id from test_ids where name = 'alice'), array['male'], 'serious', 25, 40);

-- bob: 男性、女性希望、serious、渋谷 → aliceと相互条件を満たす
select test_as('bob');
insert into profiles (id, display_name, birthdate, gender, area, travel_distance_km, conversation_style, onboarding_completed_at, terms_agreed_at, privacy_agreed_at)
values ((select id from test_ids where name = 'bob'), 'れん', '1993-06-15', 'male', '東京都渋谷区', 20, 'balanced', now(), now(), now());
insert into dating_preferences (profile_id, seeking_gender, relationship_intent, age_min, age_max)
values ((select id from test_ids where name = 'bob'), array['female'], 'serious', 25, 40);

-- erin: 男性、女性希望、serious、渋谷 → aliceの候補になり得るが後でブロックする
select test_as('erin');
insert into profiles (id, display_name, birthdate, gender, area, travel_distance_km, conversation_style, onboarding_completed_at, terms_agreed_at, privacy_agreed_at)
values ((select id from test_ids where name = 'erin'), 'えりん', '1994-06-15', 'male', '東京都渋谷区', 20, 'balanced', now(), now(), now());
insert into dating_preferences (profile_id, seeking_gender, relationship_intent, age_min, age_max)
values ((select id from test_ids where name = 'erin'), array['female'], 'serious', 25, 40);

-- dave: 男性、女性希望、marriage_oriented、大阪（遠方・移動距離小） → 距離条件で除外される想定
select test_as('dave');
insert into profiles (id, display_name, birthdate, gender, area, travel_distance_km, onboarding_completed_at, terms_agreed_at, privacy_agreed_at)
values ((select id from test_ids where name = 'dave'), 'しょう', '1990-01-01', 'male', '大阪府大阪市', 5, now(), now(), now());
insert into dating_preferences (profile_id, seeking_gender, relationship_intent, age_min, age_max)
values ((select id from test_ids where name = 'dave'), array['female'], 'marriage_oriented', 20, 45);

-- ===== 1. profilesの直接可視性 =====

select test_as('dave');
select test_assert(
  (select count(*) from profiles where id = (select id from test_ids where name = 'alice')) = 0,
  '1-1: マッチ前はdaveがaliceのprofilesを直接SELECTできない'
);
select test_assert(
  (select count(*) from profiles where id = (select id from test_ids where name = 'dave')) = 1,
  '1-2: 本人は自分のprofilesを見える'
);

-- RLSのUSING句に一致しない行はUPDATE対象から静かに除外される（エラーにはならず0件更新になる）。
-- そのためエラーの有無ではなく、実際にデータが変更されていないことを確認する。
select test_expect_success(
  format('update profiles set display_name = %L where id = %L', '乗っ取り', (select id from test_ids where name = 'alice')),
  '1-3a: UPDATE文自体はエラーにならない（RLSは対象行を0件に絞り込む）'
);
select test_as_admin();
select test_assert(
  (select display_name from profiles where id = (select id from test_ids where name = 'alice')) = 'あおい',
  '1-3b: daveのUPDATEはRLSにより実際には反映されず、aliceのdisplay_nameは変化していない'
);

-- ===== 2. get_candidate_pool のハード条件 =====

select test_as('alice');
select test_assert(
  exists(select 1 from get_candidate_pool() where candidate_id = (select id from test_ids where name = 'bob')),
  '2-1: get_candidate_pool: 相互条件を満たすbobが候補に含まれる'
);
select test_assert(
  not exists(select 1 from get_candidate_pool() where candidate_id = (select id from test_ids where name = 'dave')),
  '2-2: get_candidate_pool: 距離条件を満たさないdaveは候補に含まれない'
);
select test_assert(
  not exists(select 1 from get_candidate_pool() where candidate_id = (select id from test_ids where name = 'alice')),
  '2-3: get_candidate_pool: 自分自身は候補に含まれない'
);

-- ===== 3. ブロックすると候補・可視性から除外される =====

select test_as('alice');
insert into blocks (blocker_id, blocked_id)
values ((select id from test_ids where name = 'alice'), (select id from test_ids where name = 'erin'));

select test_assert(
  not exists(select 1 from get_candidate_pool() where candidate_id = (select id from test_ids where name = 'erin')),
  '3-1: aliceがブロックしたerinはget_candidate_poolから除外される'
);

select test_as('erin');
select test_assert(
  not exists(select 1 from get_candidate_pool() where candidate_id = (select id from test_ids where name = 'alice')),
  '3-2: ブロック関係は双方向に効く（erin視点でもaliceが除外される）'
);

-- ===== 4. いいね・相互マッチ =====

select test_as('alice');
select test_expect_success(
  format('select finalize_match(%L)', (select id from test_ids where name = 'bob')),
  '4-1: finalize_matchの呼び出し自体は成功する（この時点ではmatched=false）'
);
insert into likes (from_profile_id, to_profile_id)
values ((select id from test_ids where name = 'alice'), (select id from test_ids where name = 'bob'));

select test_as('bob');
select test_assert(
  (select count(*) from likes where to_profile_id = (select id from test_ids where name = 'bob') and from_profile_id <> (select id from test_ids where name = 'bob')) = 0,
  '4-2: 自分宛のlike(受信)は直接SELECTできない（相互マッチまで非公開）'
);
insert into likes (from_profile_id, to_profile_id)
values ((select id from test_ids where name = 'bob'), (select id from test_ids where name = 'alice'));

select test_expect_error(
  format('insert into matches (profile_id_a, profile_id_b) values (%L, %L)',
    least((select id from test_ids where name = 'alice'), (select id from test_ids where name = 'bob')),
    greatest((select id from test_ids where name = 'alice'), (select id from test_ids where name = 'bob'))
  ),
  '4-3: matchesへの直接INSERTはクライアントから許可されない（finalize_match経由のみ）'
);

select finalize_match((select id from test_ids where name = 'alice'));

select test_assert(
  exists(
    select 1 from matches
    where status = 'active'
      and (profile_id_a = (select id from test_ids where name = 'bob') or profile_id_b = (select id from test_ids where name = 'bob'))
      and (profile_id_a = (select id from test_ids where name = 'alice') or profile_id_b = (select id from test_ids where name = 'alice'))
  ),
  '4-4: finalize_match経由でbob<->aliceのmatchesが作成される'
);

select test_as('alice');
select test_assert(
  (select count(*) from profiles where id = (select id from test_ids where name = 'bob')) = 1,
  '4-5: マッチ成立後はbobのprofilesをaliceが直接SELECTできる'
);

-- ===== 5. recommendation_eventsは本人分のみ =====

select test_as('dave');
select test_expect_error(
  format('insert into recommendation_events (profile_id, candidate_profile_id, event_type) values (%L, %L, %L)',
    (select id from test_ids where name = 'alice'), (select id from test_ids where name = 'bob'), 'like_sent'),
  '5-1: daveが他人(alice)になりすましてrecommendation_eventsをINSERTできない'
);
select test_expect_success(
  format('insert into recommendation_events (profile_id, candidate_profile_id, event_type) values (%L, %L, %L)',
    (select id from test_ids where name = 'dave'), (select id from test_ids where name = 'alice'), 'pass'),
  '5-2: 自分自身の分のrecommendation_eventsは記録できる'
);

-- ===== 6. moderation_actionsは一般ユーザーから不可視 =====

select test_as('alice');
select test_assert(
  (select count(*) from moderation_actions) = 0,
  '6-1: moderation_actionsはauthenticatedからSELECTしても常に0件（ポリシー未定義=デフォルト拒否）'
);
select test_expect_error(
  format('insert into moderation_actions (target_type, target_id, action, actor_admin_id) values (%L, %L, %L, %L)',
    'profile', (select id from test_ids where name = 'bob'), 'warn', (select id from test_ids where name = 'alice')),
  '6-2: moderation_actionsへの一般ユーザーによるINSERTは拒否される'
);

-- ===== 7. 未認証(anon)は何も見えない =====

reset role;
select set_config('request.jwt.claims', '', false);
set role anon;
select test_assert(
  (select count(*) from profiles) = 0,
  '7-1: 未認証(anon)はprofilesを一切参照できない'
);

reset role;
