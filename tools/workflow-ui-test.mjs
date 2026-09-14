/** Focused UX regression for the Build → Circuit → Code → Simulate rail. */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const here = path.dirname(fileURLToPath(import.meta.url))
const url = 'file://' + path.resolve(here, '..', 'dist-single', 'index.html') + '?quality=low'
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.setDefaultTimeout(15000)
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
const rows = []
const check = (name, ok, detail = '') => rows.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)

await page.goto(url, { waitUntil: 'load' })
await page.waitForSelector('canvas')
await page.waitForTimeout(1200)
await page.locator('[data-testid="skip-onboarding"]').first().dispatchEvent('click')

const ui = () => page.evaluate(() => {
  const state = window.__ARDUINIUM_UI__()
  return { mode: state.workflowMode, wire: state.wireMode, drawers: state.drawers, tab: state.partsTab }
})

let state = await ui()
check('Build is the calm default mode', state.mode === 'build' && state.drawers.left && !state.drawers.right && !state.drawers.bottom, JSON.stringify(state))

const icons = await page.locator('.mode-step img').evaluateAll((images) => images.map((image) => ({ src: image.currentSrc, width: image.naturalWidth })))
check('Four generated mode icons load', icons.length === 4 && icons.every((icon) => icon.width > 0), JSON.stringify(icons.map((icon) => icon.width)))
check('Every workflow mode has its own icon', new Set(icons.map((icon) => icon.src)).size === 4)

await page.locator('[data-testid="templates"]').dispatchEvent('click')
await page.locator('[data-template="robotArm"]').dispatchEvent('click')
await page.waitForTimeout(350)
await page.locator('[data-mode="circuit"]').dispatchEvent('click')
await page.waitForTimeout(300)
state = await ui()
check('Circuit mode exposes contacts and components only', state.mode === 'circuit' && state.wire && state.drawers.left && state.tab === 'components' && !state.drawers.bottom, JSON.stringify(state))
check('Circuit health is visible on the workflow rail', (await page.locator('.mode-health').innerText()).trim() === '✓')
await page.screenshot({ path: path.resolve(here, '..', 'shots', 'workflow-circuit.png') })

await page.locator('[data-mode="code"]').dispatchEvent('click')
await page.waitForTimeout(250)
state = await ui()
check('Code mode gives the editor the whole lower workspace', state.mode === 'code' && !state.wire && !state.drawers.left && state.drawers.bottom, JSON.stringify(state))
check('Blocks remain directly editable', await page.locator('.block').count() > 0)
await page.screenshot({ path: path.resolve(here, '..', 'shots', 'workflow-code.png') })

await page.locator('[data-mode="simulate"]').dispatchEvent('click')
await page.waitForTimeout(200)
state = await ui()
check('Simulate mode clears every editing panel', state.mode === 'simulate' && !Object.values(state.drawers).some(Boolean), JSON.stringify(state))

const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
check('The workshop has no horizontal overflow', overflow === 0, `${overflow}px`)
check('No browser errors across all modes', errors.length === 0, errors.join(' | '))

await browser.close()
console.log(rows.join('\n'))
const failed = rows.filter((row) => row.startsWith('FAIL')).length
console.log(`\n${rows.length - failed}/${rows.length} PASS`)
if (failed) process.exitCode = 1
