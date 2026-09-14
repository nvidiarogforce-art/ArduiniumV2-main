/**
 * Verification harness for the Next.js site.
 *
 * Sibling to the nine sandbox harnesses in this folder, and it follows their
 * conventions: swiftshader for WebGL under headless, synthetic clicks rather
 * than `page.click()` (see the note in ARCHITECTURE.md about the full-bleed canvas
 * starving Playwright's post-click settle-wait), and a plain pass/fail tally.
 *
 * Unlike the others it loads a *running dev server* rather than
 * `dist-single/index.html`, so start one first:
 *
 *     npx next dev --port 3200
 *     node tools/web-test.mjs [baseUrl]
 */
import { chromium } from 'playwright'

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

const ROUTES = [
  ['/', 'landing'],
  ['/register', 'register'],
  ['/pricing', 'pricing'],
  ['/learn', 'learn dashboard'],
  ['/learn/lessons', 'lesson catalogue'],
  ['/learn/lessons/led-yoqish', 'lesson detail'],
  ['/learn/videos', 'videos'],
  ['/community', 'community'],
  ['/teach', 'teach stub'],
  ['/teach/training', 'training stub'],
  ['/account', 'account stub'],
]

const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

/** Console errors, collected per-navigation. */
let consoleErrors = []
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text())
})
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
page.on('response', (response) => {
  if (response.status() >= 400) consoleErrors.push(`http ${response.status()}: ${response.url()}`)
})

// ---------------------------------------------------------------- routes
console.log('\n— routes render, no console errors —')
for (const [route, label] of ROUTES) {
  consoleErrors = []
  const res = await page.goto(BASE + route, { waitUntil: 'networkidle' })
  check(`${label} responds 200`, res && res.status() === 200, res ? `got ${res.status()}` : 'no response')

  const bodyText = await page.evaluate(() => document.body.innerText.trim().length)
  check(`${label} renders content`, bodyText > 120, `${bodyText} chars`)

  // Next's dev overlay logs a benign hydration notice on some builds; only
  // real errors are interesting.
  const real = consoleErrors.filter((e) => !/Download the React DevTools/i.test(e))
  check(`${label} console clean`, real.length === 0, real.slice(0, 2).join(' | '))
}

// --------------------------------------------------- page scroll is intact
console.log('\n— the sandbox stylesheet does not leak —')
await page.goto(BASE + '/learn/simulator', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

const onSandbox = await page.evaluate(() => ({
  htmlOverflow: getComputedStyle(document.documentElement).overflow,
  hasClass: document.documentElement.classList.contains('ard-sandbox-page'),
}))
check('sandbox route locks page scroll', onSandbox.htmlOverflow === 'hidden', onSandbox.htmlOverflow)
check('sandbox route sets its html class', onSandbox.hasClass)

// Client-side navigation away must undo it. This is the regression that would
// silently break every marketing page, so it is checked by navigating in-app
// (a full reload would hide the bug by rebuilding the document).
await page.evaluate(() => {
  const link = [...document.querySelectorAll('a')].find((a) => a.getAttribute('href') === '/learn/lessons')
  link?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(1200)

const afterLeaving = await page.evaluate(() => ({
  path: location.pathname,
  htmlOverflow: getComputedStyle(document.documentElement).overflow,
  bodyOverflow: getComputedStyle(document.body).overflow,
  hasClass: document.documentElement.classList.contains('ard-sandbox-page'),
  scrollable: document.documentElement.scrollHeight > window.innerHeight,
}))
check('client-nav away from sandbox', afterLeaving.path === '/learn/lessons', afterLeaving.path)
check('page scroll restored on leave', afterLeaving.htmlOverflow !== 'hidden', afterLeaving.htmlOverflow)
check('body scroll restored on leave', afterLeaving.bodyOverflow !== 'hidden', afterLeaving.bodyOverflow)
check('html class removed on leave', afterLeaving.hasClass === false)

// Buttons must keep their borders: src/styles.css resets `button` and its
// rules are unlayered, which outranks every Tailwind layer if left unscoped.
const borderOk = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('a,button')].find((el) =>
    getComputedStyle(el).boxShadow.includes('rgb(28, 53, 71)'),
  )
  if (!btn) return { found: false }
  const cs = getComputedStyle(btn)
  return { found: true, borderWidth: cs.borderTopWidth, boxShadow: cs.boxShadow }
})
check('hard-shadow buttons keep their border', borderOk.found && borderOk.borderWidth === '2px', JSON.stringify(borderOk))

// ------------------------------------------------------- the sandbox runs
console.log('\n— the 3D sandbox runs inside Next —')
consoleErrors = []
await page.goto(BASE + '/learn/simulator?lesson=led-yoqish', { waitUntil: 'networkidle' })
await page.waitForFunction(() => typeof window.__ARDUINIUM__ === 'function', { timeout: 45000 })
await page.waitForTimeout(2500)

const sandbox = await page.evaluate(() => {
  const c = document.querySelector('.stage-wrap canvas')
  const gl = c && (c.getContext('webgl2') || c.getContext('webgl'))
  return {
    summary: window.__ARDUINIUM__(),
    canvas: c ? { w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight } : null,
    glOk: !!gl,
    hooks: Object.keys(window).filter((k) => k.startsWith('__ARDUINIUM')).length,
  }
})

check('workshop mounted (debug hooks present)', sandbox.hooks >= 12, `${sandbox.hooks} hooks`)
check('WebGL context acquired', sandbox.glOk)
check(
  'canvas sized to its container',
  !!sandbox.canvas && sandbox.canvas.cw > 600 && sandbox.canvas.ch > 300,
  JSON.stringify(sandbox.canvas),
)
check('build store reachable', !!sandbox.summary && sandbox.summary.mission === 'sandbox')

/**
 * Load a template and actually drive it.
 *
 * This is the check that matters. It exercises the snap matrix, the mount
 * chain, the pin map, the interpreter and the physics step — i.e. every part
 * of the simulation layer this integration could have disturbed — and it is
 * the same scenario `tools/shot.mjs drive` runs against the standalone build,
 * so the two are directly comparable.
 *
 * Dispatched clicks rather than page.click(), per the note in ARCHITECTURE.md.
 */
const tap = async (sel) => { await page.locator(sel).first().dispatchEvent('click') }

await tap('[data-testid="skip-onboarding"]')
await page.waitForTimeout(400)
await tap('[data-testid="templates"]')
await page.waitForTimeout(250)
await tap('[data-template="rover"]')
await page.waitForTimeout(1600)

const built = await page.evaluate(() => window.__ARDUINIUM__())
check('rover template assembles', built.parts === 18 && built.bolts === 8, JSON.stringify({ parts: built.parts, bolts: built.bolts }))
check('pin map resolves through the resistor, L293D and sensor harness', Object.keys(built.pinMap).length === 6, JSON.stringify(built.pinMap))

await tap('[data-testid="run"]')
await page.waitForTimeout(9000)
const ran = await page.evaluate(() => window.__ARDUINIUM__())
const travelled = Math.hypot(ran.robotPos[0] - built.robotPos[0], ran.robotPos[2] - built.robotPos[2])

// "A sane positive number, not ~0 and not huge" — ARCHITECTURE.md's own criterion
// for this being a real physics run rather than a stuck or exploded one.
check('rover drives on physics', travelled > 0.5 && travelled < 60, `travelled ${travelled.toFixed(2)}`)
check('sensor reads through the wiring', ran.distance > 0, `distance ${ran.distance}`)
check('program produced serial output', ran.serial > 0, `${ran.serial} lines`)

// The lesson chrome is site code wrapped around the sandbox, not part of it.
const chrome = await page.evaluate(() => document.body.innerText)
check('lesson context shown in chrome', /LED/i.test(chrome), chrome.slice(0, 90))

const realErrors = consoleErrors.filter(
  (e) => !/Download the React DevTools/i.test(e) && !/WebGL|SwiftShader|GroupMarkerNotSet/i.test(e),
)
check('sandbox route console clean', realErrors.length === 0, realErrors.slice(0, 2).join(' | '))

// ------------------------------------------------------------------ i18n
console.log('\n— UZ/EN toggle —')
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
const uzText = await page.evaluate(() => document.body.innerText)
check('defaults to Uzbek', /Arduino/.test(uzText) && /kerak emas|O‘quvchi|Narxlar/.test(uzText))

// Scroll the whole page first, so every reveal has been shown once. Switching
// language afterwards is the case that used to break.
/**
 * `behavior: 'instant'` is required, not tidiness.
 *
 * `globals.css` sets `html { scroll-behavior: smooth }` for anchor links, and
 * that applies to programmatic scrolling too. A plain `window.scrollTo(0, y)`
 * therefore *animates*, a stepping loop outruns it, and the page never
 * actually reaches the bottom. A human dragging a scrollbar is unaffected;
 * only scripted scrolling sees this.
 */
const scrollTo = (y) => page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y)

/**
 * The reveal contract, now that reveals run in BOTH directions.
 *
 * "Nothing is faded after scrolling" stopped being the right invariant the
 * moment elements were allowed to fold away again — everything off-screen is
 * supposed to be hidden. What must still hold is the safety rule: nothing is
 * ever invisible *while the reader can see it*.
 *
 * The band mirrors the observer's rootMargin (-8% top, -10% bottom): an
 * element overlapping it must be opaque.
 */
const hiddenOnScreen = () =>
  page.evaluate(() => {
    const h = window.innerHeight
    const top = h * 0.08
    const bottom = h * 0.9
    return [...document.querySelectorAll('.ard-rise, .ard-words, .ard-gear')]
      .filter((el) => {
        const r = el.getBoundingClientRect()
        if (r.height === 0) return false
        const overlaps = r.bottom > top && r.top < bottom
        return overlaps && Number(getComputedStyle(el).opacity) < 0.9
      })
      .map((el) => `${el.className.split(' ')[0]}:${(el.textContent || '').trim().slice(0, 28)}`)
  })

const pageHeight = await page.evaluate(() => document.body.scrollHeight)
let worst = []
for (let y = 0; y < pageHeight; y += 700) {
  await scrollTo(y)
  await page.waitForTimeout(1250) // let the longest reveal (0.95s) settle
  const bad = await hiddenOnScreen()
  if (bad.length > worst.length) worst = bad
}
check('nothing is invisible while on screen', worst.length === 0, worst.slice(0, 3).join(' | '))

await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().toLowerCase() === 'en')
  btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(700)
const enText = await page.evaluate(() => document.body.innerText)
check('switches to English', /owning an Arduino|Pricing|Sandbox/.test(enText), enText.slice(0, 90))
check('html lang follows locale', (await page.evaluate(() => document.documentElement.lang)) === 'en')

/**
 * Regression: locale-derived React keys.
 *
 * Keying a list on its own translated text changes the key on every language
 * switch, so React unmounts and remounts each <Reveal>. The fresh instance
 * measures itself off-screen, returns to hidden, and whole sections the
 * reader is looking at go blank until they scroll past them again. This
 * caught it: the English landing page lost three feature cards and both
 * outcome columns.
 */
const blankAfterSwitch = await hiddenOnScreen()
check(
  'sections stay visible across a language switch',
  blankAfterSwitch.length === 0,
  blankAfterSwitch.slice(0, 3).join(' | '),
)

/**
 * Reveals must actually run BOTH ways — content folds back as it leaves, so
 * scrolling up empties the page the way scrolling down filled it.
 */
console.log('\n— reveals run in reverse —')
await scrollTo(0)
await page.waitForTimeout(700)
const featuresTop = await page.evaluate(() => {
  const el = document.getElementById('features')
  return el ? el.getBoundingClientRect().top + window.scrollY : 0
})
await scrollTo(featuresTop + 200)
await page.waitForTimeout(1300)
const shownAtFeatures = await page.evaluate(
  () => [...document.querySelectorAll('#features .ard-gear')].filter((e) => Number(getComputedStyle(e).opacity) > 0.9).length,
)
check('feature cards appear on the way down', shownAtFeatures >= 3, String(shownAtFeatures))

await scrollTo(0)
await page.waitForTimeout(1300)
const hiddenAfterLeaving = await page.evaluate(
  () => [...document.querySelectorAll('#features .ard-gear')].filter((e) => Number(getComputedStyle(e).opacity) < 0.2).length,
)
check('and fold away again on the way back up', hiddenAfterLeaving >= 3, String(hiddenAfterLeaving))

// The gear entrance is a rotation, not just a slide.
const gearHidden = await page.evaluate(() => {
  const el = document.querySelector('#features .ard-gear')
  if (!el) return null
  const cs = getComputedStyle(el)
  return { transform: cs.transform, gx: cs.getPropertyValue('--ard-gx').trim(), gr: cs.getPropertyValue('--ard-gr').trim() }
})
check(
  'gear cards carry a rotation and an edge offset',
  !!gearHidden && /-?\d+deg/.test(gearHidden.gr) && /-?\d+px/.test(gearHidden.gx) && gearHidden.transform !== 'none',
  JSON.stringify(gearHidden),
)

const enSections = await page.evaluate(() => document.body.innerText)
check(
  'all six feature cards present in English',
  ['Virtual sandbox', 'Lessons in Uzbek', 'Video lessons', 'Community', 'Teacher track', 'Badges & progress']
    .every((s) => enSections.includes(s)),
  enSections.slice(0, 80),
)

// Decoration must stay decoration: the background layers are fixed, behind
// the document, and must never be what the pointer lands on.
const backdrop = await page.evaluate(() => {
  const z = (s) => { const e = document.querySelector(s); return e ? Number(getComputedStyle(e).zIndex) : NaN }
  const card = document.querySelector('main article, main .ard-tilt, main section div')
  let over = 'none'
  if (card) {
    card.scrollIntoView({ block: 'center', behavior: 'instant' })
    const r = card.getBoundingClientRect()
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    over = hit ? (hit.closest('.ard-fx, .ard-bg-grid, .ard-bg-glow, .ard-bg-layer') ? 'BACKDROP' : 'content') : 'none'
  }
  return { fx: z('.ard-fx'), grid: z('.ard-bg-grid'), glow: z('.ard-bg-glow'), layer: z('.ard-bg-layer'), over }
})
check('page ripple sits behind all content', backdrop.fx < 0, 'z=' + backdrop.fx)
check(
  'background layers stack behind the ripple',
  backdrop.grid < backdrop.fx && backdrop.glow < backdrop.grid && backdrop.layer < backdrop.glow,
  JSON.stringify(backdrop),
)
check('backdrop never receives the pointer', backdrop.over === 'content', backdrop.over)
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))

// -------------------------------------------------------------- responsive
/**
 * The ticker must not tear when scroll velocity changes.
 *
 * The original version drove the marquee with a CSS animation and rewrote its
 * `animation-duration` from scroll velocity. Changing the duration of a
 * running animation makes the browser recompute position as
 * elapsed ÷ new-duration, so every speed change teleported the strip
 * sideways — at speed, a visible glitch. Position is now integrated in rAF,
 * which makes a jump structurally impossible.
 *
 * This provokes hard velocity swings and measures per-frame travel. A
 * duration-recompute jumps by hundreds of pixels; honest motion at the
 * capped speed (330px/s) cannot exceed ~17px even on a slow 50ms frame.
 */
console.log('\n— ticker moves smoothly under scroll —')
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

const ticker = await page.evaluate(async () => {
  const el = document.querySelector('.ard-ticker-track')
  if (!el) return { error: 'no ticker' }
  const x = () => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41

  const deltas = []
  let prev = x()
  for (let i = 0; i < 70; i++) {
    window.scrollBy({ top: i % 2 ? 420 : -300, behavior: 'instant' })
    await new Promise((r) => requestAnimationFrame(r))
    const cur = x()
    const d = cur - prev
    prev = cur
    // A positive delta is the seamless wrap-around, not a glitch.
    if (d <= 0) deltas.push(Math.abs(d))
  }
  window.scrollTo({ top: 0, behavior: 'instant' })
  const moved = deltas.reduce((a, b) => a + b, 0)
  return { max: Math.max(...deltas), moved, frames: deltas.length }
})

check('ticker is actually moving', !ticker.error && ticker.moved > 20, JSON.stringify(ticker))
check(
  'ticker never jumps when scroll speed changes',
  !ticker.error && ticker.max < 40,
  `largest single-frame jump ${ticker.max?.toFixed?.(1)}px`,
)

console.log('\n— registration offers two roles —')
await page.goto(BASE + '/register', { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
const regRoles = await page.evaluate(() =>
  [...document.querySelectorAll('.ard-role')].map((b) => b.textContent || ''))
check('exactly two roles', regRoles.length === 2, String(regRoles.length))
check(
  'no buyer or school-rep role',
  !/xarid|buy|maktab vakil|school rep/i.test(regRoles.join(' ')),
  regRoles.join(' | ').slice(0, 90),
)

console.log('\n— responsive —')
for (const [w, h, label] of [
  [390, 844, 'mobile'],
  [768, 1024, 'tablet'],
]) {
  await page.setViewportSize({ width: w, height: h })
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const overflow = await page.evaluate(() => ({
    docW: document.documentElement.scrollWidth,
    winW: window.innerWidth,
  }))
  check(
    `${label} has no horizontal overflow`,
    overflow.docW <= overflow.winW + 1,
    `${overflow.docW} > ${overflow.winW}`,
  )
}

await browser.close()

console.log(`\n${pass}/${pass + fail} passed`)
if (fail) {
  console.log('\nfailures:')
  failures.forEach((f) => console.log('  - ' + f))
  process.exit(1)
}
