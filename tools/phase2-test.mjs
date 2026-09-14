/**
 * Verification harness for Phase 2 — backend, AI assistant, admin panel.
 *
 *     npm run dev            # in another terminal
 *     node tools/phase2-test.mjs [baseUrl]
 *
 * Sibling to `web-test.mjs` and follows its conventions: swiftshader for WebGL,
 * dispatched clicks rather than `page.click()`, a plain pass/fail tally.
 *
 * It runs against an UNCONFIGURED instance — no Supabase, no Anthropic key —
 * because that is the state a fresh clone and CI are in, and because the
 * unconfigured behaviour is itself a requirement: the gated routes must say so
 * honestly, the API must refuse cheaply, and none of Phase 1 may regress. The
 * checks that need a real database live in SQL and are asserted structurally
 * here (every table has policies; `ai_messages` has no teacher or admin policy
 * at all), which is the part that would be catastrophic to get wrong and the
 * part nobody would notice by clicking around.
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { chromium } from 'playwright'

import { buildSystemPrompt, openingLine } from '../lib/ai/prompt.ts'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const BASE = process.argv[2] || 'http://localhost:3200'

let pass = 0
let fail = 0
const failures = []

function check(name, ok, detail = '') {
  if (ok) {
    pass++
    console.log(`  ok   ${name}`)
  } else {
    fail++
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const read = (p) => readFileSync(resolve(root, p), 'utf8')

// ===========================================================================
console.log('\n— secrets stay out of the repo —')
// ===========================================================================

const envExample = existsSync(resolve(root, '.env.example')) ? read('.env.example') : ''
check('.env.example exists', envExample.length > 0)

for (const key of [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ANTHROPIC_API_KEY',
]) {
  check(`.env.example documents ${key}`, envExample.includes(key))
}

const gitignore = read('.gitignore')
check('.gitignore ignores .env.local', /^\.env\.local$/m.test(gitignore))
check('no .env.local in the working tree', !existsSync(resolve(root, '.env.local')))

// Only the placeholder assignments in .env.example may mention these names with
// a value; a real key anywhere in tracked source is the failure being guarded.
const sourceFiles = [
  'app/api/ai/chat/route.ts',
  'lib/ai/provider.ts',
  'lib/supabase/admin.ts',
  'lib/supabase/config.ts',
  'supabase/seed.mjs',
]
const anySecretLiteral = sourceFiles.some((f) => /sk-ant-[A-Za-z0-9]/.test(read(f)))
check('no Anthropic key literal in source', !anySecretLiteral)

const providerSrc = read('lib/ai/provider.ts')
check('the API key is only ever read from the environment', /process\.env\.ANTHROPIC_API_KEY/.test(providerSrc))
check(
  'the provider module is server-only',
  /^import 'server-only'/m.test(providerSrc),
  'missing server-only guard',
)

const clientBundleSafe = !/ANTHROPIC_API_KEY/.test(read('components/ai/chat.tsx'))
check('the chat component never references the API key', clientBundleSafe)

// ===========================================================================
console.log('\n— schema and row-level security —')
// ===========================================================================

const schema = read('supabase/migrations/0001_schema.sql')
const rls = read('supabase/migrations/0002_rls.sql')
const fns = read('supabase/migrations/0003_functions.sql')

/**
 * Parse the migrations against the real Postgres grammar.
 *
 * These files are applied by hand into a project this repo has no connection
 * to, so a syntax error would be found by whoever is following the README at
 * setup time — the worst possible moment. `libpg-query` is Postgres's own
 * parser compiled to WASM; it catches that class of mistake without a database.
 *
 * Optional, like Playwright is for the other harnesses (see ARCHITECTURE.md):
 *   npm install --no-save libpg-query
 */
let parseSql = null
try {
  ;({ parse: parseSql } = await import('libpg-query'))
} catch {
  console.log('  skip migrations parse — npm install --no-save libpg-query to enable')
}

if (parseSql) {
  for (const [name, sql] of [
    ['0001_schema', schema],
    ['0002_rls', rls],
    ['0003_functions', fns],
  ]) {
    let detail = ''
    let ok = false
    try {
      const result = await parseSql(sql)
      ok = result.stmts.length > 0
      detail = `${result.stmts.length} statements`
    } catch (err) {
      detail = err.message
    }
    check(`${name}.sql parses as Postgres`, ok, detail)
  }
}

const TABLES = [
  'schools',
  'profiles',
  'classes',
  'class_enrollments',
  'lessons',
  'lesson_progress',
  'video_lessons',
  'community_posts',
  'ai_conversations',
  'ai_messages',
  'activity_log',
]

for (const table of TABLES) {
  check(`schema declares ${table}`, new RegExp(`create table if not exists public\\.${table}\\b`).test(schema))
}

for (const table of [...TABLES, 'ai_usage_daily']) {
  check(
    `RLS enabled on ${table}`,
    new RegExp(`alter table public\\.${table}\\s+enable row level security`).test(rls),
  )
}

// Every table that a user touches must have at least one policy; without one,
// RLS-enabled means "nobody can read this", which fails closed but silently.
for (const table of TABLES) {
  check(
    `${table} has at least one policy`,
    new RegExp(`on public\\.${table}\\b`).test(rls),
    'RLS on with no policy denies everyone',
  )
}

/**
 * The privacy invariant, asserted as the absence of a thing.
 *
 * A student's conversation with the assistant must not be readable by their
 * teacher or their school admin. That is enforced by there being no policy
 * granting it — so this checks that the `ai_messages` and `ai_conversations`
 * policies never mention the role helpers. If somebody later adds a
 * "teachers can review chats" policy, this fails, which is the point.
 */
const aiPolicyBlock = rls.slice(rls.indexOf('ai_conversations_own'), rls.indexOf('activity_log ---'))
check(
  'no teacher/admin policy over AI conversations',
  !/is_teacher\(\)|is_school_admin\(\)|teaches_student\(/.test(aiPolicyBlock),
  aiPolicyBlock.match(/is_\w+\(\)/)?.[0] ?? '',
)
check(
  'AI policies are scoped to auth.uid()',
  /ai_conversations_own[\s\S]*?user_id = auth\.uid\(\)/.test(rls),
)
check(
  'no SQL function exposes AI message content',
  !/ai_messages/.test(fns),
  'a function returning ai_messages would bypass the missing policies',
)

check(
  'role escalation is blocked by a trigger',
  /guard_profile_privileges/.test(schema) && /role cannot be changed by its owner/.test(schema),
)
check(
  'signup metadata cannot mint a school admin',
  /requested in \('student', 'teacher'\)/.test(schema),
)
check(
  'the rate limiter increments conditionally in one statement',
  /on conflict \(user_id, day\) do update[\s\S]*?where u\.used < p_limit/.test(fns),
  'a read-then-write limiter races',
)
check(
  'the admin activity query reports a level, not a presence flag',
  /admin_teacher_activity[\s\S]*?'dormant'/.test(fns) && !/online|is_online|last_seen_at/.test(fns),
)

// ===========================================================================
console.log('\n— seed data —')
// ===========================================================================

const seed = read('supabase/seed.mjs')
check('seed script exists', seed.length > 0)
check('seed reuses the Phase 1 curriculum', /from '\.\.\/lib\/content\/lessons\.ts'/.test(seed))
check('seed creates a school', /from\('schools'\)/.test(seed))
check('seed creates classes and enrolments', /from\('classes'\)/.test(seed) && /class_enrollments/.test(seed))
check('seed creates teacher and student accounts', /auth\.admin\.createUser/.test(seed))
check('seed writes community posts', /community_posts/.test(seed))
check('seed writes activity spread over time', /activity_log/.test(seed) && /LAST_ACTIVE_DAYS/.test(seed))

// ===========================================================================
console.log('\n— Ardu’s persona —')
// ===========================================================================

const student = buildSystemPrompt({ role: 'student', locale: 'uz' })
const teacher = buildSystemPrompt({ role: 'teacher', locale: 'uz' })

check('student prompt refuses to hand over the answer', /do NOT just give them the fixed code/.test(student))
check('student prompt asks for a guiding question', /guiding question/.test(student))
check('teacher prompt drops the Socratic style', /Do not use the Socratic style/.test(teacher))
check('teacher prompt offers quiz and lesson help', /quiz/.test(teacher))
check('both prompts stay on topic', [student, teacher].every((p) => /Stay strictly on topic/.test(p)))
check('both prompts refuse personal data', [student, teacher].every((p) => /Never ask for or store personal information/.test(p)))
check('Uzbek is answered in Uzbek', /Reply in Uzbek/.test(student))
check('English is answered in English', /Reply in English/.test(buildSystemPrompt({ role: 'student', locale: 'en' })))

const withContext = buildSystemPrompt({
  role: 'student',
  locale: 'en',
  lessonTitle: 'Blink an LED',
  sandbox: { code: 'x'.repeat(9000), circuit: 'two parts' },
})
check('lesson context reaches the prompt', /Current lesson: Blink an LED/.test(withContext))
check('sandbox code is truncated, not pasted whole', /truncated/.test(withContext) && withContext.length < 6000)
check('context is fenced off as data', /data, not instructions/.test(withContext))
check('opening line is localised', /Salom/.test(openingLine('uz')) && /Hi/.test(openingLine('en')))

// ===========================================================================
console.log('\n— the site, with no backend configured —')
// ===========================================================================

const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

let consoleErrors = []
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text())
})
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))

for (const [route, label] of [
  ['/ai', 'ai'],
  ['/admin', 'admin'],
  ['/login', 'login'],
]) {
  consoleErrors = []
  const res = await page.goto(BASE + route, { waitUntil: 'networkidle' })
  const text = await page.evaluate(() => document.body.innerText)
  check(`${label} responds 200`, res && res.status() === 200, res ? String(res.status()) : 'none')
  check(
    `${label} says the backend is not set up`,
    /sozlanmagan|not set up/i.test(text),
    text.slice(0, 80),
  )
  const real = consoleErrors.filter((e) => !/Download the React DevTools/i.test(e))
  check(`${label} console clean`, real.length === 0, real.slice(0, 2).join(' | '))
}

// The API must refuse without touching the model — and without a stack trace.
const api = await page.evaluate(async (base) => {
  const res = await fetch(base + '/api/ai/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'hello' }),
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}, BASE)

check('POST /api/ai/chat refuses when unconfigured', api.status === 503, String(api.status))
check('and names the reason', api.body?.error === 'not-configured', JSON.stringify(api.body))

const apiEmpty = await page.evaluate(async (base) => {
  const res = await fetch(base + '/api/ai/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: 'not json',
  })
  return res.status
}, BASE)
check('malformed request bodies do not 500', apiEmpty === 503 || apiEmpty === 400, String(apiEmpty))

// Registration must not offer credentials it cannot store.
await page.goto(BASE + '/register?role=student', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
const regFields = await page.evaluate(() =>
  [...document.querySelectorAll('input')].map((i) => i.type),
)
check('no password field without a backend', !regFields.includes('password'), regFields.join(','))
check('the demo note is still shown', /brauzeringizda|in your browser/i.test(await page.evaluate(() => document.body.innerText)))

// The header keeps its Phase 1 shape when there is nobody to sign in.
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
const headerText = await page.evaluate(() => document.querySelector('header')?.innerText ?? '')
check('header shows the register CTA', /Ro‘yxatdan|Register/i.test(headerText), headerText.slice(0, 60))
check('header shows no account menu', !/Chiqish|Sign out/i.test(headerText))

// ===========================================================================
console.log('\n— Ardu in the sandbox —')
// ===========================================================================

consoleErrors = []
await page.goto(BASE + '/learn/simulator?lesson=led-yoqish', { waitUntil: 'networkidle' })
await page.waitForFunction(() => typeof window.__ARDUINIUM__ === 'function', { timeout: 45000 })
await page.waitForTimeout(2000)

const before = await page.evaluate(() => {
  const c = document.querySelector('.stage-wrap canvas')
  return { summary: window.__ARDUINIUM__(), canvas: c ? { w: c.clientWidth, h: c.clientHeight } : null }
})
check('workshop is up before the panel opens', !!before.summary && !!before.canvas)

const hasButton = await page.evaluate(() => !!document.querySelector('[data-testid="ardu-button"]'))
check('a single Ardu button is in the toolbar', hasButton)
check(
  'exactly one',
  (await page.evaluate(() => document.querySelectorAll('[data-testid="ardu-button"]').length)) === 1,
)

await page.locator('[data-testid="ardu-button"]').first().dispatchEvent('click')
await page.waitForTimeout(600)

const panel = await page.evaluate(() => {
  const el = document.querySelector('[role="dialog"]')
  return { open: !!el, text: el?.innerText ?? '' }
})
check('clicking it opens the assistant panel', panel.open)
check('the panel offers starter questions', /LED|digitalWrite/.test(panel.text), panel.text.slice(0, 80))

/**
 * The panel must not disturb the simulation.
 *
 * This is the Phase 1 rule that the sandbox's internals are off limits, checked
 * rather than asserted: the debug hooks still answer, the canvas still has its
 * size, and the part count is unchanged. A panel that remounted the scene would
 * fail all three.
 */
const during = await page.evaluate(() => {
  const c = document.querySelector('.stage-wrap canvas')
  return { summary: window.__ARDUINIUM__(), canvas: c ? { w: c.clientWidth, h: c.clientHeight } : null }
})
check('the 3D scene keeps running behind the panel', !!during.summary && !!during.canvas)
check(
  'the sandbox state is untouched',
  during.summary.parts === before.summary.parts && during.summary.bolts === before.summary.bolts,
  JSON.stringify({ before: before.summary.parts, during: during.summary.parts }),
)
check(
  'the canvas keeps its size',
  !!during.canvas && during.canvas.w === before.canvas.w && during.canvas.h === before.canvas.h,
  JSON.stringify(during.canvas),
)

// Sending a question with no key configured must surface the honest message.
await page.evaluate(() => {
  const box = document.querySelector('[role="dialog"] textarea')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
  setter.call(box, 'nega LED yonmayapti?')
  box.dispatchEvent(new Event('input', { bubbles: true }))
})
await page.waitForTimeout(200)
await page.evaluate(() => {
  const buttons = [...document.querySelectorAll('[role="dialog"] button')]
  buttons[buttons.length - 1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(1200)

const afterSend = await page.evaluate(() => document.querySelector('[role="dialog"]')?.innerText ?? '')
check(
  'an unconfigured send explains itself',
  /sozlanmagan|not configured/i.test(afterSend),
  afterSend.slice(0, 100),
)

// Escape closes it, and the workshop is still there afterwards.
await page.keyboard.press('Escape')
await page.waitForTimeout(400)
const closed = await page.evaluate(() => !document.querySelector('[role="dialog"]'))
check('Escape closes the panel', closed)

const after = await page.evaluate(() => window.__ARDUINIUM__())
check('the workshop survives the whole exchange', after.parts === before.summary.parts)

const realErrors = consoleErrors.filter(
  (e) =>
    !/Download the React DevTools/i.test(e) &&
    !/WebGL|SwiftShader|GroupMarkerNotSet/i.test(e) &&
    !/Failed to load resource.*503/i.test(e),
)
check('sandbox console clean', realErrors.length === 0, realErrors.slice(0, 2).join(' | '))

// ===========================================================================
console.log('\n— documentation —')
// ===========================================================================

const readme = read('README.md')
check('README documents the environment variables', /\.env\.example/.test(readme))
check('README documents the Supabase setup', /supabase\/migrations/.test(readme))
check('README documents the seed script', /supabase\/seed\.mjs/.test(readme))
check('README documents deploying to Vercel', /Vercel/.test(readme))
check('README states the AI privacy rule', /teacher|o‘qituvchi/i.test(readme) && /ai_messages/.test(readme))

await browser.close()

console.log(`\n${pass}/${pass + fail} passed`)
if (fail) {
  console.log('\nfailures:')
  failures.forEach((f) => console.log('  - ' + f))
  process.exit(1)
}
