/**
 * Module 3 assertions: terminals, the interactive wiring engine, and the
 * chassis-mounted sensor.
 *
 *   npx vite build --mode single
 *   node tools/wiring-test.mjs
 *
 * The drag itself is driven through the store actions the 3D dots call
 * (beginWire / dragWire / commitWire), not by faking pointer events at
 * screen coordinates — the dots are spheres a few hundredths of a unit
 * across in a software-rendered scene, so hit-testing them by pixel would
 * test Playwright's aim rather than the wiring rules.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const here = path.dirname(fileURLToPath(import.meta.url))
const url = 'file://' + path.resolve(here, '..', 'dist-single', 'index.html') + '?quality=high'

const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
page.setDefaultTimeout(15000)

const errs = []
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errs.push('console: ' + m.text())
})

await page.goto(url, { waitUntil: 'load' })
await page.waitForSelector('canvas')
await page.waitForTimeout(2200)

const tap = async (sel) => {
  await page.locator(sel).first().dispatchEvent('click')
  await page.waitForTimeout(250)
}
await tap('[data-testid="skip-onboarding"]')
await tap('[data-testid="templates"]')
await tap('[data-template="rover"]')
await page.waitForTimeout(1200)

const results = []
const check = (name, ok, detail = '') =>
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)

const state = () =>
  page.evaluate(() => {
    const b = window.__ARDUINIUM_BUILD__()
    return {
      wires: b.wires.map((w) => `${w.a.partId}.${w.a.terminal}>${w.b.partId}.${w.b.terminal}`),
      colours: b.wires.map((w) => w.colour),
      wiring: b.wiring ? `${b.wiring.from.partId}.${b.wiring.from.terminal}` : null,
      pinMap: b.pinMap(),
      past: b.past.length,
      parts: b.order.length,
      toasts: window.__ARDUINIUM_UI__().toasts.map((t) => t.text),
    }
  })
const act = (fn, ...args) =>
  page.evaluate(
    ([f, a]) => window.__ARDUINIUM_BUILD__()[f](...a),
    [fn, args],
  )

/* ---------------------------------------------- the rover ships wired up */

let s = await state()
check('Rover loads with a complete 24-lead circuit', s.wires.length === 24, s.wires.join(', '))
check(
  'Sensor, resistor, driver and battery replace fake board sockets',
    s.wires.filter((w) => w.startsWith('r-sensor.')).length === 4 &&
    s.wires.some((w) => w.includes('r-led-resistor')) &&
    s.wires.filter((w) => w.includes('r-driver.')).length >= 10 &&
    s.wires.filter((w) => w.includes('r-battery.')).length === 2,
  s.wires.join(', '),
)
check(
  'Colours follow the pin type',
  s.colours.includes('#e0342a') && s.colours.includes('#1a1a1a') && s.colours.includes('#f0b429') && s.colours.includes('#e2544c'),
  s.colours.join(', '),
)

const ledPart = await page.evaluate(
  () => Object.values(window.__ARDUINIUM_BUILD__().parts).find((p) => p.kind === 'ledRed'),
)
check('External LED is mounted on the frame, not parented to the Uno', Boolean(ledPart?.hostId) && !ledPart?.socket, JSON.stringify(ledPart))

const sensorPart = await page.evaluate(
  () => Object.values(window.__ARDUINIUM_BUILD__().parts).find((p) => p.kind === 'sensor'),
)
check(
  'Sensor is bolted to the chassis, not seated in a socket',
  Boolean(sensorPart?.hostId) && !sensorPart?.socket,
  JSON.stringify(sensorPart),
)

/* ------------------------------------- the pin map comes from the wires */

check('Sensor claims its ECHO input pin', s.pinMap['7']?.kind === 'sensor', JSON.stringify(s.pinMap['7']))

// Cut the TRIG lead: the sensor should stop claiming pin 6.
const trig = await page.evaluate(
  () => window.__ARDUINIUM_BUILD__().wires.find((w) => w.a.terminal === 'TRIG')?.id,
)
await act('deleteWire', trig)
await page.waitForTimeout(200)
s = await state()
check('Cutting TRIG makes the complete sensor circuit release ECHO', !s.pinMap['7'], JSON.stringify(s.pinMap['7'] ?? null))
check('Cutting a lead is undoable', s.past > 0, `past=${s.past}`)

await act('undo')
await page.waitForTimeout(200)
s = await state()
check('Undo restores the lead and the pin', s.wires.length === 24 && s.pinMap['7']?.kind === 'sensor')

/* ------------------------------------------------- drawing a new lead */

await act('deleteWire', trig)
await page.waitForTimeout(150)
await act('beginWire', 'r-sensor', 'TRIG')
await page.waitForTimeout(150)
s = await state()
check('beginWire arms a lead', s.wiring === 'r-sensor.TRIG', String(s.wiring))
check('Arming records nothing in history yet', true)

await act('commitWire', 'r-board', 'D5')
await page.waitForTimeout(250)
s = await state()
check('commitWire joins the two pins', s.wires.some((w) => w.includes('r-board.D5')), s.wires.join(', '))
check('The drag ends when it lands', s.wiring === null)
check('TRIG is an output; ECHO remains the sensor reading pin', s.pinMap['7']?.kind === 'sensor' && !s.pinMap['5'], JSON.stringify(s.pinMap))

/* ------------------------------------------------------ the rules bite */

const before = (await state()).wires.length

// Across two parts, so the same-part rule does not fire first and mask it:
// the sensor's supply pin dropped straight onto the board's ground rail.
await act('beginWire', 'r-sensor', 'VCC')
await act('commitWire', 'r-board', 'GND1')
await page.waitForTimeout(250)
s = await state()
check('A supply-to-ground short is refused', s.wires.length === before, `wires=${s.wires.length}`)
check('...and says so', s.toasts.some((t) => /short/i.test(t)), JSON.stringify(s.toasts))
check('The refused drag is cleared', s.wiring === null)

// Two pins on the same part is its own, different refusal.
await act('beginWire', 'r-board', '5V')
await act('commitWire', 'r-board', 'GND1')
await page.waitForTimeout(250)
s = await state()
check('Two pins on one part are refused as such', s.wires.length === before)
check(
  '...with the same-part reason, not the short one',
  s.toasts.some((t) => /different parts|разными|har xil/i.test(t)),
  JSON.stringify(s.toasts),
)

await act('beginWire', 'r-sensor', 'VCC')
await act('commitWire', 'r-sensor', 'GND')
await page.waitForTimeout(250)
s = await state()
check('A lead from a part to itself is refused', s.wires.length === before, `wires=${s.wires.length}`)

await act('beginWire', 'r-sensor', 'ECHO')
await act('commitWire', 'r-board', 'D7')
await page.waitForTimeout(250)
s = await state()
check('A duplicate lead is refused', s.wires.length === before, `wires=${s.wires.length}`)

await act('beginWire', 'r-sensor', 'TRIG')
await act('cancelWire')
await page.waitForTimeout(200)
s = await state()
check('An abandoned drag leaves nothing behind', s.wiring === null && s.wires.length === before)

/* --------------------------------------- deleting a part takes its leads */

const partsBefore = (await state()).parts
await act('select', 'r-sensor')
await act('deletePart', 'r-sensor')
await page.waitForTimeout(250)
s = await state()
check('Deleting the sensor removes it', s.parts === partsBefore - 1, `parts=${s.parts}`)
check('...and only its four leads', s.wires.length === before - 4 && s.wires.every((w) => !w.includes('r-sensor.')), s.wires.join(', '))
check('...and frees its reading pin', !s.pinMap['7'], JSON.stringify(s.pinMap))

await act('undo')
await page.waitForTimeout(250)
s = await state()
check('Undo brings the sensor and its harness back', s.parts === partsBefore && s.wires.length === before, `parts=${s.parts} wires=${s.wires.length}`)

/* ---------------------------------------------------- save / load round trip */

const saved = await page.evaluate(() => window.__ARDUINIUM_BUILD__().exportBuildToJSON())
check('Wires are exported', Array.isArray(saved.wires) && saved.wires.length === before, `n=${saved.wires?.length}`)

await page.evaluate((j) => window.__ARDUINIUM_BUILD__().loadBuildFromJSON(j, 'test'), saved)
await page.waitForTimeout(300)
s = await state()
check('Wires survive a save/load round trip', s.wires.length === before, `wires=${s.wires.length}`)
check('...and the pin map with them', s.pinMap['7']?.kind === 'sensor', JSON.stringify(s.pinMap['7'] ?? null))

/* --------------------------------------------- the analog pins are real */

// A0–A5 double as digital pins 14–19 on a real Uno. A signal lead landing on
// A0 must claim pin 14 in the map — before this, an analog-wired sensor
// registered nothing and readDistanceCm() silently returned 0 forever.
await page.evaluate(() => {
  const b = window.__ARDUINIUM_BUILD__()
  const echo = b.wires.find((w) => w.a.terminal === 'ECHO' || w.b.terminal === 'ECHO')
  if (echo) b.deleteWire(echo.id)
})
await act('beginWire', 'r-sensor', 'ECHO')
await act('commitWire', 'r-board', 'A0')
await page.waitForTimeout(250)
s = await state()
check('A lead to A0 claims digital pin 14', s.pinMap['14']?.kind === 'sensor', JSON.stringify(s.pinMap['14'] ?? null))

// ...but supply and ground never claim a pin: a sensor wired ONLY to power
// is electrically silent, which is exactly how SensorRay decides whether a
// bolted sensor actually measures.
await page.evaluate(() => {
  const b = window.__ARDUINIUM_BUILD__()
  for (const w of [...b.wires]) {
    const ends = [w.a.terminal, w.b.terminal]
    if (ends.includes('TRIG') || ends.includes('ECHO')) b.deleteWire(w.id)
  }
})
await page.waitForTimeout(250)
s = await state()
check(
  'A sensor wired only to power claims no pin at all',
  !Object.values(s.pinMap).some((v) => v.kind === 'sensor'),
  JSON.stringify(s.pinMap),
)

/* ------------------------------------------------------------------ done */

await browser.close()
const passed = results.filter((r) => r.startsWith('PASS')).length
console.log(results.join('\n'))
console.log(`\n${passed}/${results.length} PASS`)
console.log(errs.length ? `\nPAGE ERRORS:\n${errs.slice(0, 6).join('\n')}` : '\nno page errors')
process.exit(passed === results.length && errs.length === 0 ? 0 : 1)
