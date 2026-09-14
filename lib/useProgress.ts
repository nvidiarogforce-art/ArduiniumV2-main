'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalState } from '@/lib/useLocalState'
import { useViewer } from '@/lib/auth/use-viewer'
import { supabaseBrowser } from '@/lib/supabase/client'

const KEY = 'arduinium.progress'

/**
 * Which lessons the reader has marked complete.
 *
 * Two backings, one interface. Signed in against a configured Supabase project
 * the source of truth is `lesson_progress`, which is also what the teacher and
 * admin views aggregate; otherwise it is localStorage exactly as in Phase 1.
 * The returned shape is unchanged from Phase 1 on purpose — `/learn`, the
 * lesson page and the sandbox chrome all consume this and none of them had to
 * learn about auth.
 *
 * The slug list is still the public currency. Progress rows key on a lesson
 * uuid, so this hook holds the slug↔id map and translates at the edge; a lesson
 * dropped from the catalogue simply stops matching, same as before.
 */
export function useProgress() {
  const [local, setLocal, localHydrated] = useLocalState<string[]>(KEY, [])
  const { viewer, loading: viewerLoading } = useViewer()
  const db = supabaseBrowser()
  const remote = Boolean(db && viewer)

  const [done, setDone] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(false)
  const idBySlug = useRef<Record<string, string>>({})

  useEffect(() => {
    if (viewerLoading) return
    if (!remote || !db || !viewer) {
      setReady(false)
      return
    }

    let live = true
    setError(false)

    void (async () => {
      const [lessons, progress] = await Promise.all([
        db.from('lessons').select('id, slug'),
        db.from('lesson_progress').select('lesson_id, status').eq('student_id', viewer.id),
      ])

      if (!live) return
      if (lessons.error || progress.error) {
        setError(true)
        setReady(true)
        return
      }

      const map: Record<string, string> = {}
      const slugById: Record<string, string> = {}
      for (const l of lessons.data ?? []) {
        map[l.slug] = l.id
        slugById[l.id] = l.slug
      }
      idBySlug.current = map

      setDone(
        (progress.data ?? [])
          .filter((r) => r.status === 'completed')
          .map((r) => slugById[r.lesson_id])
          .filter(Boolean),
      )
      setReady(true)
    })()

    return () => {
      live = false
    }
  }, [remote, db, viewer, viewerLoading])

  const value = remote ? done : local
  const hydrated = remote ? ready : localHydrated

  /**
   * Write through optimistically, then persist.
   *
   * A student marking a lesson complete should see the pad light up on the
   * same frame; waiting on a round trip in a classroom on school wifi reads as
   * a broken button and produces a second click.
   */
  const persist = useCallback(
    async (slug: string, complete: boolean) => {
      if (!remote || !db || !viewer) return
      const lessonId = idBySlug.current[slug]
      if (!lessonId) return

      const res = complete
        ? await db
            .from('lesson_progress')
            .upsert(
              { student_id: viewer.id, lesson_id: lessonId, status: 'completed' },
              { onConflict: 'student_id,lesson_id' },
            )
        : await db
            .from('lesson_progress')
            .delete()
            .eq('student_id', viewer.id)
            .eq('lesson_id', lessonId)

      if (res.error) {
        setError(true)
        // Put it back: the pad now disagrees with the database, and showing the
        // old truth is better than showing a completion that was never saved.
        setDone((prev) => (complete ? prev.filter((s) => s !== slug) : [...prev, slug]))
        return
      }

      await db.from('activity_log').insert({
        user_id: viewer.id,
        event_type: complete ? 'lesson_complete' : 'lesson_reopen',
      })
    },
    [remote, db, viewer],
  )

  const isDone = useCallback((slug: string) => value.includes(slug), [value])

  const toggle = useCallback(
    (slug: string) => {
      if (!remote) {
        setLocal((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]))
        return
      }
      const next = !done.includes(slug)
      setDone((prev) => (next ? [...prev, slug] : prev.filter((s) => s !== slug)))
      void persist(slug, next)
    },
    [remote, done, setLocal, persist],
  )

  const complete = useCallback(
    (slug: string) => {
      if (!remote) {
        setLocal((prev) => (prev.includes(slug) ? prev : [...prev, slug]))
        return
      }
      if (done.includes(slug)) return
      setDone((prev) => [...prev, slug])
      void persist(slug, true)
    },
    [remote, done, setLocal, persist],
  )

  const reset = useCallback(() => {
    if (!remote) {
      setLocal([])
      return
    }
    const previous = done
    setDone([])
    void (async () => {
      if (!db || !viewer) return
      const res = await db.from('lesson_progress').delete().eq('student_id', viewer.id)
      if (res.error) {
        setError(true)
        setDone(previous)
      }
    })()
  }, [remote, done, setLocal, db, viewer])

  return { done: value, isDone, toggle, complete, reset, hydrated, error, synced: remote }
}
