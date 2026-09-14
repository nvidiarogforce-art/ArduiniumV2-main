/** Screenshots of the extended block palette and the editable code tab. */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..', '..')
const url = 'file://' + path.resolve(root, 'dist-single', 'index.html') + '?quality=high'

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } })
page.setDefaultTimeout(20000)
page.on('pageerror', (e) => console.log('PAGEERROR: ' + e.message))
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE: ' + m.text()))

const tap = async (sel) => {
  await page.locator(sel).first().dispatchEvent('click')
  await page.waitForTimeout(300)
}

await page.goto(url, { waitUntil: 'load' })
await page.waitForSelector('canvas')
await page.waitForTimeout(2400)
await tap('[data-testid="skip-onboarding"]')
await tap('[data-testid="templates"]')
await tap('[data-template="rover"]')
await page.waitForTimeout(1400)

// A program that uses the new blocks.
await page.evaluate(() =>
  window.__ARDUINIUM_SETPROG__([
    { id: 'p1', type: 'setVar', name: 'laps', a: { src: 'num', value: 0 }, op: '', b: { src: 'num', value: 1 } },
    {
      id: 'p2',
      type: 'whileCompare',
      a: { src: 'var', name: 'laps' },
      op: '<',
      b: { src: 'num', value: 3 },
      body: [
        {
          id: 'p3',
          type: 'ifCompare',
          a: { src: 'distance' },
          op: '<',
          b: { src: 'num', value: 25 },
          body: [{ id: 'p4', type: 'drive', dir: 'left', speed: 180, ms: 600 }],
          elseBody: [{ id: 'p5', type: 'drive', dir: 'forward', speed: 220, ms: 900 }],
        },
        { id: 'p6', type: 'setVar', name: 'laps', a: { src: 'var', name: 'laps' }, op: '+', b: { src: 'num', value: 1 } },
      ],
    },
  ]),
)
await page.waitForTimeout(500)
await tap('[data-dock="program"]')
await page.waitForTimeout(600)
await page.screenshot({ path: path.resolve(root, 'shots', 'blocks-new.png') })
console.log('OK -> shots/blocks-new.png')

await tap('[data-dock="code"]')
await tap('[data-testid="code-edit"]')
await page.waitForTimeout(600)
await page.screenshot({ path: path.resolve(root, 'shots', 'code-editor.png') })
console.log('OK -> shots/code-editor.png')

// And the error state, which is the one a student will actually hit.
await page.locator('[data-testid="code-text"]').fill(`void loop() {
  laps = laps + 1;
  if (laps < 3 {
    drive(FORWARD, 200);
  }
}`)
await page.waitForTimeout(500)
await page.screenshot({ path: path.resolve(root, 'shots', 'code-error.png') })
console.log('verdict:', (await page.locator('[data-testid="code-verdict"]').first().innerText()).trim())
console.log('OK -> shots/code-error.png')

await browser.close()
