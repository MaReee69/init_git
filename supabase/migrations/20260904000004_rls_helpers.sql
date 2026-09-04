-- RLSポリシーから共通利用する判定関数。
-- SECURITY DEFINERで実行し、参照先テーブル(matches/blocks)自体のRLSに再帰させず、
-- 戻り値はboolean（真偽）のみでデータそのものは返さない。

create or replace function is_matched_with(other_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from matches m
    where m.status = 'active'
      and (
        (m.profile_id_a = auth.uid() and m.profile_id_b = other_profile_id) or
        (m.profile_id_b = auth.uid() and m.profile_id_a = other_profile_id)
      )
  );
$$;

create or replace function is_blocked_between(profile_a uuid, profile_b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from blocks b
    where (b.blocker_id = profile_a and b.blocked_id = profile_b)
       or (b.blocker_id = profile_b and b.blocked_id = profile_a)
  );
$$;

create or replace function is_match_participant(target_match_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from matches m
    where m.id = target_match_id
      and (m.profile_id_a = auth.uid() or m.profile_id_b = auth.uid())
  );
$$;

revoke all on function is_matched_with(uuid) from public;
revoke all on function is_blocked_between(uuid, uuid) from public;
revoke all on function is_match_participant(uuid) from public;
grant execute on function is_matched_with(uuid) to authenticated;
grant execute on function is_blocked_between(uuid, uuid) to authenticated;
grant execute on function is_match_participant(uuid) to authenticated;
