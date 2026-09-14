/** Regression gate for the Meccano robot-arm expansion. */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { planAssembly } from '../src/lib/assembly.js'
import { outputConnection } from '../src/lib/circuits.js'
import { CATEGORY, holeCount, spec, worldNodes } from '../src/lib/geometry.js'
import { getTemplate } from '../src/lib/templates.js'

const results = []
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)

async function screenshotWithRetry(page, outputPath, attempts = 3) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await page.screenshot({ path: outputPath })
      return
    } catch (error) {
      lastError = error
      if (attempt < attempts) await page.waitForTimeout(180)
    }
  }
  throw lastError
}

const template = structuredClone(getTemplate('robotArm').json)
const sourceParts = Object.fromEntries(template.parts.map((part) => [part.id, part]))
const plan = planAssembly(sourceParts, template.bolts)

check('Robot-arm starter exists', Boolean(template), template?.name)
check('3×5 plate exposes 15 real holes', holeCount('plate3x5') === 15, String(holeCount('plate3x5')))
check('15-hole boom exposes 15 holes', holeCount('strip15') === 15, String(holeCount('strip15')))
check('Five-hole palm leaves room for wrist, jaws and servos', holeCount('gripperPalm') === 5, String(holeCount('gripperPalm')))
check('Arm plans six articulated joints', plan.hinges.length === 6, plan.hinges.map((h) => h.id).join(', '))
check('Turntable centre is a real yaw hinge', plan.hinges.some((h) => h.id === 'ab-turn' && Math.abs(h.axis.y) === 1))
check('Shoulder is a side-axis hinge', plan.hinges.some((h) => h.id === 'ab-shoulder' && Math.abs(h.axis.z) === 1))
check('Two base bolts make the lower race rigid', plan.groupOf('a-turn-base') === plan.groupOf('a-base'))
check('Two tower bolts make its plate rigid', plan.groupOf('a-tower') === plan.groupOf('a-tower-plate'))

const upright = { id: 'u', kind: 'upright', hostId: 'host', hostHole: 2, spin: 0 }
const uprightParts = {
  host: { id: 'host', kind: 'strip5', pos: [0, 0, 0], y: 0.045, rot: 0, rotY: 0 },
  u: upright,
}
const sideNodes = worldNodes(upright, uprightParts)
check('Upright face holes use their visible side axis', sideNodes.length === 3 && sideNodes.every((node) => Math.abs(node.axis[2]) === 1), JSON.stringify(sideNodes.map((n) => n.axis)))

const servos = Object.values(sourceParts).filter((part) => part.kind === 'servo')
const readyServos = servos.filter((servo) => outputConnection(servo, sourceParts, template.wires).ready)
check('All six arm servos are powered and signalled', readyServos.length === 6, `${readyServos.length}/6`)
const horns = Object.values(sourceParts).filter((part) => part.kind === 'servoHorn')
check('Six visible horns snap onto six real servo shafts',
  horns.length === 6 && horns.every((horn) =>
    sourceParts[horn.hostId]?.kind === 'servo' &&
    spec(horn.kind).mountTo === CATEGORY.SERVO_SHAFT),
  horns.map((horn) => horn.id + '->' + horn.hostId).join(', '))
check('Every arm hinge derives its actuator from its horn chain',
  plan.hinges.length === 6 && plan.hinges.every((hinge) =>
    hinge.actuatorId && sourceParts[hinge.actuatorId]?.kind === 'servo'),
  plan.hinges.map((hinge) => hinge.id + ':' + hinge.actuatorId).join(', '))
check('Robot-arm base is explicitly bench-anchored', sourceParts['a-base'].anchored === true)

const here = path.dirname(fileURLToPath(import.meta.url))
const url = 'file://' + path.resolve(here, '..', 'dist-single', 'index.html') + '?quality=low'
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } })
page.setDefaultTimeout(15000)
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })

await page.goto(url, { waitUntil: 'load' })
await page.waitForSelector('canvas')
await page.waitForTimeout(1400)
await page.locator('[data-testid="skip-onboarding"]').first().dispatchEvent('click')
await page.locator('[data-testid="templates"]').dispatchEvent('click')
await page.locator('[data-template="robotArm"]').dispatchEvent('click')
await page.waitForTimeout(500)
await screenshotWithRetry(page, path.resolve(here, '..', 'shots', 'robot-arm-build.png'))

const loaded = await page.evaluate(() => {
  const build = window.__ARDUINIUM_BUILD__()
  const report = build.circuitReport()
  return {
    parts: Object.keys(build.parts).length,
    bolts: build.bolts.length,
    boltIds: build.bolts.map((bolt) => bolt.id),
    wires: build.wires.length,
    program: build.program.map((block) => block.type),
    pins: Object.keys(build.pinMap()).map(Number).sort((a, b) => a - b),
    issues: report.issues,
  }
})

check('Loader preserves every robot-arm part', loaded.parts === template.parts.length, `${loaded.parts}/${template.parts.length}`)
check('Loader preserves every valid bolt', loaded.bolts === template.bolts.length, `${loaded.bolts}/${template.bolts.length}: ${loaded.boltIds.join(', ')}`)
check('Loader preserves every breadboard wire', loaded.wires === template.wires.length, `${loaded.wires}/${template.wires.length}`)
check('Servo blocks survive v4 validation', loaded.program.filter((type) => type === 'servo').length === 8, loaded.program.join(', '))
check('All servo signal pins reach the Arduino', [3, 5, 6, 9, 10, 11].every((pin) => loaded.pins.includes(pin)), loaded.pins.join(', '))
check('Starter circuit has no electrical fault', loaded.issues.length === 0, JSON.stringify(loaded.issues))
const sceneMetrics = await page.evaluate(() => window.__ARDUINIUM_SCENE__())
check('Robot arm stays below 900 draw calls', sceneMetrics.drawCalls <= 900, String(sceneMetrics.drawCalls))
check('Robot arm stays below 150k triangles', sceneMetrics.tris <= 150000, String(sceneMetrics.tris))

const run = page.locator('[data-testid="run"]')
if (await run.count()) {
  await run.dispatchEvent('click')
  await page.waitForFunction(() => window.__ARDUINIUM_RT__().clock > 900, null, { timeout: 8000 })
  const wristBeforeCommand = await page.evaluate(() => window.__ARDUINIUM_RT__().wireDebug['aw-wrist-sig']?.from?.slice())
  await page.waitForFunction(() => {
    const angles = window.__ARDUINIUM_RT__().servoAngle
    return angles[5] === 35 && angles[6] === 135 && angles[9] === 75
  }, null, { timeout: 12000 })
  await page.waitForTimeout(900)
  await screenshotWithRetry(page, path.resolve(here, '..', 'shots', 'robot-arm-run.png'))
  const running = await page.evaluate(() => window.__ARDUINIUM__().running)
  check('Articulated arm enters live physics', running === true, String(running))
  const physics = await page.evaluate(() => ({
    joints: window.__ARDUINIUM_RT__().jointDebug,
    wires: window.__ARDUINIUM_RT__().wireDebug,
  }))
  const expectedActuators = {
    'ab-turn': 'a-servo-base', 'ab-shoulder': 'a-servo-shoulder',
    'ab-elbow': 'a-servo-elbow', 'ab-wrist': 'a-servo-wrist',
    'ab-jaw-l': 'a-servo-grip-l', 'ab-jaw-r': 'a-servo-grip-r',
  }
  check('Each live hinge is driven by its intended servo', Object.entries(expectedActuators).every(([hinge, servo]) => physics.joints[hinge]?.actuator === servo), JSON.stringify(physics.joints))
  check('Servo blocks command non-zero physical joint targets',
    ['ab-shoulder', 'ab-elbow', 'ab-wrist'].every((id) => Math.abs(physics.joints[id]?.target ?? 0) > 0.15),
    JSON.stringify(physics.joints))
  check('All 22 leads keep live physical endpoints', Object.keys(physics.wires).length === template.wires.length, `${Object.keys(physics.wires).length}/${template.wires.length}`)
  const wristAfterCommand = physics.wires['aw-wrist-sig']?.from
  const wristTravel = wristBeforeCommand && wristAfterCommand
    ? Math.hypot(...wristAfterCommand.map((value, index) => value - wristBeforeCommand[index]))
    : 0
  check('Commanded servos physically move the arm and attached wiring', wristTravel > 0.2, wristTravel.toFixed(3))
  check('Arm remains raised after Run', physics.wires['aw-wrist-sig']?.from?.[1] > 7, JSON.stringify(physics.wires['aw-wrist-sig']))
  const wristScreen = wristAfterCommand
    ? await page.evaluate((point) => window.__ARDUINIUM_SCENE__().project(point), wristAfterCommand)
    : null
  check('Extended arm remains visible beside the open Parts drawer',
    wristScreen && !wristScreen.behind && wristScreen.x > 390 && wristScreen.x < 1460 && wristScreen.y > 80 && wristScreen.y < 900,
    JSON.stringify(wristScreen))
} else {
  check('Articulated arm enters live physics', false, 'Run control not found')
}

check('No browser errors during arm load/run', errors.length === 0, errors.join(' | '))
await browser.close()

console.log(results.join('\n'))
const failed = results.filter((line) => line.startsWith('FAIL')).length
console.log(`\n${results.length - failed}/${results.length} PASS`)
if (failed) process.exitCode = 1
