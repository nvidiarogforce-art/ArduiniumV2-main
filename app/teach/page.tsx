import { TeachStub } from '@/components/teach/teach-stub'
import { TeacherDashboard } from '@/components/teach/dashboard'
import type { ClassBlock, RosterEntry } from '@/components/admin/dashboard'
import { getViewer, hasSupabase } from '@/lib/auth/session'
import { supabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * `/teach` — two pages behind one route.
 *
 * A signed-in teacher gets their real classes (spec §4.3). Everybody else —
 * signed out, a student, or a clone with no backend — gets the Phase 1 landing,
 * which is still the truthful thing to show them. That is why this route is not
 * gated with a redirect the way `/admin` is: it has something honest to say to
 * a visitor, and `/admin` does not.
 */
export default async function TeachPage() {
  if (!hasSupabase) return <TeachStub />

  const viewer = await getViewer()
  if (!viewer || viewer.profile.role !== 'teacher') return <TeachStub />

  const db = await supabaseServer()
  if (!db) return <TeachStub />

  // RLS returns only classes this teacher teaches, so there is no
  // `.eq('teacher_id', …)` here — adding one would imply the filter is what
  // makes it safe, and it is not.
  const { data: classRows } = await db.from('classes').select('id, name').order('name')

  const rows = classRows ?? []
  const rosters = await Promise.all(rows.map((c) => db.rpc('class_roster', { p_class_id: c.id })))

  const classes: ClassBlock[] = rows.map((c, i) => ({
    id: c.id,
    name: c.name,
    teacher: null,
    roster: ((rosters[i].data as RosterEntry[] | null) ?? []).slice(0, 60),
  }))

  return <TeacherDashboard name={viewer.profile.full_name} classes={classes} />
}
