-- ローカルの素のPostgreSQL上でRLSを検証するためのテスト専用セットアップ。
-- 実際のSupabaseプロジェクトでは auth スキーマ・ロール・権限はプラットフォームが提供するため、
-- このファイルを本番/実Supabaseへ適用してはいけない（supabase/migrationsには含めない）。

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

-- 実SupabaseのGoTrueが提供するauth.uid()/auth.role()と同等の実装。
-- テストではセッションごとに request.jwt.claims を SET し、対象ユーザーになりすます。
create or replace function auth.uid() returns uuid
  language sql stable
  as $$
    select nullif(nullif(current_setting('request.jwt.claims', true), '')::json->>'sub', '')::uuid
  $$;

create or replace function auth.role() returns text
  language sql stable
  as $$
    select nullif(nullif(current_setting('request.jwt.claims', true), '')::json->>'role', '')::text
  $$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;
grant select on all tables in schema auth to anon, authenticated;
-- 実Supabaseのデフォルト権限に合わせ、テーブル権限を付与する（行レベルの制御はRLSポリシー側で行う）
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant usage on all sequences in schema public to authenticated;
