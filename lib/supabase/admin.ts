import 'server-only'

import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_URL, hasSupabase } from './config'
import type { Database } from './types'

/**
 * The service-role client: bypasses every RLS policy.
 *
 * `import 'server-only'` makes importing this from a Client Component a build
 * error rather than a leaked key. Use it for exactly one thing — writing rows
 * the signed-in user is not allowed to write on their own behalf (the
 * assistant's transcript, the activity log) — and never for reading data back
 * to a user, because at that point the policies in 0002 are no longer what
 * decides who sees what.
 *
 * Everything else, including all of `/admin`, goes through `supabaseServer()`.
 */
export function supabaseAdmin(): SupabaseClient<Database> | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!hasSupabase || !key) return null
  return createClient<Database>(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
