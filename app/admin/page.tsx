import type { Metadata } from 'next'
import {
  AdminDashboard,
  type ClassBlock,
  type Overview,
  type RosterEntry,
  type TeacherRow,
} from '@/components/admin/dashboard'
import { NotConfigured } from '@/components/site/not-configured'
import { requireRole, hasSupabase } from '@/lib/auth/session'
import { supabaseServer } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Maktab paneli' }
export const dynamic = 'force-dynamic'

const EMPTY: Overview = {
  students: 0,
  teachers: 0,
  classes: 0,
  lessons: 0,
  completions: 0,
  completionRate: 0,
}

/**
 * `/admin` — gated twice over (spec §4).
 *
 * `requireRole` redirects anyone who is not a school admin, and every query
 * below still runs through the user's own RLS-filtered client. Neither gate is
 * decorative: remove the redirect and a teacher reaching this URL sees an empty
 * dashboard, because the policies return them nothing. That is the property
 * worth having — the UI check is for the reader, the policies are the security.
 */
export default async function Page() {
  if (!hasSupabase) return <NotConfigured />

  const viewer = await requireRole('school_admin', '/admin')
  const db = await supabaseServer()
  if (!db) return <NotConfigured />

  const [overviewRes, activityRes, classesRes, schoolRes] = await Promise.all([
    db.rpc('admin_overview'),
    db.rpc('admin_teacher_activity'),
    db.from('classes').select('id, name, teacher_id').order('name'),
    viewer.profile.school_id
      ? db.from('schools').select('name').eq('id', viewer.profile.school_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  const overview = (overviewRes.data as Overview | null) ?? EMPTY
  const teachers = (activityRes.data as TeacherRow[] | null) ?? []
  const teacherName = new Map(teachers.map((x) => [x.teacher_id, x.full_name]))

  // One roster query per class, run together. A school has classes in the
  // dozens, not the thousands, so this is a fan-out rather than an N+1 problem;
  // if that ever changes it becomes one function returning every roster.
  const classRows = classesRes.data ?? []
  const rosters = await Promise.all(
    classRows.map((c) => db.rpc('class_roster', { p_class_id: c.id })),
  )

  const classes: ClassBlock[] = classRows.map((c, i) => ({
    id: c.id,
    name: c.name,
    teacher: c.teacher_id ? (teacherName.get(c.teacher_id) ?? null) : null,
    roster: ((rosters[i].data as RosterEntry[] | null) ?? []).slice(0, 60),
  }))

  return (
    <AdminDashboard
      schoolName={schoolRes.data?.name ?? viewer.profile.school_name ?? '—'}
      overview={overview}
      teachers={teachers}
      classes={classes}
    />
  )
}
