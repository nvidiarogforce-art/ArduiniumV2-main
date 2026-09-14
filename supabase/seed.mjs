/**
 * ARDUINIUM — demo seed.
 *
 *   node supabase/seed.mjs            # create/refresh the demo data
 *   node supabase/seed.mjs --reset    # delete the demo accounts first
 *
 * Reads `.env.local` (or the ambient environment) for NEXT_PUBLIC_SUPABASE_URL
 * and SUPABASE_SERVICE_ROLE_KEY. It talks to the database with the service-role
 * key, so it is the one caller that bypasses RLS — which is exactly why it must
 * never be imported by the app or shipped to a browser.
 *
 * Phase 2 spec §5.3: a freshly deployed instance must not look empty. The
 * curriculum below is not invented for the demo — it is imported from
 * `lib/content/*.ts`, the same Phase 1 content the lesson pages render, so the
 * seeded catalogue and the site can never drift apart. Node 24 strips the types
 * on import; those modules have no runtime imports of their own.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

import { LESSONS } from '../lib/content/lessons.ts'
import { VIDEOS } from '../lib/content/videos.ts'
import { SEED_POSTS } from '../lib/content/community.ts'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

// ------------------------------------------------------------------ env ---

/** Minimal .env.local reader — no dependency for a script run by hand. */
function loadEnv() {
  for (const name of ['.env.local', '.env']) {
    try {
      const raw = readFileSync(resolve(root, name), 'utf8')
      for (const line of raw.split(/\r?\n/)) {
        const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
        if (!m) continue
        const value = m[2].trim().replace(/^["']|["']$/g, '')
        if (!(m[1] in process.env)) process.env[m[1]] = value
      }
    } catch {
      /* file absent — fall through to the ambient environment */
    }
  }
}

loadEnv()

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PASSWORD = process.env.SEED_PASSWORD || 'arduinium-demo'

if (!URL || !SERVICE_KEY) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Copy .env.example to .env.local and fill both in — see README §Setup.',
  )
  process.exit(1)
}

const db = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } })

// --------------------------------------------------------------- people ---

const SCHOOL = { name: '12-son umumta’lim maktabi', region: 'Toshkent' }

const PEOPLE = [
  { key: 'admin',  email: 'admin@arduinium.demo',   role: 'school_admin', full_name: 'Dilnoza Karimova', subject: null, grade: null },
  { key: 'nodira', email: 'nodira@arduinium.demo',  role: 'teacher', full_name: 'Nodira Otajonova', subject: 'Informatika', experience: 'Biroz bor' },
  { key: 'sardor', email: 'sardor@arduinium.demo',  role: 'teacher', full_name: 'Sardor Mahmudov',  subject: 'Texnologiya', experience: 'Tajribam yetarli' },
  { key: 'javohir', email: 'javohir@arduinium.demo', role: 'student', full_name: 'Javohir Rasulov', grade: '7' },
  { key: 'malika', email: 'malika@arduinium.demo',  role: 'student', full_name: 'Malika Yusupova', grade: '7' },
  { key: 'aziz',   email: 'aziz@arduinium.demo',    role: 'student', full_name: 'Aziz Tursunov',   grade: '7' },
  { key: 'kamola', email: 'kamola@arduinium.demo',  role: 'student', full_name: 'Kamola Ergasheva', grade: '6' },
  { key: 'bekzod', email: 'bekzod@arduinium.demo',  role: 'student', full_name: 'Bekzod Nazarov',  grade: '6' },
  { key: 'zilola', email: 'zilola@arduinium.demo',  role: 'student', full_name: 'Zilola Qodirova', grade: '6' },
]

const CLASSES = [
  { key: '7a', name: '7-A · Robototexnika', teacher: 'nodira', students: ['javohir', 'malika', 'aziz'] },
  { key: '7b', name: '7-B · Robototexnika', teacher: 'nodira', students: ['kamola'] },
  { key: '6a', name: '6-A · Informatika',   teacher: 'sardor', students: ['bekzod', 'zilola'] },
]

/**
 * Days since each person last did anything.
 *
 * Deliberately spread across the buckets `admin_teacher_activity()` reports, so
 * a fresh deploy actually demonstrates the "active today / this week / worth
 * checking in on" framing rather than showing one flat column.
 */
const LAST_ACTIVE_DAYS = {
  admin: 0, nodira: 0, sardor: 19,
  javohir: 0, malika: 1, aziz: 4, kamola: 2, bekzod: 6, zilola: 23,
}

/** Which lesson slugs each student has finished. */
const COMPLETED = {
  javohir: ['arduino-nima', 'led-yoqish', 'tugma-va-kirish'],
  malika: ['arduino-nima', 'led-yoqish'],
  aziz: ['arduino-nima'],
  kamola: ['arduino-nima', 'led-yoqish'],
  bekzod: [],
  zilola: ['arduino-nima'],
}

// --------------------------------------------------------------- helpers ---

const ok = (label) => (res) => {
  if (res.error) throw new Error(`${label}: ${res.error.message}`)
  return res.data
}

const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString()

/** Flatten a lesson's structured blocks into the plain text the table stores. */
function flatten(lesson, locale) {
  const out = [lesson.summary[locale]]
  for (const block of lesson.body) {
    if (block.kind === 'p' || block.kind === 'h' || block.kind === 'note') out.push(block.text[locale])
    else if (block.kind === 'list') out.push(block.items[locale].map((i) => `• ${i}`).join('\n'))
    else if (block.kind === 'code') out.push(`${block.caption[locale]}\n\n${block.code}`)
  }
  return out.join('\n\n')
}

/** Create the auth user if absent, and return its id either way. */
async function upsertUser(person) {
  const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existing = list?.users?.find((u) => u.email === person.email)
  if (existing) return existing.id

  const created = ok(`create ${person.email}`)(
    await db.auth.admin.createUser({
      email: person.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: person.full_name,
        // handle_new_user() only honours student/teacher; the admin's real role
        // is applied by the service-role update below. That asymmetry is the
        // point — nobody signs up as a school admin.
        role: person.role === 'school_admin' ? 'teacher' : person.role,
        locale: 'uz',
        grade: person.grade ?? null,
        subject: person.subject ?? null,
        experience: person.experience ?? null,
        school_name: SCHOOL.name,
      },
    }),
  )
  return created.user.id
}

// ------------------------------------------------------------------ run ---

async function reset() {
  const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const emails = new Set(PEOPLE.map((p) => p.email))
  for (const user of list?.users ?? []) {
    if (emails.has(user.email)) {
      await db.auth.admin.deleteUser(user.id)
      console.log(`  removed ${user.email}`)
    }
  }
  await db.from('schools').delete().eq('name', SCHOOL.name)
}

async function main() {
  if (process.argv.includes('--reset')) {
    console.log('Resetting demo accounts…')
    await reset()
  }

  console.log('Seeding Arduinium demo data…')

  // -- curriculum -----------------------------------------------------------
  const lessonRows = LESSONS.map((l, i) => ({
    slug: l.slug,
    title_uz: l.title.uz,
    title_en: l.title.en,
    body_uz: l.available ? flatten(l, 'uz') : '',
    body_en: l.available ? flatten(l, 'en') : '',
    order_index: i,
    has_simulator: l.sandbox,
  }))
  const lessons = ok('lessons')(
    await db.from('lessons').upsert(lessonRows, { onConflict: 'slug' }).select('id, slug'),
  )
  const lessonId = Object.fromEntries(lessons.map((l) => [l.slug, l.id]))
  console.log(`  ${lessons.length} lessons`)

  const videoRows = VIDEOS.map((v, i) => ({
    slug: v.slug,
    title_uz: v.title.uz,
    title_en: v.title.en,
    track: v.track,
    video_url: v.src,
    duration_seconds: v.minutes * 60,
    order_index: i,
  }))
  ok('video_lessons')(await db.from('video_lessons').upsert(videoRows, { onConflict: 'slug' }))
  console.log(`  ${videoRows.length} video lessons`)

  // -- school ---------------------------------------------------------------
  const existingSchool = ok('find school')(
    await db.from('schools').select('id').eq('name', SCHOOL.name).maybeSingle(),
  )
  const school =
    existingSchool ?? ok('school')(await db.from('schools').insert(SCHOOL).select('id').single())
  console.log(`  school ${SCHOOL.name}`)

  // -- people ---------------------------------------------------------------
  const ids = {}
  for (const person of PEOPLE) {
    ids[person.key] = await upsertUser(person)
    // Service role: sets the real role and binds the profile to the school.
    // Both columns are pinned against self-service by the guard trigger.
    ok(`profile ${person.email}`)(
      await db
        .from('profiles')
        .update({
          full_name: person.full_name,
          role: person.role,
          school_id: school.id,
          grade: person.grade ?? null,
          subject: person.subject ?? null,
          experience: person.experience ?? null,
          school_name: SCHOOL.name,
        })
        .eq('id', ids[person.key]),
    )
  }
  console.log(`  ${PEOPLE.length} accounts (password: ${PASSWORD})`)

  // -- classes --------------------------------------------------------------
  ok('clear classes')(await db.from('classes').delete().eq('school_id', school.id))
  for (const klass of CLASSES) {
    const row = ok(`class ${klass.name}`)(
      await db
        .from('classes')
        .insert({ school_id: school.id, teacher_id: ids[klass.teacher], name: klass.name })
        .select('id')
        .single(),
    )
    ok('enrollments')(
      await db
        .from('class_enrollments')
        .insert(klass.students.map((s) => ({ class_id: row.id, student_id: ids[s] }))),
    )
  }
  console.log(`  ${CLASSES.length} classes`)

  // -- progress -------------------------------------------------------------
  const progress = []
  for (const [key, slugs] of Object.entries(COMPLETED)) {
    for (const slug of slugs) {
      if (!lessonId[slug]) continue
      progress.push({
        student_id: ids[key],
        lesson_id: lessonId[slug],
        status: 'completed',
      })
    }
  }
  if (progress.length) {
    ok('lesson_progress')(
      await db.from('lesson_progress').upsert(progress, { onConflict: 'student_id,lesson_id' }),
    )
  }
  console.log(`  ${progress.length} completed lessons`)

  // -- community ------------------------------------------------------------
  const authorFor = { 'seed-1': 'nodira', 'seed-2': 'sardor', 'seed-3': 'javohir', 'seed-4': 'malika' }
  ok('clear posts')(
    await db.from('community_posts').delete().in('author_id', Object.values(ids)),
  )
  ok('community_posts')(
    await db.from('community_posts').insert(
      SEED_POSTS.map((p) => ({
        author_id: ids[authorFor[p.id] ?? 'nodira'],
        author_name: PEOPLE.find((x) => x.key === (authorFor[p.id] ?? 'nodira')).full_name,
        author_role: p.role,
        title: p.title.uz,
        body: p.body.uz,
        tag: p.tag,
        created_at: daysAgo(p.daysAgo),
      })),
    ),
  )
  console.log(`  ${SEED_POSTS.length} community posts`)

  // -- activity -------------------------------------------------------------
  ok('clear activity')(await db.from('activity_log').delete().in('user_id', Object.values(ids)))
  const events = []
  for (const [key, days] of Object.entries(LAST_ACTIVE_DAYS)) {
    // A short trail behind the most recent event, so "last active" is a real
    // maximum over a history rather than one synthetic row.
    for (const offset of [0, 3, 9]) {
      events.push({
        user_id: ids[key],
        event_type: offset === 0 ? 'session_start' : 'lesson_view',
        occurred_at: daysAgo(days + offset),
      })
    }
  }
  ok('activity_log')(await db.from('activity_log').insert(events))
  console.log(`  ${events.length} activity events`)

  console.log('\nDone. Sign in with any of:')
  for (const p of PEOPLE) console.log(`  ${p.role.padEnd(12)} ${p.email}`)
  console.log(`\nPassword for all of them: ${PASSWORD}`)
}

main().catch((err) => {
  console.error('\nSeed failed:', err.message)
  process.exit(1)
})
