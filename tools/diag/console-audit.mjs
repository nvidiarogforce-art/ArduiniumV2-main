/**
 * Every console message, page error and failed request across a normal
 * boot -> load rover -> run cycle.
 *
 *   node tools/diag/console-audit.mjs
 *
 * shot.mjs already fails the build on console.error and pageerror; this also
 * surfaces warnings, which nothing else gates on.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const here = path.dirname(fileURLToPath(import.meta.url))
const url = 'file://' + path.resolve(here, '..', '..', 'dist-single', 'index.html') + '?quality=high'

const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } })
page.setDefaultTimeout(20000)

const msgs = []
let phase = 'boot'
page.on('console', (m) => msgs.push({ phase, type: m.type(), text: m.text() }))
page.on('pageerror', (e) => msgs.push({ phase, type: 'pageerror', text: e.message }))
page.on('requestfailed', (r) =>
  msgs.push({ phase, type: 'requestfailed', text: `${r.url().slice(0, 100)} — ${r.failure()?.errorText}` }),
)
page.on('request', (r) => {
  if (!r.url().startsWith('file:') && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) {
    msgs.push({ phase, type: 'network', text: r.url().slice(0, 100) })
  }
})

const tap = async (sel) => {
  await page.locator(sel).first().dispatchEvent('click')
  await page.waitForTimeout(300)
}

await page.goto(url, { waitUntil: 'load' })
await page.waitForSelector('canvas')
await page.waitForTimeout(2500)
await tap('[data-testid="skip-onboarding"]')

phase = 'load rover'
await page.evaluate(() => window.__ARDUINIUM_LOAD__('rover'))
await page.waitForTimeout(1500)

phase = 'run'
await page.evaluate(() => window.__ARDUINIUM_RUN__(true))
await page.waitForTimeout(6000)

phase = 'stop'
await page.evaluate(() => window.__ARDUINIUM_RUN__(false))
await page.waitForTimeout(1200)

phase = 'wiring mode'
await tap('[data-testid="wire-mode"]')
await page.waitForTimeout(800)

phase = 'locale ru/uz'
await tap('[data-testid="language"]')
await tap('[data-locale="ru"]')
await page.waitForTimeout(600)
await tap('[data-testid="language"]')
await tap('[data-locale="uz"]')
await page.waitForTimeout(600)

await browser.close()

const byType = new Map()
for (const m of msgs) {
  const k = `${m.type}`
  if (!byType.has(k)) byType.set(k, [])
  byType.get(k).push(m)
}
if (!msgs.length) console.log('clean — no console output, no page errors, no network')
for (const [type, list] of byType) {
  console.log(`\n=== ${type} (${list.length}) ===`)
  const seen = new Set()
  for (const m of list) {
    const sig = m.text.slice(0, 160)
    if (seen.has(sig)) continue
    seen.add(sig)
    console.log(`  [${m.phase}] ${sig}`)
  }
}
