import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { MAPS } from '../src/lib/maps.js'
import { MISSIONS, getMission } from '../src/lib/missions.js'
import { LINE_TRACKS, isPointOnTrack } from '../src/lib/lineTracks.js'
import { getTemplate } from '../src/lib/templates.js'
import { MAP_COPY } from '../src/i18n/mapCopy.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const url = 'file://' + path.join(root, 'dist-single', 'index.html') + '?quality=high'
const results = []
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)

check('Exactly four task maps are authored', MAPS.length === 4, MAPS.map((map) => map.id).join(', '))
check('Every map has a mission in the same environment', MAPS.every((map) => getMission(map.defaultMission).map === map.id))
check('Challenge arena offers four distinct tasks', MISSIONS.filter((mission) => mission.map === 'challengeArena').length === 4)
check('Line lab offers three track variants', MISSIONS.filter((mission) => mission.map === 'lineLab').length === 3)
check('EN/RU/UZ contain every map and mission label', Object.values(MAP_COPY).every((copy) =>
  MAPS.every((map) => copy.maps[map.id]?.name && copy.maps[map.id]?.blurb) &&
  MISSIONS.filter((mission) => mission.map && !['firstMetres', 'followLine', 'tightSqueeze', 'pushCrate'].includes(mission.id))
    .every((mission) => copy.missions[mission.id]?.name && copy.missions[mission.id]?.goal)))
check('Every rendered line sample is sensed as tape', Object.values(LINE_TRACKS).every((track) => track.points.every(([x, z]) => isPointOnTrack(track.id, x, z))))
check('Every line checkpoint lies on its visible tape', Object.values(LINE_TRACKS).every((track) => track.checkpoints.every(([x, z]) => isPointOnTrack(track.id, x, z))))

const lineMap = MAPS.find((map) => map.id === 'lineLab')
const floorHalf = lineMap.size / 2
const [surfaceX, surfaceZ] = lineMap.surface.center
const [surfaceWidth, surfaceDepth] = lineMap.surface.size
const surfaceEdge = Math.max(Math.abs(surfaceX) + surfaceWidth / 2, Math.abs(surfaceZ) + surfaceDepth / 2)
check('Line-lab collider covers the complete visible calibration surface', floorHalf >= surfaceEdge, `floor ±${floorHalf}, surface edge ${surfaceEdge}`)
const minimumTrackClearance = Math.min(...Object.values(LINE_TRACKS).flatMap((track) =>
  track.points.map(([x, z]) => Math.min(floorHalf - Math.abs(x), floorHalf - Math.abs(z)))))
check('Every course leaves a full rover footprint on the ground collider', minimumTrackClearance >= 3.5, `${minimumTrackClearance.toFixed(2)} units`)
check('Line-lab perimeter remains supported by the ground collider', lineMap.half + 0.21 <= floorHalf, `wall ${lineMap.half + 0.21}, floor ${floorHalf}`)

const lineRover = getTemplate('lineRover')?.json
check('Line-rover starter owns a downward line sensor', lineRover?.parts.some((part) => part.kind === 'lineSensor'))
check('Line-rover sensor reaches A0 with power and ground', ['VCC', 'GND', 'OUT'].every((terminal) => lineRover?.wires.some((wire) => [wire.a, wire.b].some((end) => end.partId === 'r-line' && end.terminal === terminal))))
check('Line-rover program reads sensor pin 14', JSON.stringify(lineRover?.program).includes('"pin":14'))

const circuit = getTemplate('breadboardLed')?.json
check('Circuit-lab starter uses physical breadboard footprints', circuit?.parts.some((part) => part.kind === 'breadboard') && circuit.parts.filter((part) => part.breadboardId).length === 2)

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } })
page.setDefaultTimeout(18000)
const errors = []
page.on('pageerror', (error) => errors.push('pageerror: ' + error.message))
page.on('console', (message) => { if (message.type() === 'error') errors.push('console: ' + message.text()) })

await page.goto(url, { waitUntil: 'load' })
try {
  await page.waitForSelector('canvas')
} catch (error) {
  console.error('Canvas did not mount:', errors.join(' | '))
  throw error
}
await page.waitForTimeout(2200)
const tap = async (selector) => { await page.locator(selector).first().dispatchEvent('click'); await page.waitForTimeout(320) }
await tap('[data-testid="skip-onboarding"]')
if (await page.locator('[data-testid="templates"]').count() === 0) {
  console.error('Top bar missing after onboarding:', errors.join(' | '), await page.locator('body').innerText())
}

const templates = { circuitLab: 'breadboardLed', provingGround: 'rover', challengeArena: 'rover', lineLab: 'lineRover' }
for (const map of MAPS) {
  await page.evaluate((id) => {
    const build = window.__ARDUINIUM_BUILD__()
    if (build.running) build.toggleRun()
    const ui = window.__ARDUINIUM_UI__()
    ui.setMap(id)
    ui.setWorkflowMode('simulate')
  }, map.id)
  await page.waitForTimeout(120)
  if (await page.locator('[data-testid="templates"]').count() === 0) {
    console.error(`Top bar missing after setMap(${map.id}):`, errors.join(' | '), await page.locator('body').innerText())
  }
  await tap('[data-testid="templates"]')
  await tap(`[data-template="${templates[map.id]}"]`)
  await page.evaluate(() => window.__ARDUINIUM_UI__().requestCamera('mapHome'))
  await page.waitForTimeout(1000)
  const state = await page.evaluate(() => ({ summary: window.__ARDUINIUM__(), scene: window.__ARDUINIUM_SCENE__() }))
  check(`${map.id}: selector applies its default mission`, state.summary.map === map.id && state.summary.mission === map.defaultMission, `${state.summary.map}/${state.summary.mission}`)
  check(`${map.id}: render budget stays bounded`, state.scene.drawCalls < 900 && state.scene.tris < 180000, `${state.scene.drawCalls} calls, ${state.scene.tris} tris, ${state.scene.geometries} geometries, ${state.scene.materials} materials, ${state.scene.textures} textures`)
  await page.screenshot({ path: path.join(root, 'shots', `map-${map.id}.png`) })
  // Orthographic-like engineering views expose props that look plausible in
  // perspective but are actually outside a bay, backwards, or sunk.
  for (const view of ['top', 'front']) {
    await page.evaluate((next) => window.__ARDUINIUM_UI__().requestCamera(next), view)
    await page.waitForTimeout(520)
    await page.screenshot({ path: path.join(root, 'shots', `map-${map.id}-${view}.png`) })
  }
  await page.evaluate(() => window.__ARDUINIUM_UI__().requestCamera('mapHome'))
  await page.waitForTimeout(320)
}

// Every course variant begins beneath the real front-centre sensor and is
// rendered from the same samples the sensor reads.
for (const missionId of ['lineOval', 'lineFigure8', 'lineSwitchback']) {
  await page.evaluate((id) => {
    window.__ARDUINIUM_UI__().setMission(id)
    window.__ARDUINIUM_UI__().requestCamera('mapHome')
  }, missionId)
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(root, 'shots', `${missionId}.png`) })
  await page.evaluate(() => window.__ARDUINIUM_RUN__())
  await page.waitForFunction(() => {
    const reading = Object.values(window.__ARDUINIUM_RT__().sensorReadings).find((value) => value.kind === 'lineSensor')
    return reading && !reading.missing.includes('PHYSICS')
  }, null, { timeout: 2800 }).catch(() => {})
  const reading = await page.evaluate(() => Object.values(window.__ARDUINIUM_RT__().sensorReadings).find((value) => value.kind === 'lineSensor'))
  check(`${missionId}: live sensor starts on its visible tape`, reading?.ready === true && reading.value === 100, JSON.stringify(reading))
  await page.evaluate(() => window.__ARDUINIUM_BUILD__().toggleRun())
  await page.waitForTimeout(180)
}
await page.evaluate(() => window.__ARDUINIUM_UI__().setMission('lineOval'))

// The line sensor continues sampling while the robot is physically live.
await page.evaluate(() => window.__ARDUINIUM_RUN__())
await page.waitForTimeout(1550)
const lineReading = await page.evaluate(() => Object.values(window.__ARDUINIUM_RT__().sensorReadings).find((reading) => reading.kind === 'lineSensor'))
check('Live line sensor sees the selected track', lineReading?.ready === true && lineReading.value === 100, JSON.stringify(lineReading))
const lineSupportSamples = []
for (let i = 0; i < 24; i += 1) {
  await page.waitForTimeout(400)
  lineSupportSamples.push(await page.evaluate(() => window.__ARDUINIUM_RT__().robotPos.slice()))
}
await page.screenshot({ path: path.join(root, 'shots', 'lineOval-supported-run.png') })
const minimumLineY = Math.min(...lineSupportSamples.map((sample) => sample[1]))
const maximumLineRadius = Math.max(...lineSupportSamples.map(([x, , z]) => Math.max(Math.abs(x), Math.abs(z))))
check('Line rover stays supported through the first oval bends', minimumLineY > 0.3, `minimum wheel-centre Y ${minimumLineY.toFixed(3)}`)
check('Line rover remains inside the supported floor', maximumLineRadius < floorHalf - 0.5, `furthest axis ${maximumLineRadius.toFixed(2)} / ${floorHalf}`)
await page.evaluate(() => window.__ARDUINIUM_BUILD__().toggleRun())
await page.waitForTimeout(350)

// Reproduce the former failure directly: place the complete build at the
// oval's outer Z=26 turn, where the old ±27 collider left only one unit under
// the wheels even though the white surface continued beyond it.
const edgeLineRover = structuredClone(lineRover)
for (const part of edgeLineRover.parts) if (Array.isArray(part.pos)) part.pos[2] += 26
await page.evaluate((json) => {
  window.__ARDUINIUM_UI__().setMap('lineLab')
  window.__ARDUINIUM_UI__().setMission('lineOval')
  window.__ARDUINIUM_LOAD__(json)
  window.__ARDUINIUM_UI__().requestCamera('mapHome')
}, edgeLineRover)
await page.waitForTimeout(500)
await page.evaluate(() => window.__ARDUINIUM_RUN__())
await page.waitForTimeout(1800)
const edgeStartReading = await page.evaluate(() => Object.values(window.__ARDUINIUM_RT__().sensorReadings).find((reading) => reading.kind === 'lineSensor'))
const edgeSupportSamples = []
for (let i = 0; i < 12; i += 1) {
  await page.waitForTimeout(400)
  edgeSupportSamples.push(await page.evaluate(() => window.__ARDUINIUM_RT__().robotPos.slice()))
}
await page.screenshot({ path: path.join(root, 'shots', 'lineOval-outer-turn-run.png') })
const minimumEdgeY = Math.min(...edgeSupportSamples.map((sample) => sample[1]))
check('Outer-turn sensor starts on the same visible tape', edgeStartReading?.ready === true && edgeStartReading.value === 100, JSON.stringify(edgeStartReading))
check('Outer-turn wheels remain supported by the enlarged collider', minimumEdgeY > 0.3, `minimum wheel-centre Y ${minimumEdgeY.toFixed(3)}`)
await page.evaluate(() => window.__ARDUINIUM_BUILD__().toggleRun())
await page.waitForTimeout(350)

// A correctly wired breadboard circuit completes the electronics mission.
await page.evaluate(() => window.__ARDUINIUM_UI__().setMap('circuitLab'))
await tap('[data-testid="templates"]')
await tap('[data-template="breadboardLed"]')
await page.evaluate(() => window.__ARDUINIUM_RUN__())
await page.waitForFunction(() => window.__ARDUINIUM_RT__().clock > 2400, null, { timeout: 12000 })
const circuitState = await page.evaluate(() => ({ won: window.__ARDUINIUM_UI__().missionWon, mission: window.__ARDUINIUM_UI__().mission, running: window.__ARDUINIUM_BUILD__().running, program: window.__ARDUINIUM_BUILD__().program, clock: window.__ARDUINIUM_RT__().clock, programClock: window.__ARDUINIUM_RT__().programClock, pins: { ...window.__ARDUINIUM_RT__().pinHigh }, serial: window.__ARDUINIUM_BUILD__().serial.slice(-5) }))
check('Breadboard LED mission is proven by the live circuit', circuitState.won, JSON.stringify(circuitState))
await page.evaluate(() => { const b = window.__ARDUINIUM_BUILD__(); if (b.running) b.toggleRun(); window.__ARDUINIUM_UI__().dismissWin() })
await page.waitForTimeout(350)

// The remote is a momentary override and releases cleanly back to code.
await page.evaluate(() => window.__ARDUINIUM_UI__().setMap('challengeArena'))
await tap('[data-testid="templates"]')
await tap('[data-template="rover"]')
await page.evaluate(() => { window.__ARDUINIUM_SETPROG__([{ id: 'wait', type: 'wait', ms: 10000 }]); window.__ARDUINIUM_RUN__() })
await page.waitForFunction(() => window.__ARDUINIUM_RT__().clock > 1250, null, { timeout: 10000 })
const before = await page.evaluate(() => window.__ARDUINIUM_RT__().robotPos.slice())
await page.locator('[data-drive="forward"]').dispatchEvent('pointerdown')
await page.waitForFunction((start) => {
  const now = window.__ARDUINIUM_RT__().robotPos
  return Math.hypot(now[0] - start[0], now[2] - start[2]) > 0.35
}, before, { timeout: 8000 })
await page.locator('[data-drive="forward"]').dispatchEvent('pointerup')
await page.waitForTimeout(300)
const remote = await page.evaluate(() => ({ pos: window.__ARDUINIUM_RT__().robotPos.slice(), active: window.__ARDUINIUM_RT__().manualDrive }))
check('On-screen remote physically drives the rover', Math.hypot(remote.pos[0] - before[0], remote.pos[2] - before[2]) > 0.35, `${JSON.stringify(before)} → ${JSON.stringify(remote.pos)}`)
check('Releasing the remote clears its override', remote.active === null)

// Narrow/touch layout: controls stay reachable and a lost focus cannot leave
// the motors latched on.
await page.setViewportSize({ width: 900, height: 700 })
await page.waitForTimeout(400)
const narrowUi = await page.evaluate(() => {
  const remote = document.querySelector('[data-testid="drive-remote"]')?.getBoundingClientRect()
  const key = document.querySelector('[data-drive="forward"]')?.getBoundingClientRect()
  const mission = document.querySelector('.mission-banner')?.getBoundingClientRect()
  const rail = document.querySelector('.mode-rail')?.getBoundingClientRect()
  return {
    remote: remote && { left: remote.left, right: remote.right, top: remote.top, bottom: remote.bottom },
    key: key && { width: key.width, height: key.height },
    noMissionRailOverlap: !mission || !rail || mission.left >= rail.right,
    noHorizontalOverflow: document.documentElement.scrollWidth <= innerWidth,
  }
})
check('Narrow remote stays inside the viewport', narrowUi.remote?.left >= 0 && narrowUi.remote?.right <= 900 && narrowUi.remote?.top >= 0 && narrowUi.remote?.bottom <= 700, JSON.stringify(narrowUi.remote))
check('Remote touch target is at least 44×44', narrowUi.key?.width >= 44 && narrowUi.key?.height >= 44, JSON.stringify(narrowUi.key))
check('Mission banner clears the workflow rail', narrowUi.noMissionRailOverlap)
check('Narrow HUD has no horizontal overflow', narrowUi.noHorizontalOverflow)
await page.screenshot({ path: path.join(root, 'shots', 'map-remote-narrow.png') })
await page.locator('[data-drive="forward"]').dispatchEvent('pointerdown')
await page.evaluate(() => window.dispatchEvent(new Event('blur')))
await page.waitForTimeout(100)
check('Window blur releases a held remote direction', await page.evaluate(() => window.__ARDUINIUM_RT__().manualDrive === null))
await page.evaluate(() => { const b = window.__ARDUINIUM_BUILD__(); if (b.running) b.toggleRun() })

check('No browser errors across maps, sensors and remote', errors.length === 0, errors.join(' | '))
await browser.close()

console.log(results.join('\n'))
const failed = results.filter((line) => line.startsWith('FAIL'))
console.log(`\n${results.length - failed.length}/${results.length} PASS`)
if (failed.length) process.exit(1)
