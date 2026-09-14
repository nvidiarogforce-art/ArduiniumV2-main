import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { CATALOGUE } from '../../src/lib/parts.js'
import { STRIP_T } from '../../src/lib/config.js'

const output = path.resolve('shots', 'kit-components.png')
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })

try {
  await page.goto(pathToFileURL(path.resolve('dist-single', 'index.html')).href + '?quality=high')
  await page.waitForFunction(() => Boolean(window.__ARDUINIUM_BUILD__))
  await page.locator('[data-testid="skip-onboarding"]').dispatchEvent('click')
  const rails = [-3, 0, 3].map((z, i) => ({ id: `kit-rail-${i}`, kind: 'strip11', pos: [0, 0, z], y: STRIP_T / 2, rotY: 0 }))
  const holes = [[0, 3, 6, 9], [0, 3, 6, 9], [1, 5, 9]]
  const components = CATALOGUE.components.map((kind, i) => ({
    id: `kit-${kind}`,
    kind,
    hostId: rails[Math.floor(i / 4)].id,
    hostHole: holes[Math.floor(i / 4)][i % 4],
  }))
  await page.evaluate((parts) => window.__ARDUINIUM_LOAD__({
    format: 'arduinium-build', version: 2, name: 'Starter Kit components',
    parts: [{ id: 'kit-board', kind: 'board', pos: [0, 0, 5], y: 0.08, rotY: 0 }, ...parts],
    bolts: [], wires: [], program: [],
  }), [...rails, ...components])
  await page.waitForTimeout(1200)
  await page.evaluate(() => {
    const ui = window.__ARDUINIUM_UI__()
    ui.setDrawer('left', false)
    ui.setDrawer('right', false)
    ui.setDrawer('bottom', false)
    ui.requestCamera('frameAll')
  })
  await page.waitForTimeout(1800)
  await page.screenshot({ path: output })
  const state = await page.evaluate(() => window.__ARDUINIUM__())
  if (state.parts !== rails.length + components.length + 1 || errors.length) throw new Error(JSON.stringify({ state, errors }))
  console.log(`OK ${components.length} components -> ${output}`)
} finally {
  await browser.close()
}
