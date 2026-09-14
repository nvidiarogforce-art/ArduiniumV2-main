import 'server-only'

import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { hasSupabase } from '@/lib/supabase/config'
import type { ProfileRow, UserRole } from '@/lib/supabase/types'

export type Viewer = {
  id: string
  email: string | null
  profile: ProfileRow
}

/**
 * Who is asking, server-side. `null` means signed out — or no backend.
 *
 * `getUser()` rather than `getSession()`: the former re-validates the token
 * against the auth server, the latter trusts a cookie the browser handed us.
 * For a gate in front of a school's data that difference is the whole point.
 */
export async function getViewer(): Promise<Viewer | null> {
  const db = await supabaseServer()
  if (!db) return null

  /**
   * Never throws.
   *
   * `getUser()` makes a network call, and an auth-service outage or a
   * misconfigured URL would otherwise turn every gated page into a 500. Failing
   * to "signed out" is the safe direction: the reader gets the sign-in page,
   * which is recoverable, instead of an error page, which is not — and nothing
   * is granted by the failure, because the callers only ever widen access on a
   * viewer they actually got back.
   */
  try {
    const { data, error } = await db.auth.getUser()
    if (error || !data.user) return null

    const { data: profile } = await db
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle()

    if (!profile) return null
    return { id: data.user.id, email: data.user.email ?? null, profile }
  } catch {
    return null
  }
}

/** Gate a page on being signed in. Redirects, so it never returns null. */
export async function requireViewer(next: string): Promise<Viewer> {
  const viewer = await getViewer()
  if (!viewer) redirect(`/login?next=${encodeURIComponent(next)}`)
  return viewer
}

/**
 * Gate a page on a role.
 *
 * Route-level enforcement, per Phase 2 spec §4 — and only half the story. The
 * other half is that every query the page then makes is still RLS-filtered, so
 * this redirect is a courtesy to the reader rather than the security boundary.
 * Deleting it would make `/admin` render empty, not leak.
 */
export async function requireRole(role: UserRole, next: string): Promise<Viewer> {
  const viewer = await requireViewer(next)
  if (viewer.profile.role !== role) redirect('/learn')
  return viewer
}

export { hasSupabase }
