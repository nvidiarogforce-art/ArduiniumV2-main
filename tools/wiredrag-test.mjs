/**
 * Click-and-drag wiring, driven by real pointer events.
 *
 *   npx vite build --mode single
 *   node tools/wiredrag-test.mjs
 *
 * Everything else in tools/ dispatches synthetic clicks, which ARCHITECTURE.md
 * explains is a workaround for click-settling on the full-bleed WebGL canvas.
 * That workaround cannot test this: a drag is pointerdown -> pointermove ->
 * pointerup against react-three-fiber's raycaster, and only real mouse events
 * produce the intersections it needs. So this harness uses page.mouse and
 * projects terminal positions to screen coordinates itself.
 *
 * STATUS: 15 of 15 pass.
 *
 * This suite spent a while at 11/14, blamed on a supposed ~45 px disagreement
 * between where it computed a terminal to be and where Wiring.jsx's snapper
 * put it. There was no such disagreement — the spiral search below now lands
 * on the very first candidate it tries, offset (0, 0). Two real bugs were
 * hiding behind that theory, and both are worth knowing about:
 *
 *   1. The pin label was drei's <Text>, i.e. troika, which fetches font data
 *      from a CDN and suspends until it arrives. Wiring renders inside Scene's
 *      <Suspense fallback={null}>, so the first hover over a pin blanked the
 *      entire 3D scene — and over file://, where this harness and a student
 *      both load the app, Chrome blocks that fetch outright so it never came
 *      back. Every pixel this suite sampled during a drag came from a canvas
 *      that had stopped drawing. See PinLabel in Wiring.jsx.
 *   2. Releasing a lead committed from the pin's own onPointerUp, which needs
 *      a raycast hit on a grab sphere about four pixels across, while the
 *      preview snapped from thirty-four. A lead could preview "D9" in green
 *      and still be thrown away on release. Releases now land on the previewed
 *      target.
 *
 * Neither was a projection bug, and neither would have been found by staring
 * at the pixel maths.
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

/* --------------------------------------------------------------------------
 * A bare board placed by hand must arrive empty.
 *
 * The report was that an LED shows up already plugged into a brand-new board.
 * This checks the actual path a student takes — parts panel, then click to
 * drop — rather than a template.
 * ------------------------------------------------------------------------ */
await page.evaluate(() => {
  const b = window.__ARDUINIUM_BUILD__()
  b.beginPlace('board')
  b.movePending([0, 0, 0])
  b.commitPlace()
})
await page.waitForTimeout(500)
const bare = await page.evaluate(() => {
  const b = window.__ARDUINIUM_BUILD__()
  return {
    kinds: Object.values(b.parts).map((p) => p.kind),
    wires: b.wires.length,
    pinMap: b.pinMap(),
  }
})
check('A hand-placed board arrives with no LED', !bare.kinds.includes('led'), bare.kinds.join(','))
check('...and no wires', bare.wires === 0, String(bare.wires))
check('...and an empty pin map', Object.keys(bare.pinMap).length === 0, JSON.stringify(bare.pinMap))

/* --------------------------------------------------------------------------
 * Build a drivetrain by hand, then wire the motor by dragging.
 * ------------------------------------------------------------------------ */
await page.evaluate(() => {
  const b = window.__ARDUINIUM_BUILD__()
  b.clearAll()
  const place = (kind, at) => {
    b.beginPlace(kind)
    b.movePending(at)
    b.commitPlace()
  }
  place('strip11', [0, 0, 0])
  place('board', [0, 0, -2.2])
})
await page.waitForTimeout(400)

// Mount the motor chain onto the strip through the normal snap path.
//
// Every step re-reads the store: getState() returns a snapshot, so holding one
// `b` across commitPlace() calls reads parts that were current three
// placements ago — which is what made this look like nothing had been built.
const built = await page.evaluate(() => {
  const store = () => window.__ARDUINIUM_BUILD__()
  const place = (kind, at) => {
    const b = store()
    b.beginPlace(kind)
    b.movePending(at)
    b.commitPlace()
  }
  const find = (kind) => Object.values(store().parts).find((p) => p.kind === kind) ?? null

  const strip = find('strip11')
  place('motormount', [strip.pos[0] - 2, 0, strip.pos[2]])
  const mm = find('motormount')
  place('motor', [strip.pos[0] - 2, 0, strip.pos[2]])
  const motor = find('motor')
  place('wheel', [strip.pos[0] - 2.6, 0, strip.pos[2]])

  return {
    ok: Boolean(mm && motor),
    motorId: motor?.id ?? null,
    pin: motor?.pin ?? null,
    kinds: Object.values(store().parts).map((p) => p.kind),
  }
})
check('Built a strip + board + motor chain by hand', built.ok, built.kinds.join(','))

const motorId = built.motorId

// Turn wiring mode on so the terminal dots exist to grab.
await tap('[data-testid="wire-mode"]')
await page.waitForTimeout(600)

/** Project a terminal's build-space position to screen pixels. */
const screenOf = (partId, terminal) =>
  page.evaluate(
    ([pid, tid]) => {
      const s = window.__ARDUINIUM_SCENE__()
      const p = window.__ARDUINIUM_TERMINAL__(pid, tid)
      return p ? s.project(p) : null
    },
    [partId, terminal],
  )

const motorPt = await screenOf(motorId, 'M+')
check('Motor M+ terminal projects to screen', Boolean(motorPt), JSON.stringify(motorPt))

// Pick a digital pin to land on and drag to it.
const TARGET_PIN = 'D9'
const pinPt = await screenOf(
  await page.evaluate(() => Object.values(window.__ARDUINIUM_BUILD__().parts).find((p) => p.kind === 'board').id),
  TARGET_PIN,
)
check(`Board ${TARGET_PIN} projects to screen`, Boolean(pinPt), JSON.stringify(pinPt))

/**
 * Move the mouse until the app itself reports it is over `want`.
 *
 * The estimate from project() is a starting point, not gospel: this scene
 * shifts the camera frustum, so a pixel computed outside the render loop can
 * be tens of pixels from where the wiring layer believes that pin is. Rather
 * than encode my own projection as the source of truth, this searches a small
 * spiral around the estimate and asks the app after each step. It proves the
 * thing that actually matters — that a reachable pixel targets this pin — and
 * cannot pass by accident, since it reads the target back before releasing.
 */
async function aimAt(estimate, want) {
  const ring = [[0, 0]]
  for (let r = 8; r <= 64; r += 8) {
    for (let a = 0; a < 12; a++) {
      ring.push([Math.round(r * Math.cos((a * Math.PI) / 6)), Math.round(r * Math.sin((a * Math.PI) / 6))])
    }
  }
  for (const [dx, dy] of ring) {
    await page.mouse.move(estimate.x + dx, estimate.y + dy)
    await page.waitForTimeout(45)
    const t = await page.evaluate(() => window.__ARDUINIUM_BUILD__().wiring?.target ?? null)
    if (t?.terminal === want) return { x: estimate.x + dx, y: estimate.y + dy, found: true }
  }
  return { ...estimate, found: false }
}

if (motorPt && pinPt) {
  // The real gesture: press on the motor terminal, move, release on the pin.
  await page.mouse.move(motorPt.x, motorPt.y)
  await page.waitForTimeout(150)
  await page.mouse.down()
  await page.waitForTimeout(120)

  const armed = await page.evaluate(() => Boolean(window.__ARDUINIUM_BUILD__().wiring))
  check('Pressing a terminal arms a lead', armed)

  const aim = await aimAt(pinPt, TARGET_PIN)
  check(`Dragging over ${TARGET_PIN} previews it before commit`, aim.found, JSON.stringify(aim))

  await page.mouse.up()
  await page.waitForTimeout(400)
}

const after = await page.evaluate(() => {
  const b = window.__ARDUINIUM_BUILD__()
  return { wires: b.wires.map((w) => `${w.a.partId}.${w.a.terminal}>${w.b.partId}.${w.b.terminal}`), wiring: b.wiring, pinMap: b.pinMap() }
})
check('Direct Uno-to-motor wiring is rejected', after.wires.length === 0, after.wires.join(', '))
check('The drag is over', after.wiring === null)
check(
  'An incomplete motor circuit claims no control pin',
  !after.pinMap['9'],
  JSON.stringify(after.pinMap),
)
check(
  'A stored legacy pin cannot bypass the L293D requirement',
  !after.pinMap['9'] && !after.pinMap[String(built.pin)],
  `stored=${built.pin} map=${JSON.stringify(after.pinMap)}`,
)

/* ------------------------------------------------------- cancelling a drag */

const beforeCancel = (await page.evaluate(() => window.__ARDUINIUM_BUILD__().wires.length))
const m2 = await screenOf(motorId, 'M-')
if (m2) {
  await page.mouse.move(m2.x, m2.y)
  await page.mouse.down()
  await page.mouse.move(m2.x + 120, m2.y - 90)
  await page.waitForTimeout(120)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)
  await page.mouse.up()
  await page.waitForTimeout(250)
}
const afterCancel = await page.evaluate(() => {
  const b = window.__ARDUINIUM_BUILD__()
  return { wires: b.wires.length, wiring: b.wiring }
})
check('Escape cancels a drag in flight', afterCancel.wiring === null, JSON.stringify(afterCancel.wiring))
check('...and nothing is connected', afterCancel.wires === beforeCancel, `${beforeCancel} -> ${afterCancel.wires}`)

// Releasing over empty space must also drop the lead.
const m3 = await screenOf(motorId, 'M-')
if (m3) {
  await page.mouse.move(m3.x, m3.y)
  await page.mouse.down()
  await page.mouse.move(60, 880) // a corner of the canvas with nothing in it
  await page.waitForTimeout(150)
  await page.mouse.up()
  await page.waitForTimeout(350)
}
const afterDrop = await page.evaluate(() => {
  const b = window.__ARDUINIUM_BUILD__()
  return { wires: b.wires.length, wiring: b.wiring }
})
check('Releasing over nothing cancels', afterDrop.wiring === null && afterDrop.wires === beforeCancel, JSON.stringify(afterDrop))

/* ------------------------------------------------------------------ done */

await browser.close()
const passed = results.filter((r) => r.startsWith('PASS')).length
console.log(results.join('\n'))
console.log(`\n${passed}/${results.length} PASS`)
console.log(errs.length ? `\nPAGE ERRORS:\n${errs.slice(0, 6).join('\n')}` : '\nno page errors')
process.exit(passed === results.length && errs.length === 0 ? 0 : 1)
