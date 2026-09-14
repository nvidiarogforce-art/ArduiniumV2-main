import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getProvider } from '@/lib/ai/provider'
import { buildSystemPrompt } from '@/lib/ai/prompt'
import { DAILY_MESSAGE_LIMIT, refundSlot, takeSlot } from '@/lib/ai/rate-limit'
import type { AiSource } from '@/lib/supabase/types'

/**
 * POST /api/ai/chat — the assistant.
 *
 * Everything about the model call happens here, on the server, for one reason:
 * `ANTHROPIC_API_KEY` must never reach a browser. There is no client-side
 * fallback path and no "if the proxy is down, call the API directly" — the key
 * exists in exactly one process.
 *
 * The order of the guards below is deliberate. Authenticate, then rate-limit,
 * then talk to the model: an unauthenticated request must cost nothing, and a
 * request over the daily allowance must cost nothing either.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MESSAGE_LIMIT = 2000
/** How much of the conversation to replay as context. Keeps cost bounded. */
const HISTORY_TURNS = 12

type Body = {
  message?: unknown
  conversationId?: unknown
  source?: unknown
  lessonSlug?: unknown
  context?: { code?: unknown; circuit?: unknown }
}

const str = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null

export async function POST(request: Request) {
  const db = await supabaseServer()
  if (!db) {
    return NextResponse.json({ error: 'not-configured', detail: 'Supabase is not set up.' }, { status: 503 })
  }

  // Auth before the configuration check, so an anonymous caller learns nothing
  // about which server-side keys are or are not present.
  const { data: auth } = await db.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const provider = getProvider()
  if (!provider) {
    return NextResponse.json(
      { error: 'not-configured', detail: 'ANTHROPIC_API_KEY is not set on the server.' },
      { status: 503 },
    )
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 })
  }

  const message = str(body.message, MESSAGE_LIMIT)
  if (!message) return NextResponse.json({ error: 'empty-message' }, { status: 400 })

  const source: AiSource = body.source === 'sandbox' ? 'sandbox' : 'standalone'

  // ------------------------------------------------------------ allowance ---
  const allowance = await takeSlot(db)
  if (!allowance.allowed) {
    return NextResponse.json(
      { error: 'rate-limited', used: allowance.used, limit: allowance.limit },
      { status: 429, headers: { 'x-ai-remaining': '0' } },
    )
  }

  const giveBack = async () => {
    await refundSlot(db)
  }

  // ------------------------------------------------------------- context ---
  const { data: profile } = await db
    .from('profiles')
    .select('role, locale, full_name')
    .eq('id', auth.user.id)
    .maybeSingle()

  const lessonSlug = str(body.lessonSlug, 120)
  const lesson = lessonSlug
    ? (
        await db
          .from('lessons')
          .select('id, title_uz, title_en')
          .eq('slug', lessonSlug)
          .maybeSingle()
      ).data
    : null

  const locale = profile?.locale === 'en' ? 'en' : 'uz'

  const system = buildSystemPrompt({
    role: profile?.role ?? 'student',
    locale,
    lessonTitle: lesson ? (locale === 'en' ? lesson.title_en : lesson.title_uz) : null,
    sandbox:
      source === 'sandbox'
        ? { code: str(body.context?.code, 6000), circuit: str(body.context?.circuit, 1000) }
        : null,
  })

  // --------------------------------------------------------- conversation ---
  // RLS does the ownership check: a conversation id belonging to someone else
  // simply does not resolve here, so there is nothing extra to verify.
  let conversationId = str(body.conversationId, 64)

  if (conversationId) {
    const { data: found } = await db
      .from('ai_conversations')
      .select('id')
      .eq('id', conversationId)
      .maybeSingle()
    if (!found) conversationId = null
  }

  if (!conversationId) {
    const { data: created, error } = await db
      .from('ai_conversations')
      .insert({
        user_id: auth.user.id,
        source,
        context_lesson_id: lesson?.id ?? null,
        title: message.slice(0, 60),
      })
      .select('id')
      .single()

    if (error || !created) {
      await giveBack()
      return NextResponse.json({ error: 'storage-failed' }, { status: 500 })
    }
    conversationId = created.id
  }

  /**
   * The most recent turns, not the first ones.
   *
   * Ordering ascending with a LIMIT would replay the oldest half of a long
   * conversation and silently drop everything the student has said since —
   * the assistant would keep answering a question from ten minutes ago. Fetch
   * newest-first, then put them back in order.
   */
  const { data: recent } = await db
    .from('ai_messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_TURNS)

  const messages = [
    ...(recent ?? []).reverse().map((m) => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: message },
  ]

  await db.from('ai_messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content: message,
  })

  /**
   * The activity signal, and only the signal.
   *
   * A row saying "this user used the assistant at 10:42" is what a teacher's
   * and an admin's view is built from. The message itself went to `ai_messages`
   * above, which no teacher policy can read. The two facts live in different
   * tables because they have different audiences.
   */
  await db.from('activity_log').insert({ user_id: auth.user.id, event_type: 'ai_message' })

  // -------------------------------------------------------------- stream ---
  const encoder = new TextEncoder()
  const admin = supabaseAdmin()
  const convId = conversationId

  let opened = false

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let reply = ''
      try {
        for await (const chunk of provider.stream({ system, messages, signal: request.signal })) {
          opened = true
          reply += chunk
          controller.enqueue(encoder.encode(chunk))
        }
      } catch (err) {
        // Nothing had been sent yet — the client can still show a clean error,
        // and the student should not be charged a message for an outage.
        if (!opened) await giveBack()
        const note =
          locale === 'en'
            ? '\n\n[Ardu could not finish that answer. Try again in a moment.]'
            : '\n\n[Ardu javobni tugata olmadi. Birozdan so‘ng qayta urinib ko‘ring.]'
        controller.enqueue(encoder.encode(note))
        console.error('[ai/chat] provider error', err)
      }

      /**
       * Persist with the service-role client when one is available.
       *
       * By the time the stream drains, the request's cookie jar may already be
       * gone — a user-scoped write here can fail silently and lose half the
       * transcript. The service role is used to write the row, never to read
       * one back to anybody: `user_id` is fixed above from the verified
       * session, so this cannot write into someone else's conversation.
       */
      if (reply.trim()) {
        const writer = admin ?? db
        await writer.from('ai_messages').insert({
          conversation_id: convId,
          role: 'assistant',
          content: reply,
        })
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-conversation-id': convId,
      'x-ai-remaining': String(allowance.remaining),
      'x-ai-limit': String(DAILY_MESSAGE_LIMIT),
    },
  })
}
