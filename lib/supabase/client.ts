'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabase } from './config'
import type { Database } from './types'

export type Db = SupabaseClient<Database>

let cached: Db | null = null

/**
 * The browser client, or `null` when there is no backend configured.
 *
 * Returning `null` rather than throwing is the whole ergonomic of the
 * two-configuration design (see `config.ts`): every caller does
 * `const db = supabaseBrowser(); if (!db) { ...local fallback... }`, which
 * reads as one branch instead of a try/catch around every data access.
 *
 * Memoised because `createBrowserClient` installs auth listeners; one instance
 * per tab is what the SDK expects.
 */
export function supabaseBrowser(): Db | null {
  if (!hasSupabase) return null
  if (!cached) cached = createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
  return cached
}
