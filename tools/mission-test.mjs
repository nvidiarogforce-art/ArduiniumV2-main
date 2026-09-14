/**
 * Every mission is winnable — proven by driving, not asserted by hope.
 *
 *   npx vite build --mode single
 *   node tools/mission-test.mjs
 *
 * For each mission this loads the rover template through the UI (the same
 * clicks a student makes), swaps in a scripted program, presses Run, and
 * polls __ARDUINIUM__() until the mission reports won or the clock runs out.
 * followLine is also proven the other way round: driving straight at where
 * the flag WOULD be without touching the ring must NOT win.
 *
 * These are physics tests under swiftshader, so budgets are generous; what is
 * asserted is the outcome, never the time it took. State is re-read on every
 * poll — getState() is a snapshot (see CLAUDE.md).
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const here = path.dirname(fileURLToPath(import.meta.url))
const url = 'file://' + path.resolve(here, '..', 'dist-single', 'index.html') + '?quality=high'

const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } })
page.setDefaultTimeout(15000)
const errs = []
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errs.push('console: ' + m.text())
})

const results = []
const check = (name, ok, detail = '') =>
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)

await page.goto(url, { waitUntil: 'load' })
await page.waitForSelector('canvas')
await page.waitForTimeout(2400)

const tap = async (sel) => {
  await page.locator(sel).first().dispatchEvent('click')
  await page.waitForTimeout(300)
}
await tap('[data-testid="skip-onboarding"]')

const state = () => page.evaluate(() => window.__ARDUINIUM__())

/** Load the rover fresh, arm a mission, swap the program, Run, poll for a win. */
async function runMission(missionId, program, budgetMs) {
  // Stop any previous run first, then rebuild from the template so every
  // mission starts from the same rover at the same spot.
  await page.evaluate(() => {
    const b = window.__ARDUINIUM_BUILD__()
    if (b.running) b.toggleRun()
  })
  await page.waitForTimeout(400)
  await tap('[data-testid="templates"]')
  await tap('[data-template="rover"]')
  await page.waitForTimeout(600)
  await tap('[data-testid="missions"]')
  await tap(`[data-mission="${missionId}"]`)
  await page.waitForTimeout(400)
  await page.evaluate((p) => window.__ARDUINIUM_SETPROG__(p), program)
  await page.evaluate(() => window.__ARDUINIUM_RUN__())

  const deadline = Date.now() + budgetMs
  let last = null
  const trace = []
  while (Date.now() < deadline) {
    await page.waitForTimeout(500)
    last = await page.evaluate(() => {
      const summary = window.__ARDUINIUM__()
      const runtime = window.__ARDUINIUM_RT__()
      return { ...summary, clock: runtime.clock, ringTime: runtime.ringTime }
    })
    trace.push({
      clock: Math.round(last.clock),
      pos: last.robotPos?.map((value) => Number(value.toFixed(2))),
      ring: Number(last.ringTime.toFixed(2)),
    })
    if (last.missionWon) break
  }
  // Leave the world stopped for the next mission.
  await page.evaluate(() => {
    const b = window.__ARDUINIUM_BUILD__()
    if (b.running) b.toggleRun()
  })
  const win = await page.evaluate(() => window.__ARDUINIUM_UI__().missionWon)
  await page.evaluate(() => window.__ARDUINIUM_UI__().dismissWin())
  return { won: Boolean(win || last?.missionWon), robotPos: last?.robotPos, trace }
}

/* ------------------------------------------------------------ firstMetres */

const first = await runMission(
  'firstMetres',
  [
    { id: 'm1', type: 'drive', dir: 'forward', speed: 160, ms: 5000 },
    { id: 'm2', type: 'wait', ms: 3000 },
  ],
  16000,
)
check('firstMetres: driving forward reaches the flag', first.won, JSON.stringify(first.robotPos))

/* ------------------------------------------------------------ tightSqueeze */

const squeeze = await runMission(
  'tightSqueeze',
  [
    { id: 'm1', type: 'drive', dir: 'forward', speed: 160, ms: 4500 },
    { id: 'm2', type: 'wait', ms: 3000 },
  ],
  18000,
)
check(
  'tightSqueeze: a straight, well-aimed run fits through the gate',
  squeeze.won,
  JSON.stringify(squeeze.robotPos),
)

/* -------------------------------------------------------------- pushCrate */

const crate = await runMission(
  'pushCrate',
  [{ id: 'm1', type: 'drive', dir: 'forward', speed: 200, ms: 7000 }],
  20000,
)
check('pushCrate: shoving the crate far enough wins', crate.won, JSON.stringify(crate.robotPos))

/* -------------------------------------------------------------- followLine */

// The honest route: turn towards the ring, drive out to it, and stay on it —
// the win needs BOTH the flag and seconds accumulated inside the band.
const ring = await runMission(
  'followLine',
  [
    // An optional pause before turning. Runtime now performs physics warmup
    // before starting the program, so opening commands retain their duration.
    { id: 'm0', type: 'wait', ms: 900 },
    { id: 'm1', type: 'drive', dir: 'right', speed: 150, ms: 820 },
    { id: 'm2', type: 'wait', ms: 500 },
    { id: 'm3', type: 'drive', dir: 'forward', speed: 120, ms: 2200 },
    { id: 'm4', type: 'wait', ms: 6000 },
  ],
  28000,
)
check(
  'followLine: riding the ring to its flag wins',
  ring.won,
  ring.won ? JSON.stringify(ring.robotPos) : JSON.stringify(ring.trace),
)

// The cheat that used to work: the old flag sat in the middle of the pad, so
// any forward waddle "followed the line". Now a run that never touches the
// ring must NOT win, however long it sits there.
const cheat = await runMission(
  'followLine',
  [
    { id: 'm1', type: 'drive', dir: 'forward', speed: 120, ms: 1500 },
    { id: 'm2', type: 'wait', ms: 6000 },
  ],
  12000,
)
check('followLine: skipping the ring does NOT win', !cheat.won, JSON.stringify(cheat.robotPos))

/* ------------------------------------------------------------------ done */

await browser.close()
const passed = results.filter((r) => r.startsWith('PASS')).length
console.log(results.join('\n'))
console.log(`\n${passed}/${results.length} PASS`)
console.log(errs.length ? `\nPAGE ERRORS:\n${errs.slice(0, 6).join('\n')}` : '\nno page errors')
process.exit(passed === results.length && errs.length === 0 ? 0 : 1)
