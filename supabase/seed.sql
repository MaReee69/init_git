-- ローカル開発用シードデータ。
-- `supabase db reset` または `psql` で適用する。本番環境には絶対に適用しないこと。

-- =========================================================
-- interests マスタ（src/lib/backend/mock/store.ts の DEFAULT_INTERESTS と同じキーで揃える）
-- =========================================================
insert into interests (key, label_ja, category) values
  ('movie', '映画', 'culture'),
  ('travel', '旅行', 'lifestyle'),
  ('cafe', 'カフェ巡り', 'lifestyle'),
  ('cooking', '料理', 'lifestyle'),
  ('music_live', '音楽・ライブ', 'culture'),
  ('outdoor', 'アウトドア', 'activity'),
  ('fitness', '筋トレ・運動', 'activity'),
  ('reading', '読書', 'culture'),
  ('art_museum', '美術館・展示', 'culture'),
  ('gaming', 'ゲーム', 'entertainment'),
  ('pets', 'ペット', 'lifestyle'),
  ('sake_wine', 'お酒・ワイン', 'lifestyle')
on conflict (key) do nothing;

-- =========================================================
-- サンプルユーザー（ローカル開発専用のダミーアカウント）
-- auth.users への直接INSERTはローカルSupabase(Postgres)でのみ想定。
-- パスワードは全て "password1234"（bcryptハッシュはローカル検証用の固定値）。
-- =========================================================
do $$
declare
  v_user_id uuid;
  v_email text;
  v_display_name text;
  v_birthdate date;
  v_gender text;
  v_seeking text[];
  v_intent text;
  v_bio text;
  v_area text;
  seed_users jsonb := '[
    {"email": "seed.aoi@example.com", "display_name": "あおい", "birthdate": "1996-04-12", "gender": "female", "seeking": ["male"], "intent": "serious", "bio": "休日はカフェ巡りと映画鑑賞が好きです。まずは気軽にお話しできたら嬉しいです。", "area": "東京都渋谷区"},
    {"email": "seed.ren@example.com", "display_name": "れん", "birthdate": "1994-08-03", "gender": "male", "seeking": ["female"], "intent": "marriage_oriented", "bio": "平日夜か週末に会えます。料理と旅行が趣味で、将来のことも見据えて出会いたいです。", "area": "東京都新宿区"},
    {"email": "seed.hina@example.com", "display_name": "ひな", "birthdate": "1999-01-20", "gender": "female", "seeking": ["male", "nonbinary"], "intent": "casual", "bio": "音楽ライブと読書が好き。まずは気軽に会える人を探しています。", "area": "神奈川県横浜市"},
    {"email": "seed.sho@example.com", "display_name": "しょう", "birthdate": "1992-11-09", "gender": "male", "seeking": ["female"], "intent": "serious", "bio": "アウトドアと筋トレが趣味です。休日にゆっくり出かけられる相手がいいです。", "area": "東京都世田谷区"},
    {"email": "seed.yui@example.com", "display_name": "ゆい", "birthdate": "1997-06-30", "gender": "female", "seeking": ["male"], "intent": "undecided", "bio": "美術館巡りとお酒が好きです。まずはお茶しながらお話ししたいです。", "area": "東京都港区"}
  ]';
  u jsonb;
begin
  for u in select * from jsonb_array_elements(seed_users)
  loop
    v_email := u->>'email';
    v_display_name := u->>'display_name';
    v_birthdate := (u->>'birthdate')::date;
    v_gender := u->>'gender';
    select array(select jsonb_array_elements_text(u->'seeking')) into v_seeking;
    v_intent := u->>'intent';
    v_bio := u->>'bio';
    v_area := u->>'area';

    select id into v_user_id from auth.users where email = v_email;

    if v_user_id is null then
      v_user_id := gen_random_uuid();
      insert into auth.users (
        id, instance_id, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, aud, role
      ) values (
        v_user_id, '00000000-0000-0000-0000-000000000000', v_email,
        crypt('password1234', gen_salt('bf')), now(), now(), now(), 'authenticated', 'authenticated'
      );
    end if;

    insert into profiles (
      id, display_name, birthdate, gender, bio, area, conversation_style,
      travel_distance_km, budget_range, onboarding_completed_at, terms_agreed_at, privacy_agreed_at
    ) values (
      v_user_id, v_display_name, v_birthdate, v_gender, v_bio, v_area, 'balanced',
      20, 'mid', now(), now(), now()
    )
    on conflict (id) do nothing;

    insert into dating_preferences (profile_id, seeking_gender, relationship_intent, age_min, age_max)
    values (v_user_id, v_seeking, v_intent, 22, 40)
    on conflict (profile_id) do nothing;

    insert into availability_slots (profile_id, weekday, time_band)
    values (v_user_id, 6, 'afternoon'), (v_user_id, 0, 'afternoon')
    on conflict do nothing;
  end loop;
end $$;
