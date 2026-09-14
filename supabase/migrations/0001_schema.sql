-- =============================================================================
-- ARDUINIUM — Phase 2 schema
-- =============================================================================
--
-- Matches Phase 2 spec §1.1. Run this first, then 0002_rls.sql, then
-- 0003_functions.sql. Every table gets RLS in 0002 — none of them are readable
-- by a bare authenticated user until a policy says so, which is deliberate:
-- this database holds records about children.
--
-- Apply with either:
--   supabase db push                    (Supabase CLI, linked project)
--   psql "$DATABASE_URL" -f <file>      (any Postgres client)
--   or paste into the SQL editor in the Supabase dashboard, in order.
-- =============================================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ enums ---

/**
 * All four roles the product knows about.
 *
 * The self-serve /register form offers only `student` and `teacher` — that is a
 * Phase 1 product decision (see lib/account.ts: school access is granted
 * separately rather than self-served, and buying is open to anyone). The enum
 * still carries `school_admin` and `buyer` because the *database* is where
 * those roles are assigned: by the seed script, or by a school admin who is
 * provisioned out of band. Keeping the enum wider than the signup form is the
 * point, not an oversight.
 */
do $$ begin
  create type public.user_role as enum ('student', 'teacher', 'school_admin', 'buyer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lesson_status as enum ('not_started', 'in_progress', 'completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.video_track as enum ('student', 'teacher');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.post_tag as enum ('question', 'idea', 'success');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ai_source as enum ('standalone', 'sandbox');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ai_message_role as enum ('user', 'assistant');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------- tables ---

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role public.user_role not null default 'student',
  school_id uuid references public.schools (id) on delete set null,
  locale text not null default 'uz',
  -- The remaining answers from the Phase 1 /register role forms. Explicit
  -- columns rather than a jsonb blob so the admin roster can group by them.
  grade text,
  subject text,
  experience text,
  school_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  teacher_id uuid references public.profiles (id) on delete set null,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.class_enrollments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (class_id, student_id)
);

/**
 * Lesson catalogue.
 *
 * The rich lesson *body* still lives in `lib/content/lessons.ts` as structured
 * blocks, because that is authored curriculum rather than user data and the
 * lesson page renders it as headings, lists, code and notes. What lives here is
 * the catalogue row: it gives `lesson_progress` a real foreign key to point at,
 * and it is what the admin completion-rate query counts against. `body_uz` /
 * `body_en` carry a flattened plain-text rendering so the table is meaningful
 * on its own (and so a future CMS has somewhere to write).
 */
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_uz text not null,
  title_en text not null,
  body_uz text not null default '',
  body_en text not null default '',
  order_index integer not null default 0,
  has_simulator boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  status public.lesson_status not null default 'not_started',
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (student_id, lesson_id)
);

create table if not exists public.video_lessons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_uz text not null,
  title_en text not null,
  track public.video_track not null default 'student',
  video_url text,
  duration_seconds integer not null default 0,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

/**
 * Community feed.
 *
 * `author_name` and `author_role` are denormalised on purpose, and the reason
 * is the privacy table in 0002 rather than performance. Posts are readable by
 * everyone; profiles are not — a student may read their own row and nobody
 * else's. Joining the feed to `profiles` for a display name would therefore
 * either return nulls or force a policy that lets every child read every other
 * child's record. Copying the name at write time keeps the feed working and the
 * profile table shut, and it is also the more honest datum: it is the name the
 * author was posting under at the time.
 */
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  author_name text not null default '',
  author_role public.user_role not null default 'student',
  title text not null,
  body text not null,
  tag public.post_tag not null default 'question',
  created_at timestamptz not null default now()
);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  context_lesson_id uuid references public.lessons (id) on delete set null,
  source public.ai_source not null default 'standalone',
  title text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  role public.ai_message_role not null,
  content text not null,
  created_at timestamptz not null default now()
);

/**
 * Non-content activity signal.
 *
 * This is the ONLY thing a teacher or school admin ever sees about a student's
 * use of the AI assistant: that it happened, and when. `ai_messages.content` is
 * unreadable to them by policy (see 0002_rls.sql) and there is deliberately no
 * feature anywhere in the product that would surface it.
 */
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_type text not null,
  occurred_at timestamptz not null default now()
);

/**
 * Per-user, per-day counter backing the /api/ai/chat rate limit.
 *
 * A counter table rather than a COUNT over ai_messages: the check runs on every
 * request, and it must be atomic so two concurrent requests cannot both read
 * "9 of 10 used" and both proceed. See `ai_rate_limit_take()` in 0003.
 */
create table if not exists public.ai_usage_daily (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  used integer not null default 0,
  primary key (user_id, day)
);

-- ---------------------------------------------------------------- indexes ---

create index if not exists profiles_school_idx on public.profiles (school_id);
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists classes_school_idx on public.classes (school_id);
create index if not exists classes_teacher_idx on public.classes (teacher_id);
create index if not exists enrollments_class_idx on public.class_enrollments (class_id);
create index if not exists enrollments_student_idx on public.class_enrollments (student_id);
create index if not exists lesson_progress_student_idx on public.lesson_progress (student_id);
create index if not exists lesson_progress_lesson_idx on public.lesson_progress (lesson_id);
create index if not exists community_posts_created_idx on public.community_posts (created_at desc);
create index if not exists ai_conversations_user_idx on public.ai_conversations (user_id, created_at desc);
create index if not exists ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at);
create index if not exists activity_log_user_idx on public.activity_log (user_id, occurred_at desc);

-- --------------------------------------------------------------- triggers ---

/**
 * Create the profile row when Supabase Auth creates the user.
 *
 * Doing this in the database rather than in the client after signUp closes two
 * holes at once: a user cannot end up authenticated with no profile because a
 * second request failed, and a user cannot choose their own `role` — the
 * function only honours 'student' or 'teacher' from the signup metadata and
 * falls back to 'student' for anything else. `school_admin` is assigned by the
 * seed script or by an existing admin, never by signing up.
 */
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested text := coalesce(new.raw_user_meta_data ->> 'role', 'student');
begin
  insert into public.profiles (id, full_name, role, locale, grade, subject, experience, school_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    (case when requested in ('student', 'teacher') then requested else 'student' end)::public.user_role,
    coalesce(new.raw_user_meta_data ->> 'locale', 'uz'),
    new.raw_user_meta_data ->> 'grade',
    new.raw_user_meta_data ->> 'subject',
    new.raw_user_meta_data ->> 'experience',
    new.raw_user_meta_data ->> 'school_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

/**
 * A user may edit their own profile, but not their own privileges.
 *
 * Without this, the "update own profile" policy in 0002 is a role-escalation
 * hole: any student could PATCH their row to role = 'school_admin' and every
 * school-wide policy would then let them in. The guard runs for normal clients
 * only — the service role (the seed script, an admin tool) bypasses it, which
 * is how a role is legitimately assigned.
 */
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- `nullif` before the cast: the setting is absent on a direct psql
  -- connection (NULL) but can also be present-and-empty depending on how the
  -- connection was opened, and `''::jsonb` raises rather than returning null.
  claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
begin
  if claims ->> 'role' is null then
    return new; -- direct psql / service connection, no PostgREST claims
  end if;
  if claims ->> 'role' = 'service_role' then
    return new;
  end if;
  if new.role is distinct from old.role then
    raise exception 'role cannot be changed by its owner';
  end if;
  if new.school_id is distinct from old.school_id then
    raise exception 'school_id cannot be changed by its owner';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_privileges on public.profiles;
create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

create or replace function public.touch_lesson_progress()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.status = 'completed' and new.completed_at is null then
    new.completed_at := now();
  elsif new.status <> 'completed' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists lesson_progress_touch on public.lesson_progress;
create trigger lesson_progress_touch
  before insert or update on public.lesson_progress
  for each row execute function public.touch_lesson_progress();
