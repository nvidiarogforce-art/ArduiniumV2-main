import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabase } from '@/lib/supabase/config'

/**
 * Refresh the Supabase session on every request.
 *
 * Access tokens are short-lived. A Server Component cannot write a cookie, so
 * without this the refreshed token has nowhere to land and a reader who leaves
 * a tab open is signed out mid-lesson. This runs before the response headers
 * are sealed, which is the one place the new cookie can be set.
 *
 * The file is `proxy.ts`, not `middleware.ts`: Next 16 deprecated the older
 * convention and warns on every build until it is renamed.
 *
 * The `getClaims()` call is not decoration — it is what forces the refresh.
 * Nothing else in this file uses the result.
 *
 * With no backend configured this is a pass-through, so a fresh clone pays no
 * cost here at all.
 */
export default async function proxy(request: NextRequest) {
  if (!hasSupabase) return NextResponse.next()

  let response = NextResponse.next({ request })

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of list) response.cookies.set(name, value, options)
      },
    },
  })

  await supabase.auth.getClaims()

  return response
}

export const config = {
  /**
   * Skip static assets and image optimisation — refreshing a session for a
   * favicon request is wasted work on every page load.
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|brand/|models/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|wrl)$).*)'],
}
