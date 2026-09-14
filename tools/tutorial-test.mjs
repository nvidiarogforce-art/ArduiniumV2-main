/** Academy curriculum + responsive browser gate. Run after npm run build:single. */
import assert from 'node:assert/strict'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
import { CATALOGUE } from '../src/lib/parts.js'
import { SENSOR_KINDS } from '../src/lib/sensors.js'
import { getWorkshopCopy } from '../src/i18n/workshopCopy.js'
import { WORKSHOP_LESSONS, WIRING_PLANS, cleanProgress, createEvidence, observeWorkshop, lessonReady, driveProgram, lineCondition } from '../src/lib/workshopLessons.js'

let passed = 0
const check = (name, fn) => { fn(); passed++; console.log('PASS', name) }
const pass = (name) => { passed++; console.log('PASS', name) }
async function screenshot(page, output) {
  let last
  for (let attempt = 0; attempt < 3; attempt++) {
    try { await page.screenshot({ path: output, timeout: 15000 }); return }
    catch (error) { last = error; await page.waitForTimeout(350) }
  }
  throw last
}

check('Five action-checked lessons cover building, LED, rover, ultrasound and line feedback', () => {
  assert.deepEqual(WORKSHOP_LESSONS.map((x) => x.id), ['basics', 'led', 'rover', 'ultrasonic', 'line'])
  assert.ok(WORKSHOP_LESSONS.every((x) => x.steps.length === 3 && x.actions.length === 3))
})
check('Every catalogue part has a complete three-language reference card', () => {
  for (const locale of ['en', 'ru', 'uz']) for (const kind of new Set(Object.values(CATALOGUE).flat())) {
    const item = getWorkshopCopy(locale).parts[kind]
    for (const field of ['name', 'purpose', 'connects', 'pins', 'mistake', 'try']) assert.ok(item?.[field], `${locale}.${kind}.${field}`)
  }
})
check('Each sensor has a complete illustrated wiring plan', () => {
  assert.ok(SENSOR_KINDS.every((kind) => WIRING_PLANS[kind]?.length >= (kind === 'pushButton' ? 2 : 3)))
  assert.ok(SENSOR_KINDS.every((kind) => WIRING_PLANS[kind].some((wire) => ['OUT', 'ECHO', 'NO'].includes(wire.from))))
})
check('Corrupt saved progress cannot skip lesson steps', () => {
  const clean = cleanProgress({ active: 'bad', completed: { basics: ['frame', 'xyz'], led: 'all' } })
  assert.equal(clean.active, null)
  assert.deepEqual(clean.completed.basics, ['frame'])
  assert.deepEqual(clean.completed.led, [])
})
check('Run alone never passes construction, code or sensor lessons', () => {
  const empty = { parts: {}, wires: [], bolts: [], program: [], running: true, pinMap: () => ({}) }
  for (const lesson of WORKSHOP_LESSONS) for (const step of lesson.steps) assert.equal(lessonReady(step, empty, {}, {}), false, step)
})
check('XYZ lesson requires all three axes on one real strip', () => {
  const p0 = { id: 'a', kind: 'strip7', pos: [0, 0, 0], y: .045 }
  let b = { parts: { a: p0 }, wires: [], bolts: [], program: [], running: false, pinMap: () => ({}) }
  const e = createEvidence(b)
  for (const [axis, value] of [[0, .5], [1, .5], [2, .5]]) {
    const old = b.parts.a, pos = [...old.pos], next = { ...old, pos, y: old.y }
    if (axis === 1) next.y = value; else next.pos[axis] = value
    b = { ...b, parts: { a: next } }; observeWorkshop(e, b, {}, {})
  }
  assert.equal(lessonReady('xyz', b, {}, e), true)
})
check('Drive and line lessons accept immediate first commands after automatic warmup', () => {
  assert.equal(driveProgram([{ type: 'drive', dir: 'forward', speed: 140, ms: 1500 }]), true)
  const loop = { type: 'forever', body: [{ type: 'ifCompare', a: { src: 'sensor', pin: 14 }, op: '<', b: { src: 'num', value: 50 }, body: [{ type: 'drive', dir: 'left', speed: 100, ms: 150 }], elseBody: [{ type: 'drive', dir: 'right', speed: 100, ms: 150 }] }] }
  assert.ok(lineCondition([loop]))
})

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const errors = []
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(pathToFileURL(path.resolve('dist-single/index.html')).href + '?quality=low')
  await page.waitForFunction(() => Boolean(window.__ARDUINIUM_BUILD__))
  await page.locator('[data-testid="skip-onboarding"]').dispatchEvent('click')
  await page.locator('[data-testid="workshop-guide"]').dispatchEvent('click')
  await page.waitForSelector('[data-testid="workshop-guide-panel"]')
  assert.equal(await page.locator('[data-guide-lesson]').count(), 5)
  pass('Academy opens with five experiments and real progress counts')
  await page.locator('[data-guide-lesson="basics"]').dispatchEvent('click')
  assert.equal(await page.locator('[data-testid="workshop-guide-next"]').isDisabled(), true)
  pass('Fresh lesson is gated until the requested build action exists')
  await page.locator('[data-testid="workshop-guide-library"]').dispatchEvent('click')
  await page.locator('.workshop-guide-search input').fill('sensor')
  assert.ok(await page.locator('[data-guide-part]').count() >= 7)
  pass('Part search exposes the sensor reference cards whose names match the query')
  await page.locator('[data-guide-part="sensor"]').dispatchEvent('click')
  assert.equal(await page.locator('[data-guide-route]').count(), 4)
  await page.locator('[data-guide-route="ECHO"]').dispatchEvent('click')
  pass('Circuit diagram routes are individually interactive')
  await page.locator('[data-testid="language"]').dispatchEvent('click')
  await page.locator('[data-locale="uz"]').dispatchEvent('click')
  await page.waitForFunction(() => document.querySelector('[data-testid="workshop-guide-panel"]')?.textContent.includes('Kutubxona'))
  pass('Open Academy translates live to Uzbek')
  await mkdir('shots', { recursive: true })
  await screenshot(page, 'shots/academy-desktop.png')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(300)
  const fit = await page.locator('[data-testid="workshop-guide-panel"]').evaluate((el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, scrollable: el.querySelector('.workshop-guide-content').scrollHeight >= el.querySelector('.workshop-guide-content').clientHeight } })
  check('Mobile Academy stays inside the viewport and remains scrollable', () => assert.ok(fit.left >= 0 && fit.right <= 390 && fit.top >= 0 && fit.bottom <= 844 && fit.scrollable))
  await screenshot(page, 'shots/academy-mobile.png')
  check('Academy browser workflow has no runtime errors', () => assert.deepEqual(errors, []))
} finally { await browser.close() }
console.log(`${passed}/${passed} PASS`)
