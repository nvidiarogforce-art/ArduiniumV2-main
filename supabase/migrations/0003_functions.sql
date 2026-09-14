-- =============================================================================
-- ARDUINIUM — Phase 2 functions
-- =============================================================================
--   * the AI rate limiter (atomic, server-side)
--   * the admin panel's aggregate queries
--
-- The admin functions are SECURITY INVOKER (the default) on purpose: they run
-- as the caller, so the policies in 0002 still apply inside them. A teacher who
-- called admin_overview() would get their own tiny slice, not the school's —
-- the function cannot be used to step around RLS.
-- =============================================================================

-- ------------------------------------------------------------ rate limit ---

/**
 * Claim one AI message from today's allowance. Returns whether it was granted.
 *
 * Atomic by construction. The obvious implementation — SELECT the count, then
 * INSERT if it is under the limit — has a race that matters here, because the
 * thing being protected is an API bill: two requests arriving together both
 * read "9 of 10 used" and both proceed. The conditional upsert below does the
 * read and the increment in one statement, so exactly one of them wins.
 *
 * SECURITY DEFINER because `ai_usage_daily` has RLS on and no policies: a
 * client can neither read its own counter nor forge one, it can only ask this
 * function for a slot.
 */
create or replace function public.ai_rate_limit_take(p_limit integer)
returns table (allowed boolean, used integer, limit_n integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'utc')::date;
  new_used integer;
begin
  if uid is null then
    return query select false, 0, p_limit;
    return;
  end if;

  insert into public.ai_usage_daily as u (user_id, day, used)
  values (uid, today, 1)
  on conflict (user_id, day) do update
    set used = u.used + 1
    where u.used < p_limit
  returning u.used into new_used;

  if new_used is null then
    -- The row existed and the WHERE blocked the update: the allowance is spent.
    select u2.used into new_used
    from public.ai_usage_daily u2
    where u2.user_id = uid and u2.day = today;
    return query select false, coalesce(new_used, p_limit), p_limit;
    return;
  end if;

  return query select true, new_used, p_limit;
end;
$$;

/**
 * Hand a claimed slot back.
 *
 * Called when the model request itself fails. Without it, an upstream outage
 * silently eats a student's daily allowance for messages that never got an
 * answer — the kind of thing nobody notices until a class is mid-lesson.
 */
create or replace function public.ai_rate_limit_refund()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.ai_usage_daily
  set used = greatest(used - 1, 0)
  where user_id = auth.uid() and day = (now() at time zone 'utc')::date;
end;
$$;

-- --------------------------------------------------------- admin queries ---

/**
 * Headline numbers for /admin.
 *
 * Every figure is a real count against whatever is actually in the database.
 * If the school has three students, it says three — the dashboard is allowed
 * to look empty, and inventing a number here would make the whole panel
 * untrustworthy.
 */
create or replace function public.admin_overview()
returns json
language sql
stable
set search_path = public
as $$
  with scope as (select public.my_school() as school_id),
  people as (
    select role, count(*)::int as n
    from public.profiles, scope
    where profiles.school_id = scope.school_id
    group by role
  ),
  lesson_count as (select count(*)::int as n from public.lessons),
  students as (
    select p.id
    from public.profiles p, scope
    where p.school_id = scope.school_id and p.role = 'student'
  ),
  completions as (
    select count(*)::int as n
    from public.lesson_progress lp
    where lp.status = 'completed' and lp.student_id in (select id from students)
  )
  select json_build_object(
    'students',  coalesce((select n from people where role = 'student'), 0),
    'teachers',  coalesce((select n from people where role = 'teacher'), 0),
    'classes',   (select count(*)::int from public.classes c, scope where c.school_id = scope.school_id),
    'lessons',   (select n from lesson_count),
    'completions', (select n from completions),
    'completionRate', (
      case
        when (select count(*) from students) = 0 or (select n from lesson_count) = 0 then 0
        else round(
          100.0 * (select n from completions)
          / ((select count(*) from students) * (select n from lesson_count))
        )::int
      end
    )
  );
$$;

/**
 * Teacher activity level — NOT presence.
 *
 * This is an explicit product decision and the shape of the data enforces it:
 * the function returns the date of the most recent logged event and a coarse
 * bucket derived from it, and there is nothing here that could render as a
 * green dot. A teacher who has not opened the platform in three weeks is
 * someone the school might want to check in with; a teacher who is offline at
 * 14:32 on a Tuesday is a teacher who is teaching.
 */
create or replace function public.admin_teacher_activity()
returns table (
  teacher_id uuid,
  full_name text,
  last_active timestamptz,
  level text,
  class_count integer,
  student_count integer
)
language sql
stable
set search_path = public
as $$
  select
    p.id,
    p.full_name,
    a.last_active,
    case
      when a.last_active is null then 'never'
      when a.last_active > now() - interval '1 day' then 'today'
      when a.last_active > now() - interval '7 days' then 'week'
      when a.last_active > now() - interval '14 days' then 'fortnight'
      else 'dormant'
    end as level,
    coalesce(c.classes, 0)::int,
    coalesce(c.students, 0)::int
  from public.profiles p
  left join lateral (
    select max(l.occurred_at) as last_active
    from public.activity_log l
    where l.user_id = p.id
  ) a on true
  left join lateral (
    select
      count(distinct cl.id) as classes,
      count(distinct e.student_id) as students
    from public.classes cl
    left join public.class_enrollments e on e.class_id = cl.id
    where cl.teacher_id = p.id
  ) c on true
  where p.role = 'teacher'
    and p.school_id is not null
    and p.school_id = public.my_school()
  order by a.last_active asc nulls first;
$$;

/**
 * Class roster with aggregate progress. Aggregate is the whole point — there
 * is no per-student AI content here, and no query in this file can produce it.
 */
create or replace function public.class_roster(p_class_id uuid)
returns table (
  student_id uuid,
  full_name text,
  grade text,
  completed integer,
  total integer,
  last_active timestamptz
)
language sql
stable
set search_path = public
as $$
  select
    p.id,
    p.full_name,
    p.grade,
    coalesce((
      select count(*)::int from public.lesson_progress lp
      where lp.student_id = p.id and lp.status = 'completed'
    ), 0),
    (select count(*)::int from public.lessons),
    (select max(l.occurred_at) from public.activity_log l where l.user_id = p.id)
  from public.class_enrollments e
  join public.profiles p on p.id = e.student_id
  where e.class_id = p_class_id
  order by p.full_name;
$$;

grant execute on function public.ai_rate_limit_take(integer) to authenticated;
grant execute on function public.ai_rate_limit_refund() to authenticated;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_teacher_activity() to authenticated;
grant execute on function public.class_roster(uuid) to authenticated;
