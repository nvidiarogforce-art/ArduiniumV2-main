'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import type { ProfileRow } from '@/lib/supabase/types'

export type ClientViewer = { id: string; email: string | null; profile: ProfileRow }

type State = { viewer: ClientViewer | null; loading: boolean }

/**
 * Who is signed in, in the browser.
 *
 * `loading` starts true and every consumer is expected to render something
 * neutral until it clears — the header must not flash "Sign in" at somebody who
 * is already signed in, which is the classic tell of client-side auth bolted on
 * after the fact.
 *
 * With no backend configured this settles immediately to `{viewer: null,
 * loading: false}`, so the header simply shows the Phase 1 "Register" button
 * and nothing waits on a request that will never be made.
 */
export function useViewer(): State & { refresh: () => void } {
  const [state, setState] = useState<State>({ viewer: null, loading: true })
  const [nonce, setNonce] = useState(0)
  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    const db = supabaseBrowser()
    if (!db) {
      setState({ viewer: null, loading: false })
      return
    }

    let live = true

    const read = async () => {
      const { data } = await db.auth.getUser()
      if (!live) return
      if (!data.user) {
        setState({ viewer: null, loading: false })
        return
      }
      const { data: profile } = await db
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle()
      if (!live) return
      setState({
        viewer: profile ? { id: data.user.id, email: data.user.email ?? null, profile } : null,
        loading: false,
      })
    }

    void read()

    // Sign-in and sign-out happen through server actions, so the tab that did
    // it re-renders — but a second tab would not. The listener keeps them in
    // step without polling.
    const { data: sub } = db.auth.onAuthStateChange(() => void read())

    return () => {
      live = false
      sub.subscription.unsubscribe()
    }
  }, [nonce])

  return { ...state, refresh }
}
