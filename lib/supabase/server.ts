import 'server-only'

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabase } from './config'
import type { Database } from './types'

export type Db = SupabaseClient<Database>

/**
 * A request-scoped client that carries the signed-in user's session.
 *
 * Every read it performs is still filtered by RLS — this is the anon key plus
 * the user's cookie, not a privileged connection. That is deliberate: the admin
 * panel's queries go through here, so "hid the UI" and "cannot read the data"
 * are the same statement.
 *
 * The `setAll` catch is not defensive noise. Server Components cannot write
 * response headers, so a token refresh that lands during render throws; the
 * refreshed cookie is written by `middleware.ts` instead, which runs where
 * headers are still mutable.
 */
export async function supabaseServer(): Promise<Db | null> {
  if (!hasSupabase) return null

  const store = await cookies()

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options)
        } catch {
          /* Server Component render — middleware.ts owns the refresh. */
        }
      },
    },
  })
}
