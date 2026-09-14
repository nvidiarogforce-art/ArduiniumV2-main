'use server'

import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getViewer } from '@/lib/auth/session'

/**
 * Server actions for auth.
 *
 * They return `{ error }` instead of throwing, and they never redirect: the
 * caller decides where to go. That keeps the register flow's three-step
 * stepper — which is Phase 1 UI we are not rebuilding — in charge of its own
 * navigation, and it means an error renders inline next to the field rather
 * than as a Next error overlay.
 */

export type AuthResult =
  /**
   * `needsConfirmation` is the case where the project has "Confirm email" on:
   * the account exists but there is no session yet. The UI has to say so —
   * silently landing on a dashboard that then bounces to /login is the most
   * confusing possible version of a working signup.
   */
  { ok: true; needsConfirmation?: boolean } | { ok: false; error: string }

/** Supabase's messages are English-only and sometimes internal. Translate the ones readers hit. */
function readable(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'invalid-credentials'
  if (m.includes('already registered') || m.includes('already been registered')) return 'email-taken'
  if (m.includes('password')) return 'weak-password'
  if (m.includes('email') && m.includes('valid')) return 'invalid-email'
  if (m.includes('rate limit') || m.includes('too many')) return 'rate-limited'
  return 'unknown'
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const db = await supabaseServer()
  if (!db) return { ok: false, error: 'not-configured' }

  const { error } = await db.auth.signInWithPassword({ email, password })
  if (error) return { ok: false, error: readable(error.message) }

  await recordActivity('session_start')
  revalidatePath('/', 'layout')
  return { ok: true }
}

export type SignUpInput = {
  email: string
  password: string
  role: 'student' | 'teacher'
  fullName: string
  locale: string
  grade?: string
  subject?: string
  experience?: string
  schoolName?: string
}

export async function signUp(input: SignUpInput): Promise<AuthResult> {
  const db = await supabaseServer()
  if (!db) return { ok: false, error: 'not-configured' }

  /**
   * The role travels as signup metadata, not as an insert.
   *
   * `handle_new_user()` in the database reads it, and it only honours
   * 'student' or 'teacher' — anything else becomes 'student'. So even a forged
   * request to this action cannot mint a school admin, and the profile row is
   * created in the same transaction as the auth user rather than by a second
   * call that might fail.
   */
  const { data, error } = await db.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        full_name: input.fullName,
        role: input.role,
        locale: input.locale,
        grade: input.grade ?? null,
        subject: input.subject ?? null,
        experience: input.experience ?? null,
        school_name: input.schoolName ?? null,
      },
    },
  })

  if (error) return { ok: false, error: readable(error.message) }

  const needsConfirmation = !data.session
  if (!needsConfirmation) await recordActivity('signup')
  revalidatePath('/', 'layout')
  return { ok: true, needsConfirmation }
}

export async function signOut(): Promise<void> {
  const db = await supabaseServer()
  if (db) await db.auth.signOut()
  revalidatePath('/', 'layout')
}

/**
 * Append one non-content event to `activity_log`.
 *
 * This is the *only* signal that reaches a teacher's or an admin's screen about
 * someone else's use of the product: an event type and a timestamp. It is what
 * makes "active this week" possible without anybody reading a child's work, let
 * alone their conversation with the assistant.
 *
 * Written with the service-role client because a signed-out or mid-signup
 * caller has no session to insert under; the user id is resolved first and the
 * write is a no-op without one, so this cannot be used to log against someone
 * else.
 */
export async function recordActivity(eventType: string): Promise<void> {
  const viewer = await getViewer()
  if (!viewer) return

  const admin = supabaseAdmin()
  const db = admin ?? (await supabaseServer())
  if (!db) return

  await db.from('activity_log').insert({ user_id: viewer.id, event_type: eventType })
}
