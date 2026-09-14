-- =============================================================================
-- ARDUINIUM — Phase 2 row-level security
-- =============================================================================
--
-- This file IS the access-control table from Phase 2 spec §2, expressed the
-- only place it can actually be enforced. The admin panel and the /ai route
-- also check the role before rendering, but that is UI convenience — the
-- guarantee lives here, so a hand-rolled fetch with a stolen anon key still
-- cannot read another school's children.
--
-- | data                          | student   | teacher        | school admin |
-- |-------------------------------|-----------|----------------|--------------|
-- | own profile, own progress     | rw own    | —              | —            |
-- | progress of their students    | —         | read           | read (school)|
-- | community_posts               | read all, write own (every role)          |
-- | ai_messages                   | read own  | NEVER          | NEVER        |
-- | activity_log (aggregate only) | own       | own classes    | school-wide  |
-- | classes / enrollments         | read own  | rw own classes | rw in school |
--
-- The `ai_messages` row is the one to read twice. Most of this app's users are
-- minors; a student's conversation with the assistant is theirs. There is no
-- teacher policy and no admin policy on that table, so "read student chat logs"
-- is not a feature someone can add later by writing a query — they would have
-- to come here first and write the policy that permits it.
-- =============================================================================

-- ---------------------------------------------------------------- helpers ---

/**
 * SECURITY DEFINER, every one of them, and that is load-bearing.
 *
 * A policy on `profiles` that itself selects from `profiles` recurses and
 * Postgres aborts the query. Reading the caller's own role through a definer
 * function steps outside RLS for that one lookup, which is what breaks the
 * cycle. `set search_path` pins the schema so the definer privilege cannot be
 * redirected at a shadowed table.
 */
create or replace function public.my_role()
returns public.user_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.my_school()
returns uuid
language sql stable security definer set search_path = public
as $$ select school_id from public.profiles where id = auth.uid() $$;

create or replace function public.is_school_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.my_role() = 'school_admin', false) $$;

create or replace function public.is_teacher()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.my_role() = 'teacher', false) $$;

/** Does the caller teach a class this student is enrolled in? */
create or replace function public.teaches_student(student uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.class_enrollments e
    join public.classes c on c.id = e.class_id
    where e.student_id = student and c.teacher_id = auth.uid()
  )
$$;

/** Is this person in the caller's school? (school admins only ask this.) */
create or replace function public.in_my_school(person uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = person
      and p.school_id is not null
      and p.school_id = public.my_school()
  )
$$;

/** Is the caller enrolled in this class? */
create or replace function public.enrolled_in(class uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.class_enrollments e
    where e.class_id = class and e.student_id = auth.uid()
  )
$$;

-- ----------------------------------------------------------- enable + drop ---

alter table public.schools            enable row level security;
alter table public.profiles           enable row level security;
alter table public.classes            enable row level security;
alter table public.class_enrollments  enable row level security;
alter table public.lessons            enable row level security;
alter table public.lesson_progress    enable row level security;
alter table public.video_lessons      enable row level security;
alter table public.community_posts    enable row level security;
alter table public.ai_conversations   enable row level security;
alter table public.ai_messages        enable row level security;
alter table public.activity_log       enable row level security;
alter table public.ai_usage_daily     enable row level security;

-- Idempotent re-runs: drop anything this file previously created.
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'schools','profiles','classes','class_enrollments','lessons',
        'lesson_progress','video_lessons','community_posts',
        'ai_conversations','ai_messages','activity_log','ai_usage_daily')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------- schools ---

-- A school's name is not sensitive and the roster UI needs it. Writes are
-- service-role only (the seed script), so no insert/update/delete policy.
create policy schools_read on public.schools
  for select to authenticated using (true);

-- --------------------------------------------------------------- profiles ---

create policy profiles_read_own on public.profiles
  for select to authenticated using (id = auth.uid());

create policy profiles_read_own_students on public.profiles
  for select to authenticated using (public.is_teacher() and public.teaches_student(id));

create policy profiles_read_school on public.profiles
  for select to authenticated
  using (public.is_school_admin() and school_id is not null and school_id = public.my_school());

-- `role` and `school_id` are pinned by the guard trigger in 0001, so this is
-- "edit your name and language", not "edit your privileges".
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- No insert policy: the row is created by handle_new_user() on signup.
-- No delete policy: deleting the auth user cascades.

-- ---------------------------------------------------------------- classes ---

create policy classes_read_enrolled on public.classes
  for select to authenticated using (public.enrolled_in(id));

create policy classes_read_own_teaching on public.classes
  for select to authenticated using (teacher_id = auth.uid());

create policy classes_write_own_teaching on public.classes
  for all to authenticated
  using (public.is_teacher() and teacher_id = auth.uid())
  with check (public.is_teacher() and teacher_id = auth.uid());

create policy classes_admin_school on public.classes
  for all to authenticated
  using (public.is_school_admin() and school_id = public.my_school())
  with check (public.is_school_admin() and school_id = public.my_school());

-- ------------------------------------------------------- class_enrollments ---

create policy enrollments_read_own on public.class_enrollments
  for select to authenticated using (student_id = auth.uid());

create policy enrollments_teacher_own_classes on public.class_enrollments
  for all to authenticated
  using (
    public.is_teacher()
    and exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid())
  )
  with check (
    public.is_teacher()
    and exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid())
  );

create policy enrollments_admin_school on public.class_enrollments
  for all to authenticated
  using (
    public.is_school_admin()
    and exists (select 1 from public.classes c where c.id = class_id and c.school_id = public.my_school())
  )
  with check (
    public.is_school_admin()
    and exists (select 1 from public.classes c where c.id = class_id and c.school_id = public.my_school())
  );

-- ------------------------------------------------------ lessons and videos ---

-- Curriculum is public content: readable signed-out so the marketing pages and
-- the lesson catalogue work before anyone registers. Writes are service-role.
create policy lessons_read on public.lessons
  for select to anon, authenticated using (true);

create policy video_lessons_read on public.video_lessons
  for select to anon, authenticated using (true);

-- -------------------------------------------------------- lesson_progress ---

create policy progress_own on public.lesson_progress
  for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());

create policy progress_read_own_students on public.lesson_progress
  for select to authenticated
  using (public.is_teacher() and public.teaches_student(student_id));

create policy progress_read_school on public.lesson_progress
  for select to authenticated
  using (public.is_school_admin() and public.in_my_school(student_id));

-- -------------------------------------------------------- community_posts ---

create policy posts_read_all on public.community_posts
  for select to anon, authenticated using (true);

create policy posts_write_own on public.community_posts
  for insert to authenticated with check (author_id = auth.uid());

create policy posts_update_own on public.community_posts
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy posts_delete_own on public.community_posts
  for delete to authenticated using (author_id = auth.uid());

-- ------------------------------------------------- ai (own eyes only) ------

create policy ai_conversations_own on public.ai_conversations
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy ai_messages_own on public.ai_messages
  for all to authenticated
  using (
    exists (
      select 1 from public.ai_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.ai_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

-- Deliberately absent: any teacher or school-admin policy on the two tables
-- above. See the header.

-- ----------------------------------------------------------- activity_log ---

create policy activity_read_own on public.activity_log
  for select to authenticated using (user_id = auth.uid());

create policy activity_insert_own on public.activity_log
  for insert to authenticated with check (user_id = auth.uid());

create policy activity_read_own_students on public.activity_log
  for select to authenticated
  using (public.is_teacher() and public.teaches_student(user_id));

create policy activity_read_school on public.activity_log
  for select to authenticated
  using (public.is_school_admin() and public.in_my_school(user_id));

-- --------------------------------------------------------- ai_usage_daily ---

-- No policies at all. RLS is on, so every normal client is denied; the counter
-- is touched only through `ai_rate_limit_take()`, which is SECURITY DEFINER.
