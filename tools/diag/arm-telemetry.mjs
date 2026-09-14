import path from 'node:path'
import { chromium } from 'playwright'

const root = path.resolve(import.meta.dirname, '../..')
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } })
await page.goto('file://' + path.join(root, 'dist-single', 'index.html') + '?quality=high')
await page.waitForSelector('canvas')
await page.waitForTimeout(1400)
const tap = async (selector) => page.locator(selector).first().dispatchEvent('click')
await tap('[data-testid="skip-onboarding"]')
await tap('[data-testid="templates"]')
await tap('[data-template="robotArm"]')
await page.waitForTimeout(500)
await tap('[data-testid="run"]')
for (const ms of [250, 1000, 2500, 5000]) {
  await page.waitForTimeout(ms === 250 ? ms : ms - ([250, 1000, 2500, 5000][[250, 1000, 2500, 5000].indexOf(ms) - 1]))
  const data = await page.evaluate(() => ({
    clock: window.__ARDUINIUM_RT__().clock,
    joints: window.__ARDUINIUM_RT__().jointDebug,
    wires: window.__ARDUINIUM_RT__().wireDebug,
  }))
  console.log(JSON.stringify(data))
}
await page.screenshot({ path: path.join(root, 'shots', 'robot-arm-telemetry.png') })
await browser.close()
