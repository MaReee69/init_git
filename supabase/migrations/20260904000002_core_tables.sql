-- updated_at自動更新用トリガー関数
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- profiles
-- =========================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  birthdate date,
  gender text not null default 'self_describe'
    check (gender in ('male', 'female', 'nonbinary', 'self_describe')),
  gender_self_describe text,
  bio text,
  conversation_style text
    check (conversation_style in ('text_first', 'voice_first', 'balanced')),
  area text,
  travel_distance_km int check (travel_distance_km between 1 and 200),
  budget_range text
    check (budget_range in ('low', 'mid', 'high')),
  age_verified_method text not null default 'self_declared',
  onboarding_completed_at timestamptz,
  terms_agreed_at timestamptz,
  privacy_agreed_at timestamptz,
  status text not null default 'active'
    check (status in ('active', 'deactivated', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_birthdate_min_age check (birthdate is null or birthdate <= (current_date - interval '18 years'))
);

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- =========================================================
-- dating_preferences
-- =========================================================
create table dating_preferences (
  profile_id uuid primary key references profiles(id) on delete cascade,
  seeking_gender text[] not null default '{}',
  relationship_intent text not null default 'undecided'
    check (relationship_intent in ('casual', 'serious', 'marriage_oriented', 'undecided')),
  age_min int not null default 18 check (age_min >= 18),
  age_max int not null default 99 check (age_max >= 18),
  date_style text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dating_preferences_age_range check (age_min <= age_max)
);

create trigger dating_preferences_set_updated_at
  before update on dating_preferences
  for each row execute function set_updated_at();

-- =========================================================
-- profile_answers
-- =========================================================
create table profile_answers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  question_key text not null,
  answer_text text,
  answer_choice text,
  created_at timestamptz not null default now(),
  unique (profile_id, question_key)
);

-- =========================================================
-- interests / profile_interests
-- =========================================================
create table interests (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label_ja text not null,
  category text
);

create table profile_interests (
  profile_id uuid not null references profiles(id) on delete cascade,
  interest_id uuid not null references interests(id) on delete cascade,
  primary key (profile_id, interest_id)
);

-- =========================================================
-- availability_slots
-- =========================================================
create table availability_slots (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  time_band text not null check (time_band in ('morning', 'afternoon', 'evening', 'night')),
  created_at timestamptz not null default now(),
  unique (profile_id, weekday, time_band)
);

-- =========================================================
-- photos
-- =========================================================
create table photos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  storage_path text not null,
  position smallint not null default 0,
  is_primary boolean not null default false,
  moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

-- =========================================================
-- likes
-- =========================================================
create table likes (
  id uuid primary key default gen_random_uuid(),
  from_profile_id uuid not null references profiles(id) on delete cascade,
  to_profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (from_profile_id, to_profile_id),
  constraint likes_no_self_like check (from_profile_id <> to_profile_id)
);

-- =========================================================
-- matches
-- =========================================================
create table matches (
  id uuid primary key default gen_random_uuid(),
  profile_id_a uuid not null references profiles(id) on delete cascade,
  profile_id_b uuid not null references profiles(id) on delete cascade,
  matched_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'unmatched')),
  unmatched_by uuid references profiles(id),
  unmatched_at timestamptz,
  constraint matches_ordered_pair check (profile_id_a < profile_id_b),
  unique (profile_id_a, profile_id_b)
);

-- =========================================================
-- messages
-- =========================================================
create table messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  content_type text not null default 'text' check (content_type in ('text', 'voice')),
  body text,
  voice_asset_id uuid,
  ai_mode text check (ai_mode in ('own_voice_cleanup', 'ai_draft', 'raw_voice_clip')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- =========================================================
-- voice_sessions / voice_turns / voice_assets
-- =========================================================
create table voice_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  purpose text not null check (purpose in ('onboarding', 'search', 'message', 'date_feedback')),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table voice_turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references voice_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  transcript text,
  confidence numeric check (confidence between 0 and 1),
  created_at timestamptz not null default now()
);

create table voice_assets (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references profiles(id) on delete cascade,
  storage_path text,
  purpose text not null check (purpose in ('profile_answer', 'message', 'onboarding')),
  retain_until timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table messages
  add constraint messages_voice_asset_fk foreign key (voice_asset_id) references voice_assets(id) on delete set null;

-- =========================================================
-- ai_preference_facts / ai_memory_consents
-- =========================================================
create table ai_preference_facts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  fact_key text not null,
  fact_value jsonb not null,
  source text not null check (source in ('voice_session', 'text_form')),
  source_session_id uuid references voice_sessions(id) on delete set null,
  created_at timestamptz not null default now()
);

create table ai_memory_consents (
  profile_id uuid primary key references profiles(id) on delete cascade,
  memory_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create trigger ai_memory_consents_set_updated_at
  before update on ai_memory_consents
  for each row execute function set_updated_at();

-- =========================================================
-- blocks / reports
-- =========================================================
create table blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  constraint blocks_no_self_block check (blocker_id <> blocked_id)
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles(id) on delete cascade,
  reported_id uuid not null references profiles(id) on delete cascade,
  match_id uuid references matches(id) on delete set null,
  reason_code text not null,
  detail text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'closed')),
  created_at timestamptz not null default now()
);

-- =========================================================
-- match_score_cache / recommendation_events
-- =========================================================
create table match_score_cache (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  candidate_profile_id uuid not null references profiles(id) on delete cascade,
  total_score numeric not null check (total_score between 0 and 100),
  feature_scores jsonb not null default '{}',
  reasons text[] not null default '{}',
  computed_at timestamptz not null default now(),
  unique (profile_id, candidate_profile_id)
);

create table recommendation_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  candidate_profile_id uuid references profiles(id) on delete set null,
  event_type text not null check (event_type in (
    'recommendation_impression', 'profile_opened', 'like_sent', 'pass', 'match_created',
    'first_message_sent', 'reply_received', 'date_proposal_created', 'date_proposal_accepted',
    'date_proposal_declined', 'date_completed', 'unmatch', 'block', 'report'
  )),
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- =========================================================
-- date_proposals / date_proposal_votes
-- =========================================================
create table date_proposals (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  created_by text not null check (created_by in ('ai', 'user')),
  options jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  confirmed_option_index int,
  created_at timestamptz not null default now()
);

create table date_proposal_votes (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references date_proposals(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  option_index int not null,
  vote text not null check (vote in ('want', 'change', 'other', 'skip')),
  created_at timestamptz not null default now(),
  unique (proposal_id, profile_id, option_index)
);

-- =========================================================
-- date_feedback / date_feedback_answers
-- =========================================================
create table date_feedback (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  want_to_meet_again boolean,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (match_id, profile_id)
);

create table date_feedback_answers (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references date_feedback(id) on delete cascade,
  question_key text not null,
  answer_text text,
  visibility text not null check (visibility in ('private', 'shareable', 'safety'))
);

-- =========================================================
-- moderation_actions（Phase4: 管理者ロールのみ利用）
-- =========================================================
create table moderation_actions (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('profile', 'photo', 'message', 'report')),
  target_id uuid not null,
  action text not null check (action in ('warn', 'hide', 'suspend', 'dismiss')),
  actor_admin_id uuid not null,
  note text,
  created_at timestamptz not null default now()
);
