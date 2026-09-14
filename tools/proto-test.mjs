/**
 * Verification harness for the single-file prototype (`prototype/index.html`).
 *
 * Loads it straight off disk over file:// — which is how it is meant to be
 * used — and walks the spec's Definition of Done: router, registration flow,
 * i18n, the verbatim Papert quote, the ripple canvas, responsive breakpoints,
 * and the rule that matters most, that no content is ever left invisible.
 *
 *     node tools/proto-test.mjs
 *
 * Needs network for the two CDNs (Fontsource, cdnjs). Their absence is
 * reported as info rather than failure: the page is required to work without
 * them, and the "content never hidden" checks are what prove it.
 */
import { chromium } from 'playwright'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const URL = pathToFileURL(resolve('prototype/index.html')).href
let pass = 0
let fail = 0
const fails = []
const ck = (n, ok, d = '') => {
  if (ok) { pass++; console.log('  ok   ' + n) }
  else { fail++; fails.push(n + (d ? ' — ' + d : '')); console.log('  FAIL ' + n + (d ? ' — ' + d : '')) }
}

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } })

const errors = []
const badReq = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('requestfailed', (r) => badReq.push((r.failure()?.errorText || 'failed') + ' :: ' + r.url().slice(0, 88)))
page.on('response', (r) => { if (r.status() >= 400) badReq.push(r.status() + ' :: ' + r.url().slice(0, 88)) })

await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2600)

console.log('\n— boot —')
ck('no JS console errors', errors.length === 0, errors.slice(0, 3).join(' | '))
ck('landing is the default page', await page.evaluate(() => document.getElementById('page-landing').classList.contains('active')))
ck('hash normalised to #/', (await page.evaluate(() => location.hash)) === '#/')
ck('default language is Uzbek', (await page.evaluate(() => document.documentElement.lang)) === 'uz')

console.log('\n— assets —')
ck('Manrope actually loaded', await page.evaluate(async () => {
  await document.fonts.ready
  return document.fonts.check('700 16px Manrope')
}))
ck('no failed requests', badReq.length === 0, [...new Set(badReq)].slice(0, 3).join(' | '))

console.log('\n— background effects stay in the background —')
const layers = await page.evaluate(() => {
  const z = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).zIndex : 'missing' }
  return {
    fx: z('#fx'), fxHero: z('#fxHero'), heroIn: z('.hero-in'),
    bgGrid: z('.bg-grid'), bgGlow: z('.bg-glow'), bgLayer: z('.bg-layer'),
    // Nothing decorative may intercept the pointer over real content.
    overCard: (() => {
      const c = document.querySelector('.card-hard')
      if (!c) return 'no card'
      c.scrollIntoView({ block: 'center', behavior: 'instant' })
      const r = c.getBoundingClientRect()
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      return hit && hit.closest('.card-hard') ? 'card' : (hit ? hit.id || hit.tagName : 'none')
    })(),
  }
})
ck('page ripple is behind all content', Number(layers.fx) < 0, 'z=' + layers.fx)
ck('hero ripple is behind hero content', Number(layers.fxHero) < Number(layers.heroIn),
  layers.fxHero + ' vs ' + layers.heroIn)
ck('background layers stay furthest back',
  Number(layers.bgGrid) < Number(layers.fx) && Number(layers.bgGlow) < Number(layers.bgGrid) &&
  Number(layers.bgLayer) < Number(layers.bgGlow),
  JSON.stringify(layers))
ck('nothing decorative covers a card', layers.overCard === 'card', String(layers.overCard))
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))

console.log('\n— content is never hidden —')
const hidden = await page.evaluate(() => {
  const bad = []
  document.querySelectorAll('#page-landing h1,#page-landing h2,#page-landing h3,#page-landing p,#page-landing article')
    .forEach((el) => {
      if (+getComputedStyle(el).opacity < 0.05 && el.offsetParent !== null) bad.push(el.tagName + ':' + el.textContent.slice(0, 22))
    })
  return bad
})
ck('nothing above the fold is invisible', hidden.length === 0, hidden.slice(0, 3).join(' | '))
const emptyKeys = await page.evaluate(() =>
  [...document.querySelectorAll('[data-i18n]')].filter((e) => !e.textContent.trim()).map((e) => e.getAttribute('data-i18n')))
ck('every data-i18n node has text', emptyKeys.length === 0, emptyKeys.slice(0, 5).join(', '))

console.log('\n— Papert quote —')
const q = await page.evaluate(() => document.getElementById('quoteText').textContent)
ck('reproduced verbatim',
  q.startsWith('In many schools today') && q.includes('the child programs the computer') && q.endsWith('intellectual model building.'),
  q.slice(0, 40))
ck('citation intact', (await page.evaluate(() => document.body.innerText)).includes('Mindstorms: Children, Computers, and Powerful Ideas, 1980'))
ck('UZ translation line shows in UZ', await page.evaluate(() => {
  const el = document.querySelector('.quote-trans')
  return !!el && getComputedStyle(el).display !== 'none' && el.textContent.length > 40
}))

console.log('\n— full scroll —')

/**
 * The reveal contract, now that reveals run in BOTH directions.
 *
 * "Nothing is faded after scrolling" stopped being the right invariant the
 * moment elements were allowed to fold away again — everything off-screen is
 * supposed to be hidden, that is the reverse animation working. What must
 * still hold is the safety rule: nothing is ever invisible *while the reader
 * can see it*.
 */
const hiddenOnScreen = () => page.evaluate(() => {
  const h = window.innerHeight
  const top = h * 0.08
  const bottom = h * 0.9
  return [...document.querySelectorAll('#page-landing .card-hard, #page-landing .sec-h2, #page-landing .step')]
    .filter((e) => {
      const r = e.getBoundingClientRect()
      if (!r.height) return false
      return r.bottom > top && r.top < bottom && +getComputedStyle(e).opacity < 0.9
    })
    .map((e) => (e.textContent || '').trim().slice(0, 28))
})

const pageH = await page.evaluate(() => document.body.scrollHeight)
let worstProto = []
for (let y = 0; y < pageH; y += 700) {
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y)
  await page.waitForTimeout(1250)
  const bad = await hiddenOnScreen()
  if (bad.length > worstProto.length) worstProto = bad
}
ck('nothing is invisible while on screen', worstProto.length === 0, worstProto.slice(0, 3).join(' | '))

/**
 * Reveals here are ONE-WAY, by spec (`immediateRender:false, once:true`).
 * The two-way version lives on the site — see the note beside the gear
 * entrance in prototype/index.html for why GSAP cannot do it under that
 * pattern. Once revealed, content must therefore stay revealed.
 */
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
await page.waitForTimeout(1200)
ck('revealed cards stay revealed', (await page.evaluate(() =>
  [...document.querySelectorAll('#features .card-hard')]
    .filter((e) => Number(getComputedStyle(e).opacity) > 0.9).length)) === 6)
ck('every landing section present', (await page.evaluate(() =>
  ['problem', 'features', 'how', 'outcomes', 'quote', 'videos', 'community', 'pricing'].filter((id) => !document.getElementById(id)))).length === 0)

/**
 * The ticker must not tear when scroll velocity changes.
 *
 * It used to be a CSS animation whose `animation-duration` was rewritten from
 * scroll velocity; changing the duration of a running animation makes the
 * browser recompute position as elapsed / new-duration, so every speed change
 * teleported the strip sideways. Position is now integrated in rAF, which
 * makes that jump structurally impossible.
 */
console.log('\n— ticker moves smoothly under scroll —')
const tick = await page.evaluate(async () => {
  const el = document.querySelector('#ticker')
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
    if (d <= 0) deltas.push(Math.abs(d)) // a positive delta is the wrap, not a glitch
  }
  window.scrollTo({ top: 0, behavior: 'instant' })
  return { max: Math.max(...deltas), moved: deltas.reduce((a, b) => a + b, 0) }
})
ck('ticker is actually moving', !tick.error && tick.moved > 20, JSON.stringify(tick))
ck('ticker never jumps when scroll speed changes', !tick.error && tick.max < 40,
  'largest single-frame jump ' + (tick.max ? tick.max.toFixed(1) : '?') + 'px')

console.log('\n— language toggle —')
await page.evaluate(() => document.querySelector('button[data-lang="en"]').click())
await page.waitForTimeout(500)
ck('switches to English', (await page.evaluate(() => document.body.innerText)).includes('no hardware needed'))
ck('html lang follows', (await page.evaluate(() => document.documentElement.lang)) === 'en')
ck('UZ-only line hidden in EN', (await page.evaluate(() => getComputedStyle(document.querySelector('.quote-trans')).display)) === 'none')
ck('quote never translated', (await page.evaluate(() => document.getElementById('quoteText').textContent)) === q)
ck('choice persisted', (await page.evaluate(() => localStorage.getItem('arduinium-lang'))) === 'en')
await page.evaluate(() => document.querySelector('button[data-lang="uz"]').click())
await page.waitForTimeout(400)

console.log('\n— router guard —')
await page.evaluate(() => localStorage.removeItem('arduinium-reg'))
await page.evaluate(() => { location.hash = '#/app' })
await page.waitForTimeout(700)
ck('#/app without a role bounces to #/register', (await page.evaluate(() => location.hash)) === '#/register')
ck('register page shown', await page.evaluate(() => document.getElementById('page-register').classList.contains('active')))

// A save from before the roles were trimmed must not resurrect a dead stub.
await page.evaluate(() => {
  localStorage.setItem('arduinium-reg', JSON.stringify({ role: 'buyer', name: 'X' }))
  location.hash = '#/'
})
await page.waitForTimeout(300)
await page.evaluate(() => { location.hash = '#/app' })
await page.waitForTimeout(600)
ck('a stale removed role is rejected', (await page.evaluate(() => location.hash)) === '#/register')
await page.evaluate(() => localStorage.removeItem('arduinium-reg'))
await page.evaluate(() => { location.hash = '#/register' })
await page.waitForTimeout(400)

// Dark-page presentation: these three were all broken at first pass.
const regLook = await page.evaluate(() => {
  const rt = document.querySelector('.role .rt')
  const rd = document.querySelector('.role .rd')
  const sub = document.querySelector('#page-register .sec-sub')
  /**
   * Handles both serialisations Chrome uses. `rgb()/rgba()` gives 0–255,
   * but a `color-mix()` result comes back as `color(srgb 1 0.988 0.957 / .74)`
   * with 0–1 components — reading that as 0–255 makes cream look black.
   */
  const lum = (c) => {
    const m = (c.match(/[\d.]+/g) || ['0', '0', '0']).map(Number)
    const [r, g, b] = c.startsWith('color(') ? m.slice(1, 4) : m.slice(0, 3).map((v) => v / 255)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  return {
    titleBlock: getComputedStyle(rt).display === 'block' && getComputedStyle(rd).display === 'block',
    sameLine: Math.abs(rt.getBoundingClientRect().top - rd.getBoundingClientRect().top) < 2,
    fillsViewport: document.getElementById('page-register').getBoundingClientRect().height >= window.innerHeight - 1,
    subLum: lum(getComputedStyle(sub).color),
  }
})
ck('role title and description are on separate lines', regLook.titleBlock && !regLook.sameLine)
ck('dark gradient fills the viewport', regLook.fillsViewport)
ck('sub-heading is light on the dark page', regLook.subLum > 0.5, 'luminance ' + regLook.subLum.toFixed(2))

console.log('\n— registration flow —')
// Only student and teacher: buying is open to anyone who registers, and
// school access is granted separately rather than self-served here.
const roles = await page.evaluate(() => [...document.querySelectorAll('.role')].map((r) => r.dataset.role))
ck('exactly two roles offered', roles.length === 2, roles.join(','))
ck('roles are student + teacher', roles.join(',') === 'student,teacher', roles.join(','))
ck('no buyer or school role remains', !/buyer|school/.test(roles.join(',')))

await page.evaluate(() => document.querySelector('.role[data-role="student"]').click())
await page.waitForTimeout(400)
ck('role marked pressed', (await page.evaluate(() => document.querySelector('.role[data-role="student"]').getAttribute('aria-pressed'))) === 'true')
ck('step 2 revealed', await page.evaluate(() => document.getElementById('regStep2').style.display !== 'none'))
ck('student gets 3 fields', (await page.evaluate(() => document.querySelectorAll('#regFields .f').length)) === 3)
ck('grade defaults to 5', (await page.evaluate(() => document.getElementById('rf-grade')?.value)) === '5')

await page.evaluate(() => document.getElementById('regStep2').requestSubmit())
await page.waitForTimeout(400)
ck('empty required blocks submit', await page.evaluate(() => document.getElementById('regStep3').style.display === 'none'))
ck('required field flashes', await page.evaluate(() => !!document.querySelector('.f.bad')))

await page.evaluate(() => { document.getElementById('rf-name').value = 'Ali Valiyev' })
await page.evaluate(() => document.getElementById('regStep2').requestSubmit())
await page.waitForTimeout(500)
ck('success step shown', await page.evaluate(() => document.getElementById('regStep3').style.display !== 'none'))
ck('persisted to localStorage', await page.evaluate(() => {
  const r = JSON.parse(localStorage.getItem('arduinium-reg') || '{}')
  return r.role === 'student' && r.name === 'Ali Valiyev'
}))
ck('role line carries the name', (await page.evaluate(() => document.getElementById('regRoleLine').textContent)).includes('Ali Valiyev'))

await page.evaluate(() => { location.hash = '#/app' })
await page.waitForTimeout(700)
ck('#/app now reachable', await page.evaluate(() => document.getElementById('page-app').classList.contains('active')))
ck('app greets by name', (await page.evaluate(() => document.getElementById('appName').textContent)) === 'Ali Valiyev')
ck('student gets 4 cards', (await page.evaluate(() => document.querySelectorAll('#appBody .app-card').length)) === 4)
ck('simulator card tagged MVP', (await page.evaluate(() => document.getElementById('appBody').innerText)).includes('MVP'))

await page.evaluate(() => { localStorage.setItem('arduinium-reg', JSON.stringify({ role: 'teacher', name: 'N.' })); location.hash = '#/' })
await page.waitForTimeout(300)
await page.evaluate(() => { location.hash = '#/app' })
await page.waitForTimeout(600)
ck('non-student roles get the stub card', (await page.evaluate(() => document.querySelectorAll('#appBody .stub').length)) === 1)

console.log('\n— anchors vs router —')
await page.evaluate(() => { location.hash = '#/' })
await page.waitForTimeout(600)
await page.evaluate(() => [...document.querySelectorAll('.nav-links a')].find((a) => a.getAttribute('href') === '#pricing').click())
await page.waitForTimeout(900)
ck('section anchor scrolls without changing route', await page.evaluate(() => window.scrollY > 600 && location.hash === '#/'))

console.log('\n— ripple canvas —')
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
await page.mouse.click(700, 500)
await page.waitForTimeout(260)
ck('a click paints the ripple', (await page.evaluate(() => {
  const c = document.getElementById('fx')
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
  let n = 0
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++
  return n
})) > 500)

console.log('\n— responsive —')
for (const [w, label, cols] of [[1024, '1024', 2], [820, '820', null], [560, '560', 1]]) {
  await page.setViewportSize({ width: w, height: 900 })
  await page.waitForTimeout(450)
  /**
   * Behavioural check, not a metric one.
   *
   * `documentElement.scrollWidth` stays stale by a few px after shrinking the
   * viewport past the deliberately over-wide ticker band, even though the
   * band is clipped and the page cannot actually be scrolled sideways. What
   * matters to a reader is whether the page moves — so try to move it.
   */
  const r = await page.evaluate(() => {
    window.scrollTo({ left: 9999, top: window.scrollY, behavior: 'instant' })
    const shifted = window.scrollX
    window.scrollTo({ left: 0, top: window.scrollY, behavior: 'instant' })
    return {
      shifted,
      cols: getComputedStyle(document.querySelector('.grid3')).gridTemplateColumns.split(' ').length,
      burger: getComputedStyle(document.getElementById('burger')).display !== 'none',
    }
  })
  ck(label + ': page cannot scroll sideways', r.shifted === 0, 'scrolled ' + r.shifted + 'px')
  if (cols) ck(label + ': grid3 → ' + cols + ' cols', r.cols === cols, 'got ' + r.cols)
  if (label === '820') ck('820: burger appears', r.burger)
}
await page.setViewportSize({ width: 1440, height: 950 })

// `overflow-x: clip` on <html> must not have cost us the sticky header —
// that is the specific trap `overflow: hidden` would have sprung.
await page.evaluate(() => window.scrollTo({ top: 1200, behavior: 'instant' }))
await page.waitForTimeout(350)
ck('nav is still sticky at the top', (await page.evaluate(() => {
  const n = document.getElementById('nav')
  return Math.round(n.getBoundingClientRect().top)
})) === 0)
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))

console.log('\n— reduced motion —')
const rm = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
const rmErr = []
rm.on('pageerror', (e) => rmErr.push(e.message))
await rm.goto(URL, { waitUntil: 'domcontentloaded' })
await rm.waitForTimeout(1600)
ck('reduced-motion: no errors', rmErr.length === 0, rmErr.slice(0, 2).join(' | '))
ck('reduced-motion: content still visible', (await rm.evaluate(() =>
  [...document.querySelectorAll('#page-landing .card-hard')].filter((e) => +getComputedStyle(e).opacity < 0.9).length)) === 0)
ck('reduced-motion: ripple canvas stays blank', (await rm.evaluate(async () => {
  window.dispatchEvent(new PointerEvent('pointerdown', { clientX: 400, clientY: 300, bubbles: true }))
  await new Promise((r) => setTimeout(r, 300))
  const c = document.getElementById('fx')
  const d = c.getContext('2d').getImageData(0, 0, Math.max(1, c.width), Math.max(1, c.height)).data
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return false
  return true
})))
await rm.close()

ck('still no JS console errors', errors.length === 0, errors.slice(0, 3).join(' | '))

// Screenshots for eyeballing. `networkidle` here (not earlier) because the
// external thumbnails are ~1 MB each and we want them actually painted.
try {
  await page.evaluate(() => { localStorage.removeItem('arduinium-reg'); location.hash = '#/' })
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(1200)
  await page.screenshot({ path: 'shots/proto-hero.png' })
  await page.evaluate(() => { location.hash = '#/register' })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'shots/proto-register.png' })
  console.log('\nshots/proto-hero.png, shots/proto-register.png written')
} catch (e) {
  console.log('\nscreenshots skipped: ' + e.message)
}

console.log('\n' + pass + '/' + (pass + fail) + ' passed')
if (fail) { console.log('\nfailures:'); fails.forEach((f) => console.log('  - ' + f)) }
await browser.close()
if (fail) process.exit(1)
