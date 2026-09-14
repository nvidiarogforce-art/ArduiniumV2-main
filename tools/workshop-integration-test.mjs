import assert from 'node:assert/strict'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { getTemplate } from '../src/lib/templates.js'
import { SENSOR_SPECS, SENSOR_KINDS } from '../src/lib/sensors.js'

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
const errors = []; let passed = 0
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
const check = (name, ok) => { assert.ok(ok, name); passed++; console.log('PASS', name) }
const tap = (selector) => page.locator(selector).first().dispatchEvent('click')
const load = async (json) => { await page.evaluate((data) => window.__ARDUINIUM_LOAD__(data), json); await page.waitForTimeout(300) }
const run = () => page.evaluate(() => window.__ARDUINIUM_RUN__())
try {
  await page.goto(pathToFileURL(path.resolve('dist-single/index.html')).href + '?quality=low')
  await page.waitForFunction(() => Boolean(window.__ARDUINIUM_BUILD__))
  await tap('[data-testid="skip-onboarding"]')
  const fixture = structuredClone(getTemplate('rover').json)
  fixture.program = []
  let hole = 0
  const labKinds = SENSOR_KINDS.slice(0, 7)
  for (const kind of labKinds.filter((kind) => kind !== 'sensor')) {
    const id = 'lab-' + kind
    const [hostId, hostHole] = [['r-railA', 1], ['r-railA', 3], ['r-railA', 5], ['r-railA', 7], ['r-railA', 9], ['r-railA', 10]][hole++]
    fixture.parts.push({ id, kind, hostId, hostHole })
    const pin = SENSOR_SPECS[kind].defaultPin
    for (const [terminal, boardTerminal] of [['VCC', '5V'], ['GND', 'GND1'], ['OUT', pin >= 14 ? `A${pin - 14}` : `D${pin}`]])
      fixture.wires.push({ id: `${id}-${terminal}`, a: { partId: id, terminal }, b: { partId: 'r-board', terminal: boardTerminal }, colour: terminal === 'VCC' ? '#e46539' : terminal === 'GND' ? '#343b40' : '#268c72' })
  }
  await load(fixture)
  check('All seven sensor kinds load and appear in the lab', await page.locator('[data-sensor-card]').count() === 7)
  await tap('[data-sensor-card="lightSensor"] .lab-sensor-actions button:last-child')
  check('Experiment adds a real sensor program', await page.evaluate(() => window.__ARDUINIUM_PROG__()[0]?.body[0]?.a?.src === 'sensor'))
  await run()
  await page.waitForFunction(() => Object.values(window.__ARDUINIUM_RT__().sensorReadings).filter((r) => r.ready).length === 7, { timeout: 20000 })
  const initial = await page.evaluate(() => window.__ARDUINIUM_RT__().sensorReadings)
  check('Light uses the controlled environment', initial['lab-lightSensor'].value === 70)
  check('Temperature uses the controlled environment', initial['lab-temperatureSensor'].value === 22)
  await page.waitForFunction(() => window.__ARDUINIUM_RT__().pinHigh[13] === true)
  check('Sensor comparison drives the LED output', true)
  await page.locator('[data-testid="lab-light"]').evaluate((input) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '10')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.waitForFunction(() => window.__ARDUINIUM_RT__().sensorReadings['lab-lightSensor']?.value === 10 && window.__ARDUINIUM_RT__().pinHigh[13] === false)
  check('Changing light changes both the reading and program output', true)
  await page.waitForFunction(() => document.querySelector('[data-sensor-card="lightSensor"] polyline')?.getAttribute('points').split(' ').length > 2)
  check('Live graph accumulates actual samples', true)
  await run()

  await page.evaluate(() => window.__ARDUINIUM_BUILD__().select('r-railA'))
  await page.locator('[aria-label="Y coordinate"]').fill('1.25')
  await page.locator('[aria-label="Y coordinate"]').press('Enter')
  check('Visible Y control moves a selected part vertically', await page.evaluate(() => window.__ARDUINIUM_BUILD__().parts['r-railA'].y === 1.25))
  await page.evaluate(() => window.__ARDUINIUM_BUILD__().undo())
  check('XYZ edit is undoable', await page.evaluate(() => window.__ARDUINIUM_BUILD__().parts['r-railA'].y < 0.1))

  const broken = structuredClone(fixture)
  broken.wires = broken.wires.filter((wire) => wire.id !== 'lab-lightSensor-GND')
  broken.program = [{ id: 'read-unwired', type: 'setVar', name: 'reading', a: { src: 'sensor', pin: 15 }, op: '' }]
  await load(broken)
  await run()
  await page.waitForFunction(() => window.__ARDUINIUM_RT__().clock > 1000)
  const missing = await page.evaluate(() => ({ reading: window.__ARDUINIUM_RT__().sensorReadings['lab-lightSensor'], serial: window.__ARDUINIUM_BUILD__().serial }))
  check('Missing ground produces no fabricated sensor value', missing.reading.value === null && !missing.reading.ready && missing.reading.missing.includes('GND'))
  check('Reading an unpowered sensor reports a program error', JSON.stringify(missing.serial).includes('!!'))
  await run()

  const shortDrive = structuredClone(getTemplate('rover').json)
  shortDrive.program = [{ id: 'short', type: 'drive', dir: 'forward', speed: 180, ms: 350 }]
  await load(shortDrive)
  await run()
  await page.waitForFunction(() => window.__ARDUINIUM_RT__().clock > 1500)
  const moved = await page.evaluate(() => window.__ARDUINIUM_RT__().robotPos)
  check('A 350 ms opening drive survives the physics warmup', Math.hypot(moved[0], moved[2]) > 0.05)
  await run()
  await load(fixture)
  await page.evaluate(() => { const ui = window.__ARDUINIUM_UI__(); ui.setDrawer('bottom', false); window.__ARDUINIUM_BUILD__().select('r-board') })
  await mkdir('shots', { recursive: true })
  await page.waitForTimeout(3500)
  await page.screenshot({ path: 'shots/sensor-workshop.png', timeout: 15000 })
  await run()
  await page.waitForFunction(() => window.__ARDUINIUM_RT__().sensorReadings['lab-lightSensor']?.ready)
  await page.locator('[data-sensor-card="lightSensor"]').scrollIntoViewIfNeeded()
  await page.waitForTimeout(700)
  await page.screenshot({ path: 'shots/sensor-lab-live.png', timeout: 15000 })
  const metrics = await page.evaluate(() => ({ scene: window.__ARDUINIUM_SCENE__(), sensors: window.__ARDUINIUM_RT__().sensorReadings, canvas: { width: document.querySelector('canvas').width, height: document.querySelector('canvas').height } }))
  await writeFile('shots/workshop-metrics.json', JSON.stringify({ checks: passed, shortDrivePosition: moved, ...metrics, errors }, null, 2))
  await run()
  check('No browser runtime errors throughout the workflow', errors.length === 0)
  console.log(`${passed}/${passed} PASS`)
} finally { await browser.close() }
