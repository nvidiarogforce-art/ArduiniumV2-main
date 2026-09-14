/** A rover with a sensor mast on an upright post, for eyeballing the geometry. */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const here = path.dirname(fileURLToPath(import.meta.url))
const url = 'file://' + path.resolve(here, '..', '..', 'dist-single', 'index.html') + '?quality=high'

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } })
page.setDefaultTimeout(20000)
page.on('pageerror', (e) => console.log('PAGEERROR: ' + e.message))
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE: ' + m.text()))

await page.goto(url, { waitUntil: 'load' })
await page.waitForSelector('canvas')
await page.waitForTimeout(2400)
await page.locator('[data-testid="skip-onboarding"]').first().dispatchEvent('click')
await page.waitForTimeout(300)

// Load the rover, then build a mast on its front cross-member and put the
// sensor at the top of it. Loading goes through the UI: __ARDUINIUM_LOAD__
// takes a build JSON, not a template id.
const tap = async (sel) => {
  await page.locator(sel).first().dispatchEvent('click')
  await page.waitForTimeout(300)
}
await tap('[data-testid="templates"]')
await tap('[data-template="rover"]')
await page.waitForTimeout(1400)

const built = await page.evaluate(() => {
  const b = () => window.__ARDUINIUM_BUILD__()
  const place = (kind, at, hint) => {
    const before = new Set(Object.keys(b().parts))
    b().beginPlace(kind)
    b().movePending(at, hint)
    b().commitPlace()
    return Object.keys(b().parts).find((id) => !before.has(id)) ?? null
  }
  // Move the sensor off the cross-member so its hole is free for the post.
  const sensor = Object.values(b().parts).find((p) => p.kind === 'sensor')
  if (sensor) b().deletePart(sensor.id)

  const nodes = window.__ARDUINIUM_NODES__('upright')
  const front = nodes.find((n) => n.partId === 'r-front' && n.index === 3)
  const postId = front ? place('upright', front.pos, { partId: 'r-front', index: 3 }) : null

  const levels = window.__ARDUINIUM_NODES__('sensor').filter((n) => n.partId === postId)
  const top = levels[levels.length - 1]
  const sensorId = top ? place('sensor', top.pos, { partId: postId, index: top.index }) : null

  return {
    postId,
    sensorId,
    levels: levels.map((n) => n.pos[1].toFixed(2)),
    sensorY: sensorId ? window.__ARDUINIUM_XFORM__(sensorId)?.pos[1].toFixed(2) : null,
  }
})
console.log('built:', JSON.stringify(built))

await page.evaluate(() => window.__ARDUINIUM_UI__().toggleDrawer('bottom'))
await page.waitForTimeout(200)
await page.locator('[data-view="side"]').first().dispatchEvent('click').catch(() => {})
await page.waitForTimeout(1200)
await page.screenshot({ path: path.resolve(here, '..', '..', 'shots', 'upright-mast.png') })
console.log('OK -> shots/upright-mast.png')

// A mast raises the centre of mass. Check the thing still drives rather than
// tipping over or detonating the solver.
await page.locator('[data-testid="run"]').first().dispatchEvent('click')
await page.waitForTimeout(7000)
const ran = await page.evaluate(() => {
  const a = window.__ARDUINIUM__()
  return { pos: a.robotPos.map((v) => +v.toFixed(2)), distance: a.distance }
})
console.log('after run:', JSON.stringify(ran))
await page.screenshot({ path: path.resolve(here, '..', '..', 'shots', 'upright-drive.png') })
await browser.close()
