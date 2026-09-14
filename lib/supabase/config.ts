/**
 * Is there a backend at all?
 *
 * The site has to run in two configurations and say so honestly:
 *
 *   - **Configured** — the Supabase env vars are present. Progress, community
 *     posts, classes and the assistant all read and write real rows, gated by
 *     the RLS policies in `supabase/migrations/0002_rls.sql`.
 *   - **Not configured** — a fresh clone with no `.env.local`. Everything
 *     Phase 1 could do locally still works (lessons render, progress and posts
 *     persist to localStorage); the routes that genuinely need a backend say
 *     they are not configured rather than redirecting to a sign-in that could
 *     never succeed.
 *
 * That second mode is not a demo mock — it is the same code path Phase 1 had.
 * Keeping it is what lets `tools/web-test.mjs` remain a valid regression gate
 * on a machine with no Supabase project, and it means `npm run dev` works the
 * minute someone clones the repo.
 *
 * `NEXT_PUBLIC_*` is inlined at build time, so this constant is correct in the
 * browser bundle as well as on the server.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
