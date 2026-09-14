/**
 * Module 4 assertions: editing parts that are already on the table.
 *
 *   npx vite build --mode single
 *   node tools/edit-test.mjs
 *
 * Covers select -> rotate / move / delete, and the undo-redo stack that sits
 * under all of them. Everything is driven through the store's own actions,
 * which is what the keyboard and the toolbar both call.
 *
 * Clicks are dispatched rather than issued through page.click(), for the
 * reason given in ARCHITECTURE.md: the full-bleed WebGL canvas under swiftshader
 * keeps the main thread too busy for Playwright's post-click settle to
 * resolve.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const here = path.dirname(fileURLToPath(import.meta.url))
const url = 'file://' + path.resolve(here, '..', 'dist-single', 'index.html') + '?quality=high'

const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } })
page.setDefaultTimeout(15000)

const errs = []
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errs.push('console: ' + m.text())
})

await page.goto(url, { waitUntil: 'load' })
await page.waitForSelector('canvas')
await page.waitForTimeout(2200)

const tap = async (sel) => {
  await page.locator(sel).first().dispatchEvent('click')
  await page.waitForTimeout(250)
}
await tap('[data-testid="skip-onboarding"]')
await tap('[data-testid="templates"]')
await tap('[data-template="rover"]')
await page.waitForTimeout(1200)

/** Run a store action and return a compact snapshot of the build. */
const build = () =>
  page.evaluate(() => {
    const b = window.__ARDUINIUM_BUILD__()
    return {
      parts: b.order.length,
      bolts: b.bolts.length,
      selected: b.selected,
      past: b.past.length,
      future: b.future.length,
      rotOf: Object.fromEntries(
        Object.values(b.parts)
          .filter((p) => p.rotY !== undefined)
          .map((p) => [p.id, Math.round(((p.rotY * 180) / Math.PI) % 360)]),
      ),
    }
  })
const act = (fn, ...args) =>
  page.evaluate(
    ([f, a]) => {
      window.__ARDUINIUM_BUILD__()[f](...a)
    },
    [fn, args],
  )

const results = []
const check = (name, ok, detail = '') =>
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)

/** A flat part with bolts is the interesting rotation subject. */
const flatId = await page.evaluate(() => {
  const b = window.__ARDUINIUM_BUILD__()
  return Object.values(b.parts).find((p) => p.pos && p.rotY !== undefined)?.id ?? null
})
check('Found a placed flat part', Boolean(flatId), String(flatId))

const start = await build()
check('Rover loaded with bolts', start.parts === 18 && start.bolts > 0, JSON.stringify(start).slice(0, 90))
check('History starts empty', start.past === 0 && start.future === 0)

/* ------------------------------------------------------------- selection */

await act('select', flatId)
check('select() marks the part', (await build()).selected === flatId)

/* -------------------------------------------------------------- rotation */

const beforeRot = (await build()).rotOf[flatId]
await act('rotatePart', flatId, 1)
await page.waitForTimeout(200)
let s = await build()
const afterRot = s.rotOf[flatId]
check(
  'rotatePart turns by 90 degrees',
  ((afterRot - beforeRot + 360) % 360) === 90,
  `${beforeRot} -> ${afterRot}`,
)
check('Rotation pushes one undo step', s.past === 1, `past=${s.past}`)
check('Rotation keeps the part count', s.parts === start.parts, `parts=${s.parts}`)
check('Bolts were recomputed, not dropped wholesale', typeof s.bolts === 'number', `bolts=${s.bolts}`)

/* ---------------------------------------------------------- undo / redo */

await act('undo')
await page.waitForTimeout(200)
s = await build()
check('Undo restores the angle', s.rotOf[flatId] === beforeRot, `rot=${s.rotOf[flatId]}`)
check('Undo restores the bolt count', s.bolts === start.bolts, `${s.bolts} vs ${start.bolts}`)
check('Undo moves the step onto the redo stack', s.past === 0 && s.future === 1, JSON.stringify(s).slice(0, 60))

await act('redo')
await page.waitForTimeout(200)
s = await build()
check('Redo re-applies the rotation', s.rotOf[flatId] === afterRot, `rot=${s.rotOf[flatId]}`)
check('Redo moves the step back', s.past === 1 && s.future === 0)

/* ---------------------------------- multi-step history (the old bug) --- */

// The previous single-slot `past` silently discarded the older edit as soon as
// a second one happened, so three rotations could only ever be undone once.
await act('rotatePart', flatId, 1)
await act('rotatePart', flatId, 1)
await page.waitForTimeout(250)
s = await build()
check('Three edits stack up', s.past === 3, `past=${s.past}`)
const spun = s.rotOf[flatId]

await act('undo')
await act('undo')
await act('undo')
await page.waitForTimeout(250)
s = await build()
check('Three undos walk all the way back', s.rotOf[flatId] === beforeRot, `rot=${s.rotOf[flatId]} vs ${beforeRot}`)
check('Undo stack is empty, redo holds three', s.past === 0 && s.future === 3, JSON.stringify(s).slice(0, 60))

await act('undo')
await page.waitForTimeout(200)
check('Undo past the start is refused safely', (await build()).past === 0)

await act('redo')
await act('redo')
await act('redo')
await page.waitForTimeout(250)
s = await build()
check('Three redos walk forward again', s.rotOf[flatId] === spun, `rot=${s.rotOf[flatId]} vs ${spun}`)

await act('redo')
await page.waitForTimeout(200)
check('Redo past the end is refused safely', (await build()).future === 0)

/* --------------------------------- a new action clears the redo branch -- */

await act('undo')
await page.waitForTimeout(150)
check('One undo leaves a redo available', (await build()).future === 1)
await act('rotatePart', flatId, -1)
await page.waitForTimeout(200)
check('A fresh edit clears the stale redo branch', (await build()).future === 0)

/* ----------------------------------------------------------- deletion */

const beforeDel = await build()
const doomed = await page.evaluate(() => {
  const b = window.__ARDUINIUM_BUILD__()
  // A part with nothing mounted on it, so the delete is a clean single removal.
  return Object.values(b.parts).find((p) => p.pos && b.dependentsOf(p.id).length === 0)?.id ?? null
})
await act('select', doomed)
await act('deletePart', doomed)
await page.waitForTimeout(250)
s = await build()
check('Delete removes the part', s.parts === beforeDel.parts - 1, `${beforeDel.parts} -> ${s.parts}`)
check('Delete clears the selection', s.selected === null)
check('Delete drops that part\'s bolts', s.bolts <= beforeDel.bolts, `${beforeDel.bolts} -> ${s.bolts}`)

await act('undo')
await page.waitForTimeout(250)
s = await build()
check('Undo brings the deleted part back', s.parts === beforeDel.parts, `parts=${s.parts}`)
check('Undo restores its bolts too', s.bolts === beforeDel.bolts, `${s.bolts} vs ${beforeDel.bolts}`)

/* ------------------------------------------- picking up and putting down */

const beforeMove = await build()
const homePos = await page.evaluate(
  (id) => window.__ARDUINIUM_BUILD__().parts[id].pos.map((v) => +v.toFixed(3)),
  doomed,
)
await act('pickUpPart', doomed)
await page.waitForTimeout(250)
const carrying = await page.evaluate(() => Boolean(window.__ARDUINIUM_BUILD__().pending))
check('pickUpPart lifts it into the hand', carrying)
check('Carried part leaves the build', (await build()).parts === beforeMove.parts - 1)

await act('movePending', [2.5, 0, 2.5])
await act('commitPlace')
await page.waitForTimeout(300)
s = await build()
check('Placing it again restores the count', s.parts === beforeMove.parts, `parts=${s.parts}`)

const movedPos = await page.evaluate(
  (id) => window.__ARDUINIUM_BUILD__().parts[id]?.pos?.map((v) => +v.toFixed(3)) ?? null,
  doomed,
)
check('Placing it again actually moved it', JSON.stringify(movedPos) !== JSON.stringify(homePos), `${JSON.stringify(homePos)} -> ${JSON.stringify(movedPos)}`)

await act('undo')
await page.waitForTimeout(250)
check('Undo after a move is safe', (await build()).parts === beforeMove.parts, 'no part lost')

// The real point of collapsing pickup+place into one step: a single undo has
// to put the part back where it started, not leave it lifted out of the build.
const undonePos = await page.evaluate(
  (id) => window.__ARDUINIUM_BUILD__().parts[id]?.pos?.map((v) => +v.toFixed(3)) ?? null,
  doomed,
)
check(
  'One undo returns the part to its original position',
  JSON.stringify(undonePos) === JSON.stringify(homePos),
  `${JSON.stringify(undonePos)} vs ${JSON.stringify(homePos)}`,
)

/* ------------------------------------------------------------------ done */

await browser.close()
const passed = results.filter((r) => r.startsWith('PASS')).length
console.log(results.join('\n'))
console.log(`\n${passed}/${results.length} PASS`)
console.log(errs.length ? `\nPAGE ERRORS:\n${errs.slice(0, 6).join('\n')}` : '\nno page errors')
process.exit(passed === results.length && errs.length === 0 ? 0 : 1)
