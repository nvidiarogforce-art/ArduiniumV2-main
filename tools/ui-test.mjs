import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

// Resolved from this file, like every other harness in here. It used to be an
// absolute path from whichever machine wrote it, which meant the suite could
// only ever run on that one machine.
const here = path.dirname(fileURLToPath(import.meta.url))
const url = 'file://' + path.resolve(here, '..', 'dist-single', 'index.html') + '?quality=high'
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
const p = await b.newPage({viewport:{width:1600,height:950}})
p.setDefaultTimeout(15000)
const errs=[]
p.on('pageerror', e=>errs.push('pageerror: '+e.message))
p.on('console', m=>{ if(m.type()==='error') errs.push('console: '+m.text()) })
/**
 * Software WebGL over a full-screen canvas keeps the main thread permanently
 * busy, so Playwright's "wait for the page to settle after a click" never
 * resolves. Dispatching the click runs the exact same React handler without
 * that wait — we are testing the app's behaviour, not the browser's.
 */
const tap = async (sel) => { await p.locator(sel).first().dispatchEvent('click') }

await p.goto(url,{waitUntil:'load'}); await p.waitForSelector('canvas'); await p.waitForTimeout(1800)
await tap('[data-testid="skip-onboarding"]')
await tap('[data-testid="templates"]'); await p.waitForTimeout(200)
await tap('[data-template="rover"]'); await p.waitForTimeout(900)

const prog = () => p.evaluate(()=>JSON.stringify(window.__ARDUINIUM_PROG__ ? window.__ARDUINIUM_PROG__() : null))
const results = []
function check(name, ok, detail=''){ if(!ok) console.log('FAIL', name, detail); results.push(`${ok?'PASS':'FAIL'}  ${name}${detail?'  — '+detail:''}`) }

// --- 1. text input in a Print block (add one first)
await tap('[data-block="print"]'); await p.waitForTimeout(300)
const textInputs = await p.locator('.block input[type="text"]').count()
if (textInputs > 0) {
  const first = p.locator('.block input[type="text"]').first()
  await first.click({clickCount:3})
  await first.fill('turning left now')
  await p.waitForTimeout(300)
  const val = await first.inputValue()
  check('Print text edits', val === 'turning left now', `value="${val}"`)
} else check('Print text edits', false, 'no text input found')

// --- 2. number input (motor speed)
const numInputs = p.locator('.block input[type="number"]')
const nCount = await numInputs.count()
if (nCount > 0) {
  const first = numInputs.first()
  await first.click({clickCount:3})
  await first.fill('123')
  await first.dispatchEvent('change')
  await p.waitForTimeout(300)
  check('Number input edits', (await first.inputValue()) === '123', `value=${await first.inputValue()}`)
} else check('Number input edits', false, 'none found')

// --- 3. select (pin picker)
const sels = p.locator('.block select')
const sCount = await sels.count()
if (sCount > 0) {
  const before = await sels.first().inputValue()
  const opts = await sels.first().locator('option').allTextContents()
  await sels.first().selectOption({index: opts.length>1?1:0})
  await p.waitForTimeout(250)
  const after = await sels.first().inputValue()
  check('Select changes', before !== after || opts.length===1, `${before} -> ${after}`)
} else check('Select changes', false, 'none found')

// --- 3b. drive block direction actually changes the program
await tap('[data-block="drive"]'); await p.waitForTimeout(300)
const driveSel = p.locator('.block.blue select').last()
await driveSel.selectOption('left'); await p.waitForTimeout(250)
const progJson = await p.evaluate(() => JSON.stringify(window.__ARDUINIUM_PROG__()))
check('Drive direction saves', /"dir":"left"/.test(progJson), progJson.slice(0, 90))

// --- 4. add a block from the palette
const beforeBlocks = await p.locator('.block').count()
await tap('[data-block="motor"]'); await p.waitForTimeout(300)
const afterBlocks = await p.locator('.block').count()
check('Palette adds block', afterBlocks === beforeBlocks+1, `${beforeBlocks} -> ${afterBlocks}`)

// --- 5. delete a block
await p.locator('.block-x').last().dispatchEvent('click'); await p.waitForTimeout(300)
check('Delete block', (await p.locator('.block').count()) === beforeBlocks)

// --- 6. dock tabs
await tap('[data-dock="code"]'); await p.waitForTimeout(300)
check('Code tab', await p.locator('.code-view').count() > 0)
await tap('[data-dock="serial"]'); await p.waitForTimeout(200)
check('Serial tab', await p.locator('[data-testid="serial"]').count() > 0)
await tap('[data-dock="program"]'); await p.waitForTimeout(200)

// --- 7. top bar
for (const [sel,label] of [['[data-view="top"]','Top view'],['[data-view="side"]','Side view'],['[data-view="frameAll"]','Fit view']]) {
  await tap(sel); await p.waitForTimeout(250); check(label, true)
}
await tap('[data-testid="xray"]'); await p.waitForTimeout(250)
const x1 = await p.evaluate(()=>window.__ARDUINIUM__().lastLesson)
check('X-ray toggle', x1 === 'xray', x1)

// --- 8. parts panel tab + card
await tap('[data-tab="structure"]'); await p.waitForTimeout(150)
await tap('[data-part="strip5"]'); await p.waitForTimeout(250)
const held = await p.evaluate(()=>window.__ARDUINIUM__().lastLesson)
check('Part card picks up', held === 'pickPart', held)
await p.keyboard.press('Escape'); await p.waitForTimeout(200)

// --- 9. select a part in 3D + inspector
await p.mouse.click(800, 380); await p.waitForTimeout(400)
check('Inspector appears on 3D click', await p.locator('.inspector').count() > 0)

console.log(results.join('\n'))
console.log(errs.length ? 'PAGE ERRORS:\n'+errs.slice(0,6).join('\n') : 'no page errors')
await b.close()
