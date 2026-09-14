'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Lock, RotateCcw, SendHorizonal, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArduAvatar } from '@/components/ai/ardu-avatar'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export type Bubble = { role: 'user' | 'assistant'; content: string }

export type ChatProps = {
  /** Prior turns, loaded server-side for /ai. Empty in the sandbox panel. */
  seed?: { conversationId: string | null; messages: Bubble[] }
  source: 'standalone' | 'sandbox'
  lessonSlug?: string | null
  /**
   * Read the sandbox's current state at send time.
   *
   * A getter rather than a prop so the panel never has to subscribe to the
   * workshop's store — it reads the debug hooks the sandbox already puts on
   * `window` at the moment a question is asked, and reads nothing in between.
   * That is what keeps this additive: no sandbox file changes, no simulation
   * logic touched.
   */
  getContext?: () => { code?: string | null; circuit?: string | null }
  /** Tighter type and spacing for the slide-over. */
  dense?: boolean
}

type Status = 'idle' | 'streaming' | 'limited' | 'signin' | 'unconfigured' | 'failed'

export function ArduChat({ seed, source, lessonSlug, getContext, dense = false }: ChatProps) {
  const { t } = useI18n()
  const [messages, setMessages] = useState<Bubble[]>(seed?.messages ?? [])
  const [conversationId, setConversationId] = useState<string | null>(seed?.conversationId ?? null)
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [remaining, setRemaining] = useState<number | null>(null)

  const scroller = useRef<HTMLDivElement | null>(null)
  const field = useRef<HTMLTextAreaElement | null>(null)

  // Follow the answer as it streams. `scrollTop` rather than scrollIntoView so
  // the surrounding page (or the sandbox behind the panel) never moves.
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, status])

  const send = useCallback(
    async (text: string) => {
      const question = text.trim()
      if (!question || status === 'streaming') return

      setInput('')
      setStatus('streaming')
      setMessages((prev) => [...prev, { role: 'user', content: question }, { role: 'assistant', content: '' }])

      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            message: question,
            conversationId,
            source,
            lessonSlug: lessonSlug ?? null,
            context: getContext?.() ?? null,
          }),
        })

        if (res.status === 401) {
          setMessages((prev) => prev.slice(0, -2))
          setStatus('signin')
          return
        }
        if (res.status === 503) {
          setMessages((prev) => prev.slice(0, -2))
          setStatus('unconfigured')
          return
        }
        if (res.status === 429) {
          setMessages((prev) => prev.slice(0, -2))
          setRemaining(0)
          setStatus('limited')
          return
        }
        if (!res.ok || !res.body) {
          setMessages((prev) => prev.slice(0, -2))
          setStatus('failed')
          return
        }

        const id = res.headers.get('x-conversation-id')
        if (id) setConversationId(id)
        const left = res.headers.get('x-ai-remaining')
        if (left !== null) setRemaining(Number(left))

        const reader = res.body.getReader()
        const decoder = new TextDecoder()

        // Append into the trailing assistant bubble that was pushed above, so
        // the answer appears word by word instead of arriving as a block.
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          setMessages((prev) => {
            const next = [...prev]
            next[next.length - 1] = {
              role: 'assistant',
              content: next[next.length - 1].content + chunk,
            }
            return next
          })
        }

        setStatus('idle')
      } catch {
        setMessages((prev) => prev.slice(0, -2))
        setStatus('failed')
      }
    },
    [conversationId, getContext, lessonSlug, source, status],
  )

  const reset = () => {
    setMessages([])
    setConversationId(null)
    setStatus('idle')
    field.current?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter breaks the line. A student pasting code needs
    // the second one, which is why this is not a plain <input>.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send(input)
    }
  }

  if (status === 'unconfigured') {
    return <Notice tone="warn" title={t.ai.notConfiguredTitle} body={t.ai.notConfiguredBody} />
  }

  if (status === 'signin') {
    return (
      <Notice tone="lock" title={t.ai.signInTitle} body={t.ai.signInBody}>
        <Button asChild size="sm" className="mt-4">
          <Link href="/login?next=/ai">{t.auth.signIn}</Link>
        </Button>
      </Notice>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={scroller}
        className={cn('min-h-0 flex-1 overflow-y-auto', dense ? 'px-4 py-4' : 'px-1 py-2')}
      >
        {messages.length === 0 ? (
          <div className="py-6">
            <div className="flex items-center gap-3">
              <ArduAvatar size={dense ? 34 : 42} />
              <p className="font-display text-[17px] font-bold text-navy">{t.ai.emptyTitle}</p>
            </div>
            <div className="mt-4 flex flex-col items-start gap-2">
              {t.ai.suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="rounded-[10px] border-2 border-navy/20 bg-card px-3.5 py-2 text-left text-[13.5px] font-semibold text-navy/80 transition-colors hover:border-navy hover:text-navy"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {messages.map((m, i) => (
              <li
                key={i}
                className={cn('flex gap-2.5', m.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
              >
                {m.role === 'assistant' && <ArduAvatar size={28} className="mt-0.5" />}
                <div
                  className={cn(
                    'max-w-[85%] rounded-[12px] border-2 border-navy px-3.5 py-2.5 text-[14.5px] leading-relaxed whitespace-pre-wrap',
                    m.role === 'user'
                      ? 'bg-navy text-bg shadow-[2px_2px_0_var(--color-orange)]'
                      : 'bg-card text-navy shadow-hard-sm',
                  )}
                >
                  {m.content ||
                    (status === 'streaming' ? (
                      <span className="inline-flex items-center gap-2 text-navy/55">
                        <span className="size-2 animate-pulse rounded-full bg-orange" />
                        {t.ai.thinking}
                      </span>
                    ) : (
                      ''
                    ))}
                </div>
              </li>
            ))}
          </ul>
        )}

        {status === 'limited' && (
          <Notice className="mt-5" tone="warn" title={t.ai.limitTitle} body={t.ai.limitBody} />
        )}
        {status === 'failed' && (
          <Notice className="mt-5" tone="warn" title={t.ai.errorTitle} body={t.ai.errorBody}>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => setStatus('idle')}>
              <RotateCcw size={14} />
              {t.common.retry}
            </Button>
          </Notice>
        )}
      </div>

      <div className={cn('shrink-0 border-t-2 border-navy/12', dense ? 'px-4 py-3' : 'pt-4')}>
        <div className="flex items-end gap-2">
          <textarea
            ref={field}
            rows={dense ? 2 : 3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={status === 'streaming' || status === 'limited'}
            placeholder={t.ai.placeholder}
            aria-label={t.ai.placeholder}
            className="w-full resize-none rounded-[10px] border-2 border-navy bg-bg-alt px-3.5 py-2.5 text-[14.5px] text-navy shadow-[inset_2px_2px_0_rgba(28,53,71,0.12)] placeholder:text-navy/35 focus:bg-card disabled:opacity-55"
          />
          <Button
            size={dense ? 'sm' : 'md'}
            onClick={() => void send(input)}
            disabled={!input.trim() || status === 'streaming' || status === 'limited'}
            aria-label={t.ai.send}
          >
            <SendHorizonal size={16} strokeWidth={2.4} />
            {!dense && t.ai.send}
          </Button>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-[11.5px] text-navy/50">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-teal" />
            {t.ai.privacy}
          </span>
          <span className="inline-flex items-center gap-3">
            {remaining !== null && (
              <span className="font-mono">
                {t.ai.remaining} {remaining}
              </span>
            )}
            {messages.length > 0 && (
              <button
                type="button"
                onClick={reset}
                className="font-bold text-navy/60 underline-offset-2 hover:text-orange hover:underline"
              >
                {t.ai.newChat}
              </button>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}

function Notice({
  title,
  body,
  tone,
  children,
  className,
}: {
  title: string
  body: string
  tone: 'warn' | 'lock'
  children?: React.ReactNode
  className?: string
}) {
  const Icon = tone === 'lock' ? Lock : AlertTriangle
  return (
    <Card tone="alt" className={cn('p-6', className)}>
      <div className="flex gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-[9px] border-2 border-navy bg-orange/15">
          <Icon size={17} className="text-orange" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-[15.5px] font-bold text-navy">{title}</p>
          <p className="mt-1 text-[14px] leading-relaxed text-navy/70">{body}</p>
          {children}
        </div>
      </div>
    </Card>
  )
}
