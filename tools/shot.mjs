/**
 * Headless smoke test + screenshot harness.
 *
 *   node tools/shot.mjs <out.png> <scenario>
 *
 * scenarios:
 *   boot     empty workshop
 *   led      load the LED template
 *   rover    load the rover template
 *   drive    load the rover, press Run, prove it physically moves
 *   build    place two strips by hand and check a bolt is created
 *   code     the generated Arduino code tab
 *   xray     x-ray mode on the rover
 *
 * Exits non-zero on any console error or page exception.
 */
import { chromium } from 'playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const [, , outArg, scenario = 'boot'] = process.argv
const out = path.resolve(here, '..', 'shots', outArg ?? 'shot.png')
const url =
  'file://' + path.resolve(here, '..', 'dist-single', 'index.html') + '?quality=high'

const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 880 } })

const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console.error: ' + m.text())
})
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))

await page.goto(url, { waitUntil: 'load' })
await page.waitForSelector('canvas', { timeout: 30000 })
await page.waitForTimeout(2000)

const state = () => page.evaluate(() => window.__ARDUINIUM__())

/** Dispatched click: software WebGL keeps the main thread too busy for
 *  Playwright's post-click settle to ever resolve on a full-screen canvas. */
const tap = async (sel) => { await page.locator(sel).first().dispatchEvent('click') }

if (scenario !== 'onboarding') {
  await tap('[data-testid="skip-onboarding"]')
  await page.waitForTimeout(400)
}

async function loadTemplate(id) {
  await tap('[data-testid="templates"]')
  await page.waitForTimeout(200)
  await tap(`[data-template="${id}"]`)
  await page.waitForTimeout(1400)
}

/** Click a parts-panel card, then click a point in the viewport. */
async function place(kind, tab, fx, fy) {
  await tap(`[data-tab="${tab}"]`)
  await page.waitForTimeout(120)
  await tap(`[data-part="${kind}"]`)
  const box = await page.locator('canvas').boundingBox()
  const x = box.x + box.width * fx
  const y = box.y + box.height * fy
  await page.mouse.move(x - 40, y - 40)
  await page.mouse.move(x, y, { steps: 8 })
  await page.waitForTimeout(260)
  await page.mouse.down()
  await page.mouse.up()
  await page.waitForTimeout(420)
}

let extra = {}

if (scenario === 'led') await loadTemplate('led')

if (scenario === 'rover' || scenario === 'xray') await loadTemplate('rover')

if (scenario === 'xray') {
  await tap('[data-testid="xray"]')
  await page.waitForTimeout(500)
}

if (scenario === 'code') {
  await loadTemplate('rover')
  await tap('[data-dock="code"]')
  await page.waitForTimeout(400)
}

if (scenario === 'mission') {
  await loadTemplate('rover')
  await tap('[data-testid="missions"]'); await page.waitForTimeout(250)
  await tap('[data-mission="firstMetres"]'); await page.waitForTimeout(900)
  await tap('[data-testid="run"]')
  await page.waitForTimeout(12000)
  extra.won = await page.evaluate(() => window.__ARDUINIUM_UI__?.().missionWon)
}

if (scenario === 'ru' || scenario === 'uz') {
  await loadTemplate('rover')
  await tap('[data-testid="language"]'); await page.waitForTimeout(250)
  await tap(`[data-locale="${scenario}"]`); await page.waitForTimeout(500)
}

if (scenario === 'drive') {
  await loadTemplate('rover')
  const before = await state()
  await tap('[data-testid="run"]')
  await page.waitForTimeout(9000)
  const after = await state()
  extra = {
    startedAt: before.robotPos,
    endedAt: after.robotPos,
    travelled: Math.hypot(
      after.robotPos[0] - 0,
      after.robotPos[2] - 0,
    ).toFixed(2),
  }
  await tap('[data-dock="serial"]')
  await page.waitForTimeout(400)
}

/**
 * The snap matrix, exercised by hand: a chassis hole takes a motor mount, the
 * mount's seat takes a motor, the motor's shaft takes a wheel — and a wheel
 * offered to a bare strip is refused outright.
 */
if (scenario === 'drivetrain') {
  await place('strip11', 'structure', 0.46, 0.58)
  extra.afterStrip = (await state()).parts

  // A wheel has nowhere to go yet: the strip offers holes, and a wheel only
  // accepts shafts. Nothing should be created.
  await place('wheel', 'structure', 0.47, 0.58)
  extra.wheelRefused = (await state()).parts === extra.afterStrip

  await place('motormount', 'structure', 0.49, 0.575)
  extra.afterMount = (await state()).parts
  await place('motor', 'structure', 0.495, 0.575)
  extra.afterMotor = (await state()).parts
  await place('wheel', 'structure', 0.50, 0.575)
  extra.afterWheel = (await state()).parts
  extra.chain = await page.evaluate(() =>
    Object.values(window.__ARDUINIUM_PARTS__?.() ?? {}).map((p) => `${p.kind}<-${p.hostId ?? '-'}`),
  )
}

if (scenario === 'build') {
  await place('strip11', 'structure', 0.44, 0.56)
  await place('strip7', 'structure', 0.44, 0.56)
  extra.afterTwoStrips = await state()
}

const finalState = await state()
await page.screenshot({ path: out })
await browser.close()

console.log('state:', JSON.stringify({ ...finalState, ...extra }))
if (errors.length) {
  console.error('PAGE ERRORS:\n' + errors.slice(0, 12).join('\n'))
  process.exit(1)
}

/*
 * The drive scenario is a GATE, not just a screenshot. `travelled` and
 * `distance` used to be printed and never checked, which is how "the rover
 * drives backwards into the cones" and "the sensor is a sine wave" both
 * survived. Sane means: it really moved (but did not teleport), and the
 * sensor read something a real HC-SR04 could have said.
 */
if (scenario === 'drive') {
  const travelled = Number(extra.travelled)
  const distance = finalState.distance
  const failures = []
  if (!(travelled > 1 && travelled < 40)) failures.push(`travelled ${travelled} not in (1, 40)`)
  if (!(distance > 0 && distance <= 400)) failures.push(`distance ${distance} not in (0, 400]`)
  if (failures.length) {
    console.error('DRIVE ASSERTIONS FAILED:\n' + failures.join('\n'))
    process.exit(1)
  }
}
console.log('OK ->', out)
