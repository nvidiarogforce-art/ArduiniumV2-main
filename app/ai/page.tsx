import type { Metadata } from 'next'
import { AiPage } from '@/components/ai/ai-page'
import { requireViewer, hasSupabase } from '@/lib/auth/session'
import { supabaseServer } from '@/lib/supabase/server'
import { isAiConfigured } from '@/lib/ai/provider'
import { NotConfigured } from '@/components/site/not-configured'
import type { Bubble } from '@/components/ai/chat'

export const metadata: Metadata = { title: 'Ardu' }

/**
 * Gated server-side, and the gate redirects rather than rendering an empty
 * shell — spec §5.4. The prior turns are loaded here rather than fetched from
 * the client so a reader returning to `/ai` sees the conversation on first
 * paint instead of a blank panel that fills in a moment later.
 */
export default async function Page() {
  if (!hasSupabase) return <NotConfigured />

  const viewer = await requireViewer('/ai')
  const db = await supabaseServer()

  let seed: { conversationId: string | null; messages: Bubble[] } = {
    conversationId: null,
    messages: [],
  }

  if (db) {
    // RLS restricts this to the viewer's own conversations; there is no
    // `user_id` filter here because there does not need to be one.
    const { data: latest } = await db
      .from('ai_conversations')
      .select('id')
      .eq('source', 'standalone')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latest) {
      const { data: messages } = await db
        .from('ai_messages')
        .select('role, content')
        .eq('conversation_id', latest.id)
        .order('created_at', { ascending: true })
        .limit(40)

      seed = {
        conversationId: latest.id,
        messages: (messages ?? []).map((m) => ({ role: m.role, content: m.content }) as Bubble),
      }
    }
  }

  void viewer
  return <AiPage seed={seed} configured={isAiConfigured()} />
}
