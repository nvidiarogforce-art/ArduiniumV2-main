import 'server-only'

import Anthropic from '@anthropic-ai/sdk'

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

export type StreamRequest = {
  system: string
  messages: ChatMessage[]
  maxTokens?: number
  signal?: AbortSignal
}

/**
 * The seam the rest of the app talks to.
 *
 * Every call site — currently one, `app/api/ai/chat/route.ts` — deals in
 * `system`, `messages` and a stream of text chunks. Nothing above this file
 * imports the Anthropic SDK or knows a model id, so swapping the provider is
 * this file and the two env vars, not a search-and-replace through the routes.
 */
export interface AiProvider {
  readonly id: string
  readonly model: string
  stream(request: StreamRequest): AsyncIterable<string>
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super('AI provider is not configured')
    this.name = 'AiNotConfiguredError'
  }
}

/**
 * Claude Opus 5 is the default and `ANTHROPIC_MODEL` overrides it.
 *
 * Choosing the model is an operator decision with a cost attached, so it is an
 * env var rather than a constant someone has to fork the repo to change.
 */
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5'

/**
 * Effort is the cost lever, and `low` is right for this shape of request.
 *
 * A tutor reply is two or three sentences answering a question a 12-year-old
 * just typed; the win is latency, not depth. Adaptive thinking is on by default
 * on this model and `max_tokens` bounds thinking *and* text together, so the
 * budget below is deliberately generous relative to the answer length.
 */
const EFFORT = (process.env.ANTHROPIC_EFFORT as 'low' | 'medium' | 'high') || 'low'
const MAX_TOKENS = Number(process.env.ANTHROPIC_MAX_TOKENS || 1600)

function anthropicProvider(apiKey: string): AiProvider {
  const client = new Anthropic({ apiKey })

  return {
    id: 'anthropic',
    model: MODEL,
    async *stream({ system, messages, maxTokens, signal }: StreamRequest) {
      const run = client.messages.stream(
        {
          model: MODEL,
          max_tokens: maxTokens ?? MAX_TOKENS,
          output_config: { effort: EFFORT },
          system,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        },
        { signal },
      )

      for await (const event of run) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield event.delta.text
        }
      }

      // A safety classifier can decline with a normal 200 and an empty body.
      // Say so plainly rather than letting the panel show a blank bubble.
      const final = await run.finalMessage()
      if (final.stop_reason === 'refusal') {
        yield '\n\n(Ardu cannot help with that one — try asking about your circuit or your code.)'
      }
    },
  }
}

let cached: AiProvider | null | undefined

/** `null` when `ANTHROPIC_API_KEY` is absent — the caller renders "not configured". */
export function getProvider(): AiProvider | null {
  if (cached !== undefined) return cached
  const key = process.env.ANTHROPIC_API_KEY
  cached = key ? anthropicProvider(key) : null
  return cached
}

export const isAiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY)
