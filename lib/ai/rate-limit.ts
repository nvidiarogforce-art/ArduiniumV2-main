import 'server-only'

import type { Db } from '@/lib/supabase/server'

/**
 * Messages per user per UTC day.
 *
 * Phase 2 spec §3.2.3 calls this a real production concern rather than polish,
 * and it is: the assistant is behind a login, but a login belongs to a
 * thirteen-year-old who may well find it funny to hold down enter. 30 is enough
 * for a double lesson and cheap enough that a whole class cannot run up a bill
 * nobody budgeted for. `AI_DAILY_MESSAGE_LIMIT` overrides it per deployment.
 */
export const DAILY_MESSAGE_LIMIT = Math.max(1, Number(process.env.AI_DAILY_MESSAGE_LIMIT || 30))

export type Allowance = { allowed: boolean; used: number; limit: number; remaining: number }

/**
 * Claim one message from today's allowance.
 *
 * The check and the increment happen in one SQL statement inside
 * `ai_rate_limit_take()` — see the note there for why a read-then-write here
 * would be a race with a bill attached.
 *
 * A database error fails **closed**: if the counter cannot be read we do not
 * call the model. An outage that silently disables the limiter is the worst of
 * the available outcomes.
 */
export async function takeSlot(db: Db): Promise<Allowance> {
  const { data, error } = await db.rpc('ai_rate_limit_take', { p_limit: DAILY_MESSAGE_LIMIT })

  if (error || !data || !data.length) {
    return { allowed: false, used: DAILY_MESSAGE_LIMIT, limit: DAILY_MESSAGE_LIMIT, remaining: 0 }
  }

  const row = data[0]
  return {
    allowed: row.allowed,
    used: row.used,
    limit: row.limit_n,
    remaining: Math.max(0, row.limit_n - row.used),
  }
}

/** Give the slot back when the model request itself failed. */
export async function refundSlot(db: Db): Promise<void> {
  await db.rpc('ai_rate_limit_refund')
}
