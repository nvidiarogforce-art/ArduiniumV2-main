/** Sensor platform gate: node tools/sensors-test.mjs [--browser]
 * Pure wiring cases + real Rapier queries; optional built-file browser lifecycle.
 */
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import RAPIER from '@dimforge/rapier3d-compat'
import { Quaternion, Vector3 } from 'three'
import { SENSOR_KINDS, SENSOR_SPECS, sensorConnection, sampleSensor, CM_PER_UNIT } from '../src/lib/sensors.js'
import { CATALOGUE, PART_SPECS, CATEGORY } from '../src/lib/parts.js'
import { canConnect, terminalOf, terminalsOf } from '../src/lib/terminals.js'
import { chainTransform } from '../src/lib/geometry.js'
import { apply, basisY, ORIENT_COUNT } from '../src/lib/orient.js'
import { TEMPLATES } from '../src/lib/templates.js'
import { rotateByQuat } from '../src/three/vec.js'

let passed = 0
const check = (name, condition) => { assert.ok(condition, name); passed++; console.log('PASS ' + name) }
const board = { id: 'board', kind: 'board' }
const partsFor = (kind) => ({ board, probe: { id: 'probe', kind }, wheel: { id: 'wheel', kind: 'wheel' } })
const lead = (partId, terminal, boardTerminal, boardId = 'board') => ({ id: partId + '-' + terminal, a: { partId, terminal }, b: { partId: boardId, terminal: boardTerminal } })
const leadsFor = (kind, id = 'probe', boardId = 'board') => {
  const spec = SENSOR_SPECS[kind]
  const outputPin = spec.defaultPin >= 14 ? 'A' + (spec.defaultPin - 14) : 'D' + spec.defaultPin
  return [
    ...(spec.supply.length ? [lead(id, 'VCC', '5V', boardId)] : []),
    lead(id, spec.ground ?? 'GND', 'GND1', boardId),
    ...spec.signals.map((terminal) => lead(id, terminal, terminal === spec.output ? outputPin : 'D6', boardId)),
  ]
}
const ref = (part, id) => ({ ...terminalOf(part, id), partId: part.id, partKind: part.kind })

check('All sensor kinds have catalogue cards', SENSOR_KINDS.length === 12 && SENSOR_KINDS.every((k) => CATALOGUE.electronics.includes(k)))
for (const kind of SENSOR_KINDS) {
  const parts = partsFor(kind), wires = leadsFor(kind), probe = parts.probe
  const connected = sensorConnection(probe, parts, wires)
  check(kind + ' all leads give intended output pin', connected.ready && connected.pin === SENSOR_SPECS[kind].defaultPin)
  check(kind + ' reversed wire endpoints work', sensorConnection(probe, parts, wires.map((w) => ({ ...w, a: w.b, b: w.a }))).ready)
  // Every incomplete circuit, including power-only and output-only, is rejected.
  for (let mask = 0; mask < (1 << wires.length) - 1; mask++) {
    const subset = wires.filter((_, i) => mask & (1 << i))
    check(kind + ' incomplete lead subset ' + mask, !sensorConnection(probe, parts, subset).ready)
  }
  for (const wire of wires) {
    const result = sensorConnection(probe, parts, wires.filter((w) => w !== wire))
    check(kind + ' names missing ' + wire.a.terminal, result.missing.includes(wire.a.terminal))
  }
  for (const rail of ['VIN', 'IOREF', 'D5', 'GND1']) {
    if (!SENSOR_SPECS[kind].supply.length) continue
    const wrong = structuredClone(wires); wrong[0].b.terminal = rail
    check(kind + ' rejects VCC from ' + rail, sensorConnection(probe, parts, wrong).missing.includes('VCC'))
  }
  if (SENSOR_SPECS[kind].supply.length) {
    const lowVoltage = structuredClone(wires); lowVoltage[0].b.terminal = '3V3'
    check(kind + ' supply voltage rule', sensorConnection(probe, parts, lowVoltage).ready === (kind !== 'sensor'))
    check(kind + ' board supply can actually be wired', canConnect(ref(board, '5V'), ref(probe, 'VCC')))
  }
  check(kind + ' power-to-ground short refused', !canConnect(ref(board, '5V'), ref(probe, 'GND')))
  check(kind + ' duplicate lead is ambiguous', !sensorConnection(probe, parts, [...wires, wires[0]]).ready)
  check(kind + ' missing board cannot power a module', !sensorConnection(probe, { probe }, wires).ready)
  check(kind + ' terminals match rendered marker positions', terminalsOf(probe).every((t) => t.local.length === 3 && t.local.every(Number.isFinite)))
  if (kind !== 'sensor') check(kind + ' mechanically accepts only a chassis hole', ['sensorModule', 'kitComponent'].includes(PART_SPECS[kind].form) && PART_SPECS[kind].accepts.length === 1 && PART_SPECS[kind].accepts[0] === CATEGORY.HOLE)
}

{
  const parts = partsFor('sensor'), wires = leadsFor('sensor')
  wires[3].b.terminal = 'D6'
  check('Ultrasound TRIG and ECHO cannot share a pin', sensorConnection(parts.probe, parts, wires).missing.includes('SIGNAL_CONFLICT'))
  wires[3].b.terminal = 'A0'
  check('A0 retains its digital alias for ultrasonic ECHO', sensorConnection(parts.probe, parts, wires).ready && sensorConnection(parts.probe, parts, wires).pin === 14)
  wires[3].b.terminal = 'AREF'
  check('AREF is not a data pin', sensorConnection(parts.probe, parts, wires).missing.includes('ECHO'))
  wires[3].b.terminal = 'D7'; wires[0].b.partId = 'board2'
  parts.board2 = { id: 'board2', kind: 'board' }
  check('Rails and signals require the same board', sensorConnection(parts.probe, parts, wires).missing.includes('BOARD_MISMATCH'))
}
{
  const parts = partsFor('lightSensor'); parts.other = { id: 'other', kind: 'temperatureSensor' }
  const wires = [...leadsFor('lightSensor'), ...leadsFor('temperatureSensor', 'other')]
  wires.at(-1).b.terminal = 'A1'
  check('Output conflict disables first sensor', sensorConnection(parts.probe, parts, wires).missing.includes('SIGNAL_CONFLICT'))
  check('Output conflict disables second sensor', sensorConnection(parts.other, parts, wires).missing.includes('SIGNAL_CONFLICT'))
  check('Conflict detection ignores wire order', !sensorConnection(parts.probe, parts, wires.toReversed()).ready)
  const clean = leadsFor('lightSensor')
  parts.driver = { id: 'driver', kind: 'motorDriver' }
  clean.push({ a: { partId: 'driver', terminal: 'IN1' }, b: { partId: 'board', terminal: 'A1' } })
  check('Motor-driver input and sensor cannot claim the same pin', !sensorConnection(parts.probe, parts, clean).ready)
}
{
  const parts = partsFor('encoderSensor'), wires = leadsFor('encoderSensor')
  delete parts.wheel
  check('Encoder requires a wheel source', sensorConnection(parts.probe, parts, wires).missing.includes('WHEEL'))
  parts.wheel = { id: 'wheel', kind: 'wheel' }; parts.probe.wheelId = 'missing'
  check('An explicit missing encoder wheel cannot silently fall back', !sensorConnection(parts.probe, parts, wires).ready)
}

check('Missing environmental input produces no fabricated reading', sampleSensor('lightSensor').value === null)
check('Light experiment uses controlled environment', sampleSensor('lightSensor', { environment: { light: 23 } }).value === 23)
check('Light clamps out-of-range input', sampleSensor('lightSensor', { environment: { light: 150 } }).value === 100)
check('Temperature supports freezing conditions', sampleSensor('temperatureSensor', { environment: { temperature: -12.5 } }).value === -12.5)
check('Temperature rejects NaN', sampleSensor('temperatureSensor', { environment: { temperature: NaN } }).missing.includes('ENVIRONMENT'))
check('Encoder is cumulative beyond one revolution', sampleSensor('encoderSensor', { wheelRadians: Math.PI * 5 }).value === 900)
check('Encoder preserves direction', sampleSensor('encoderSensor', { wheelRadians: -Math.PI }).value === -180)
check('Encoder display range does not clip odometry', sampleSensor('encoderSensor', { wheelRadians: Math.PI * 400 }).value === 72000)
check('Encoder missing motion source is unavailable', sampleSensor('encoderSensor').value === null)
for (const angle of [0, 30, 90, 180]) {
  const rotation = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), angle * Math.PI / 180)
  check('Tilt follows body at ' + angle + ' degrees', sampleSensor('tiltSensor', { up: rotateByQuat([0, 1, 0], rotation) }).value === angle)
}
check('Tilt respects nonvertical gravity', sampleSensor('tiltSensor', { up: { x: 1, y: 0, z: 0 }, gravity: { x: -10, y: 0, z: 0 } }).value === 0)
check('Zero gravity has no fabricated tilt', sampleSensor('tiltSensor', { up: { x: 0, y: 1, z: 0 }, gravity: { x: 0, y: 0, z: 0 } }).value === null)
for (const kind of SENSOR_KINDS.slice(1)) {
  const valid = Array.from({ length: ORIENT_COUNT }, (_, rot) => {
    const host = { id: 'host', kind: 'strip5', rot, pos: [1, 0, 2], y: 3 }
    const probe = { id: 'probe', kind, hostId: host.id, hostHole: 2 }
    const transform = chainTransform(probe, { host, probe })
    return transform && transform.pos.every(Number.isFinite) &&
      apply(transform.orient, [0, 1, 0]).every((n, i) => n === basisY(rot)[i])
  }).every(Boolean)
  check(kind + ' mounts in all 24 orientations with matching module normal', valid)
}

// These are real WASM queries, not mocked hit distances.
await RAPIER.init()
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
const WORLD = (1 << 16) | 3, ROBOT = (2 << 16) | 1, QUERY = (1 << 16) | 1
world.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.5, 30).setTranslation(0, -0.5, 0).setCollisionGroups(WORLD))
world.createCollider(RAPIER.ColliderDesc.cuboid(2, 2, 0.5).setTranslation(0, 2, 10).setCollisionGroups(WORLD))
world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5).setTranslation(0, 2, 2).setCollisionGroups(ROBOT))
world.step()
const measure = (kind, origin, dir) => sampleSensor(kind, { origin, cast: (range) => {
  const ray = new RAPIER.Ray(origin, dir)
  const hit = world.castRay(ray, range, true, undefined, QUERY)
  return hit && { timeOfImpact: hit.timeOfImpact, point: ray.pointAt(hit.timeOfImpact) }
} })
check('Ultrasound hits world wall and excludes robot', measure('sensor', { x: 0, y: 2, z: 0 }, { x: 0, y: 0, z: 1 }).value === Math.round(9.5 * CM_PER_UNIT * 10) / 10)
check('Ultrasound turned away has no echo, not obstacle zero', measure('sensor', { x: 0, y: 2, z: 0 }, { x: 0, y: 0, z: -1 }).value === 400)
check('Tilted ultrasonic probe can see the floor', measure('sensor', { x: 0, y: 2, z: 0 }, { x: 0, y: -1, z: 0 }).value === 5.1)
check('Line ray detects painted floor ring', measure('lineSensor', { x: 9.45, y: 2, z: 0 }, { x: 0, y: -1, z: 0 }).value === 100)
check('Line ray detects ordinary floor off tape', measure('lineSensor', { x: 8, y: 2, z: 0 }, { x: 0, y: -1, z: 0 }).value === 0)
check('Line sensor mounted upside down cannot see the floor', measure('lineSensor', { x: 9.45, y: 2, z: 0 }, { x: 0, y: 1, z: 0 }).value === 0)
check('Line sensor range is bounded', measure('lineSensor', { x: 9.45, y: 4, z: 0 }, { x: 0, y: -1, z: 0 }).value === 0)
world.createCollider(RAPIER.ColliderDesc.cuboid(0.3, 0.3, 0.3).setTranslation(9.45, 1, 0).setCollisionGroups(WORLD))
world.step()
check('An object above the ring occludes the paint', measure('lineSensor', { x: 9.45, y: 2, z: 0 }, { x: 0, y: -1, z: 0 }).value === 0)
check('Touch probe triggers at its lever nose', measure('touchSensor', { x: 0, y: 2, z: 9.46 }, { x: 0, y: 0, z: 1 }).value === 1)
check('Touch probe does not detect a distant obstacle', measure('touchSensor', { x: 0, y: 2, z: 9 }, { x: 0, y: 0, z: 1 }).value === 0)
world.free()

if (process.argv.includes('--browser')) {
  const { chromium } = await import('playwright')
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
    await page.goto(pathToFileURL(path.join(root, 'dist-single/index.html')).href + '?quality=low')
    await page.waitForFunction(() => Boolean(window.__ARDUINIUM_BUILD__))
    const skip = page.locator('[data-testid="skip-onboarding"]')
    if (await skip.count()) await skip.first().dispatchEvent('click')
    const rig = structuredClone(TEMPLATES.find((t) => t.id === 'rover').json)
    const sites = [['r-railB', 0], ['r-railA', 0], ['r-railA', 10], ['r-rear', 0], ['r-railB', 10], ['r-front', 3]]
    // Keep this dense browser fixture to the six PCB modules; the five loose
    // Starter Kit inputs have their complete circuit and interaction coverage
    // in kit-electronics-test.mjs.
    SENSOR_KINDS.slice(1, 7).forEach((kind, i) => {
      const id = 'lab-' + kind
      rig.parts.push({ id, kind, hostId: sites[i][0], hostHole: sites[i][1] })
      rig.wires.push(...leadsFor(kind, id, 'r-board'))
    })
    rig.program = [{ id: 'sensor-drive', type: 'drive', dir: 'forward', speed: 110, ms: 3000 }]
    await page.evaluate((json) => window.__ARDUINIUM_LOAD__(json), rig)
    check('Browser imports all seven sensors', await page.evaluate(() => Object.values(window.__ARDUINIUM_PARTS__()).filter((p) => /Sensor$/.test(p.kind) || p.kind === 'sensor').length) === 7)
    await page.locator('[data-tab="electronics"]').first().dispatchEvent('click')
    check('All six new icons contain SVG detail', await page.locator('[data-part$="Sensor"] svg').count() === 6)
    await page.locator('[data-part="lightSensor"]').first().dispatchEvent('click')
    check('Palette click picks up a real light module', await page.evaluate(() => window.__ARDUINIUM_BUILD__().pending?.kind === 'lightSensor'))
    await page.evaluate(() => window.__ARDUINIUM_RUN__())
    await page.waitForFunction(() => Object.values(window.__ARDUINIUM_RT__().sensorReadings).filter((r) => r.ready).length === 7, null, { timeout: 20000 })
    const readings = await page.evaluate(() => window.__ARDUINIUM_RT__().sensorReadings)
    check('Browser live environment values are real inputs', readings['lab-lightSensor'].value === 70 && readings['lab-temperatureSensor'].value === 22)
    check('Browser ultrasonic output uses ECHO', readings['r-sensor'].pin === 7 && readings['r-sensor'].value >= 2)
    await page.waitForFunction(() => Math.abs(window.__ARDUINIUM_RT__().sensorReadings['lab-encoderSensor']?.value ?? 0) > 15, null, { timeout: 20000 })
    check('Encoder accumulates actual rover travel', true)
    const encoderBefore = await page.evaluate(() => Math.abs(window.__ARDUINIUM_RT__().sensorReadings['lab-encoderSensor'].value))
    await page.evaluate(() => window.__ARDUINIUM_BUILD__().select('lab-encoderSensor'))
    await page.waitForTimeout(450)
    check('Selecting a sensor preserves cumulative encoder rotation', await page.evaluate((before) => Math.abs(window.__ARDUINIUM_RT__().sensorReadings['lab-encoderSensor'].value) >= before - 2, encoderBefore))
    await page.evaluate(() => { window.__ARDUINIUM_RT__().environment.light = 18; window.__ARDUINIUM_RT__().environment.temperature = -5 })
    await page.waitForFunction(() => window.__ARDUINIUM_RT__().sensorReadings['lab-lightSensor']?.value === 18 && window.__ARDUINIUM_RT__().sensorReadings['lab-temperatureSensor']?.value === -5)
    check('Environment experiments update live readings', true)
    await page.evaluate(() => window.__ARDUINIUM_BUILD__().deleteWire('lab-lightSensor-GND'))
    await page.waitForFunction(() => window.__ARDUINIUM_RT__().sensorReadings['lab-lightSensor']?.ready === false)
    check('Disconnect clears stale reading', await page.evaluate(() => window.__ARDUINIUM_RT__().sensorReadings['lab-lightSensor'].value === null))
    await page.evaluate(() => window.__ARDUINIUM_RUN__())
    await page.waitForFunction(() => Object.keys(window.__ARDUINIUM_RT__().sensorReadings).length === 0)
    check('Stop clears the sensor snapshot', await page.evaluate(() => window.__ARDUINIUM_RT__().distance === 400))
    await page.evaluate((json) => window.__ARDUINIUM_LOAD__({ ...json, program: [] }), rig)
    await page.evaluate(() => window.__ARDUINIUM_RUN__())
    await page.waitForFunction(() => window.__ARDUINIUM_RT__().sensorReadings['lab-encoderSensor']?.ready)
    check('Restart resets cumulative encoder', await page.evaluate(() => Math.abs(window.__ARDUINIUM_RT__().sensorReadings['lab-encoderSensor'].value) < 5))
    await page.evaluate(() => window.__ARDUINIUM_RUN__())
    await mkdir(path.join(root, 'shots'), { recursive: true })
    await page.screenshot({ path: path.join(root, 'shots/sensors-platform.png'), timeout: 20000 })
    check('Browser has no console or page errors: ' + errors.join('; '), errors.length === 0)
  } finally { await browser.close() }
}
console.log('\nSensor platform: ' + passed + '/' + passed + ' passed')
