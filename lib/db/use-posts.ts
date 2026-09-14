'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocalState } from '@/lib/useLocalState'
import { useViewer } from '@/lib/auth/use-viewer'
import { supabaseBrowser } from '@/lib/supabase/client'
import { SEED_POSTS, type Post, type PostTag } from '@/lib/content/community'
import type { CommunityPostRow } from '@/lib/supabase/types'

export type Draft = { title: string; body: string; tag: PostTag; author: string }

/**
 * The community feed, backed by `community_posts` when there is a backend and
 * by localStorage plus the Phase 1 seed posts when there is not.
 *
 * Rows are mapped into the Phase 1 `Post` shape so `PostCard` is untouched. A
 * stored post exists in one language — whatever its author typed — so both
 * dictionary slots get the same string, which is what Phase 1 already did for
 * reader-written posts.
 */
export function usePosts() {
  const { viewer, loading: viewerLoading } = useViewer()
  const db = supabaseBrowser()
  const remote = Boolean(db)

  const [mine, setMine] = useLocalState<Post[]>('arduinium.posts', [])
  const [rows, setRows] = useState<Post[]>([])
  const [loading, setLoading] = useState(remote)
  const [error, setError] = useState(false)

  const toPost = (r: CommunityPostRow): Post => ({
    id: r.id,
    tag: r.tag,
    role: r.author_role === 'student' ? 'student' : 'teacher',
    author: r.author_name || '—',
    daysAgo: Math.max(0, Math.round((Date.now() - new Date(r.created_at).getTime()) / 86_400_000)),
    title: { uz: r.title, en: r.title },
    body: { uz: r.body, en: r.body },
  })

  const load = useCallback(async () => {
    if (!db) return
    setLoading(true)
    const res = await db
      .from('community_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(80)
    if (res.error) {
      setError(true)
    } else {
      setError(false)
      setRows((res.data ?? []).map(toPost))
    }
    setLoading(false)
  }, [db])

  useEffect(() => {
    if (!remote) {
      setLoading(false)
      return
    }
    void load()
  }, [remote, load])

  /**
   * Returns a reason rather than a boolean so the form can say why.
   * `sign-in-required` is a real state: posts are readable signed-out (the feed
   * is a shop window) but writing one needs an account.
   */
  const publish = useCallback(
    async (draft: Draft): Promise<'ok' | 'sign-in-required' | 'failed'> => {
      const title = draft.title.trim()
      const body = draft.body.trim()

      if (!remote || !db) {
        setMine((prev) => [
          {
            id: `local-${prev.length + 1}-${title.slice(0, 12)}`,
            tag: draft.tag,
            role: 'student',
            author: draft.author.trim() || '—',
            daysAgo: 0,
            title: { uz: title, en: title },
            body: { uz: body, en: body },
          },
          ...prev,
        ])
        return 'ok'
      }

      if (!viewer) return 'sign-in-required'

      const res = await db.from('community_posts').insert({
        author_id: viewer.id,
        author_name: draft.author.trim() || viewer.profile.full_name || '—',
        author_role: viewer.profile.role,
        title,
        body,
        tag: draft.tag,
      })

      if (res.error) return 'failed'

      await db.from('activity_log').insert({ user_id: viewer.id, event_type: 'community_post' })
      await load()
      return 'ok'
    },
    [remote, db, viewer, setMine, load],
  )

  // Signed-out local mode keeps Phase 1's arrangement: the reader's own posts
  // sit above the seeded sample content.
  const posts = remote ? rows : [...mine, ...SEED_POSTS]

  return {
    posts,
    loading: remote ? loading || viewerLoading : false,
    error,
    publish,
    canPost: !remote || Boolean(viewer),
    synced: remote,
    reload: load,
  }
}
