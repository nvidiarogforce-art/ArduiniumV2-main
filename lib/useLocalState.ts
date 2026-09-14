'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * State that survives a reload, kept in localStorage.
 *
 * Everything the MVP "saves" — lesson progress, community posts, the
 * registration answers — runs through this. It is deliberately the only
 * persistence layer in the site: no backend has been chosen yet (spec §11 is
 * an open decision), and inventing one silently would have been the wrong
 * call. Swapping this hook's body for a fetch is the whole migration.
 *
 * The initial render always returns `initial` so the server and the client
 * agree; the stored value arrives on mount, and `hydrated` lets a caller hold
 * back UI that would otherwise flash the empty state.
 */
export function useLocalState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw !== null) setValue(JSON.parse(raw) as T)
    } catch {
      // Corrupt or unreadable entry — fall back to `initial` rather than
      // taking the page down.
    }
    setHydrated(true)
  }, [key])

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved))
        } catch {
          /* quota or private mode — keep the in-memory value */
        }
        return resolved
      })
    },
    [key],
  )

  return [value, update, hydrated] as const
}
