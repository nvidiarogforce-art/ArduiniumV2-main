/**
 * Headless assertions for the block canvas editor.
 *
 *   node tools/editor-test.mjs
 *
 * Loads dist-single/index.html?editor=1 straight from disk, so build the
 * single-file bundle first:
 *
 *   npx vite build --mode single
 *
 * The editor has no WebGL canvas, so unlike tools/ui-test.mjs this harness can
 * use ordinary Playwright clicks and key presses — the main thread is idle and
 * the post-action settle wait resolves normally. Everything is driven through
 * real DOM events; window.__BC__ is only ever read, never used to mutate.
 *
 * Browser setup note: this needs the headless shell specifically. Playwright's
 * full Chrome for Testing build fails to start on Windows without the
 * Microsoft Visual C++ Redistributable ("the side-by-side configuration is
 * incorrect"); chromium_headless_shell has no such dependency and is what
 * chromium.launch() picks by default. If you hit that error, either install
 * the redistributable or stick to the default headless launch.
 *
 *   npm install --no-save playwright
 *   npx playwright install chromium-headless-shell
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const here = path.dirname(fileURLToPath(import.meta.url))
const url = 'file://' + path.resolve(here, '..', 'dist-single', 'index.html') + '?editor=1'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } })
page.setDefaultTimeout(10000)

const errs = []
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errs.push('console: ' + m.text())
})

await page.goto(url, { waitUntil: 'load' })
await page.waitForSelector('[data-testid="block-canvas"]')
await page.waitForTimeout(300)

const state = () => page.evaluate(() => window.__BC__())
const results = []
const check = (name, ok, detail = '') => {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}

/** Click the centre of a block by its id. */
const clickBlock = async (id, opts = {}) => {
  await page.locator(`[data-block-id="${id}"]`).click(opts)
  await page.waitForTimeout(80)
}

/* ------------------------------------------------------------------ boot */

const boot = await state()
check('Editor boots with starter blocks', boot.count === 6, `count=${boot.count}`)
check('Nothing selected at boot', boot.selected.length === 0)

/* ------------------------------------------- 1. select + inspector binding */

const first = boot.blocks[0]
await clickBlock(first.id)
let s = await state()
check('Click selects a block', s.selected.length === 1 && s.selected[0] === first.id)
check('Active id follows the click', s.activeId === first.id)

const labelValue = await page.locator('#bc-label').inputValue()
check('Inspector populates from the block', labelValue === first.label, `"${labelValue}"`)

/* --------------------------------------------------- 2. property mutation */

await page.locator('#bc-label').fill('renamed')
await page.waitForTimeout(120)
s = await state()
check('Inspector edit mutates that block', s.blocks.find((b) => b.id === first.id).label === 'renamed')

/* ------------------------------------------------- 2b. custom properties */

await page.locator('.bc-props input[placeholder="new key"]').fill('material')
await page.locator('.bc-props button', { hasText: 'Add' }).click()
await page.waitForTimeout(120)
s = await state()
check('Custom property is added', 'material' in (s.blocks.find((b) => b.id === first.id).props ?? {}))

await page.locator('.bc-prop-row').first().locator('input').nth(1).fill('steel')
await page.waitForTimeout(120)
s = await state()
check(
  'Custom property value saves',
  s.blocks.find((b) => b.id === first.id).props.material === 'steel',
  JSON.stringify(s.blocks.find((b) => b.id === first.id).props),
)

/* ------------------------------------------------------- 3. deselect (Esc) */

// Focus is still in the label field, and Escape inside a text input is
// deliberately scoped to leaving the field — editor shortcuts must never fire
// while someone is typing. So the first press blurs, the second deselects.
await page.keyboard.press('Escape')
s = await state()
check('Esc in a text field only blurs it', s.selected.length === 1)
check('Esc leaves the text field', await page.evaluate(() => document.activeElement?.id !== 'bc-label'))

await page.keyboard.press('Escape')
s = await state()
check('Esc clears the selection', s.selected.length === 0 && s.activeId === null)

/* ------------------------------------------------------ 4. select all + Esc */

await page.keyboard.press('Control+a')
s = await state()
check('Ctrl+A selects all unlocked', s.selected.length === 6, `selected=${s.selected.length}`)

/* ------------------------------------------------------------ 5. rotation */

await page.keyboard.press('Escape')
// The 3x2 plate, not the 6x1 wall: turning the wall about its own centre
// genuinely lands it on the beam, and the editor is right to refuse that.
// A rotation test wants a block with room to turn.
const plate = boot.blocks.find((b) => b.w === 3 && b.h === 2)
const plateHome = { x: plate.x, y: plate.y }
await clickBlock(plate.id)
await page.keyboard.press('r')
await page.waitForTimeout(120)
s = await state()
let turned = s.blocks.find((b) => b.id === plate.id)
check('R rotates 90° clockwise', turned.rotation === 90, `rotation=${turned.rotation}`)
check(
  'Rotation swaps the footprint',
  turned.w === 3 && turned.h === 2 && turned.rotation === 90,
  'w/h are stored unrotated; footprint() applies the swap',
)

await page.keyboard.press('q')
await page.waitForTimeout(120)
s = await state()
turned = s.blocks.find((b) => b.id === plate.id)
check('Q rotates back counter-clockwise', turned.rotation === 0, `rotation=${turned.rotation}`)
check(
  'Rotating there and back returns to the exact cell',
  turned.x === plateHome.x && turned.y === plateHome.y,
  `${JSON.stringify(plateHome)} -> ${turned.x},${turned.y}`,
)

// A rotation that genuinely cannot fit must be refused, not fudged.
const wall = boot.blocks.find((b) => b.w === 6 && b.h === 1)
await page.keyboard.press('Escape')
await clickBlock(wall.id)
const wallHome = (await state()).blocks.find((b) => b.id === wall.id)
await page.keyboard.press('r')
await page.waitForTimeout(150)
s = await state()
const blocked = s.blocks.find((b) => b.id === wall.id)
check(
  'A rotation with no room is refused and explained',
  blocked.rotation === wallHome.rotation &&
    blocked.x === wallHome.x &&
    s.messages.some((m) => /room/i.test(m)),
  `rotation=${blocked.rotation} msgs=${JSON.stringify(s.messages)}`,
)

/* --------------------------------- 5b. align must not pile blocks up */

// Regression: align/distribute rearrange blocks relative to each other, so
// validating each against only the *unselected* blocks approves a board where
// the moved blocks have landed on top of one another.
await page.keyboard.press('Control+a')
await page.locator('.bc-toolbar button[title="Align left"]').click()
await page.waitForTimeout(150)
s = await state()
const alignRects = s.blocks.map((b) => {
  const q = b.rotation === 90 || b.rotation === 270
  return { x: b.x, y: b.y, w: q ? b.h : b.w, h: q ? b.w : b.h }
})
let alignOverlaps = 0
for (let i = 0; i < alignRects.length; i++) {
  for (let j = i + 1; j < alignRects.length; j++) {
    const a = alignRects[i]
    const c = alignRects[j]
    if (a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h) alignOverlaps++
  }
}
check('Align-all-left never corrupts the board', alignOverlaps === 0, `overlaps=${alignOverlaps}`)
await page.keyboard.press('Escape')

/* ------------------------------------------------------ 6. nudge + history */

// Re-select: the align check above selected everything and then cleared it,
// and the rest of this file operates on the wall.
await clickBlock(wall.id)
const beforeNudge = (await state()).blocks.find((b) => b.id === wall.id)
check('Wall is selected before the nudge tests', (await state()).selected.length === 1)
await page.keyboard.press('ArrowRight')
await page.waitForTimeout(120)
s = await state()
const nudged = s.blocks.find((b) => b.id === wall.id)
check('Arrow key nudges by one cell', nudged.x === beforeNudge.x + 1, `${beforeNudge.x} -> ${nudged.x}`)

await page.keyboard.press('Control+z')
await page.waitForTimeout(120)
s = await state()
check(
  'Ctrl+Z undoes the nudge',
  s.blocks.find((b) => b.id === wall.id).x === beforeNudge.x,
  `x=${s.blocks.find((b) => b.id === wall.id).x}`,
)

await page.keyboard.press('Control+y')
await page.waitForTimeout(120)
s = await state()
check(
  'Ctrl+Y redoes it',
  s.blocks.find((b) => b.id === wall.id).x === beforeNudge.x + 1,
  `x=${s.blocks.find((b) => b.id === wall.id).x}`,
)
await page.keyboard.press('Control+z')
await page.waitForTimeout(120)

/* --------------------------------------------------------- 7. duplicate */

await page.keyboard.press('Control+d')
await page.waitForTimeout(150)
s = await state()
check('Ctrl+D duplicates', s.count === 7, `count=${s.count}`)
check('Duplicate becomes the selection', s.selected.length === 1 && s.selected[0] !== wall.id)

/* ---------------------------------------------------------- 8. delete */

await page.keyboard.press('Delete')
await page.waitForTimeout(150)
s = await state()
check('Delete removes the selection', s.count === 6, `count=${s.count}`)

/* ------------------------------------------------- 9. copy / paste */

await clickBlock(wall.id)
await page.keyboard.press('Control+c')
await page.keyboard.press('Control+v')
await page.waitForTimeout(150)
s = await state()
check('Ctrl+C / Ctrl+V pastes a copy', s.count === 7, `count=${s.count}`)
await page.keyboard.press('Delete')
await page.waitForTimeout(120)

/* ------------------------------------------------------------ 10. locking */

await clickBlock(wall.id)
await page.keyboard.press('Control+l')
await page.waitForTimeout(120)
s = await state()
check('Ctrl+L locks', s.blocks.find((b) => b.id === wall.id).locked === true)

await page.keyboard.press('Delete')
await page.waitForTimeout(150)
s = await state()
check('Locked blocks resist deletion', s.count === 6, `count=${s.count}`)

await page.keyboard.press('Control+l')
await page.waitForTimeout(120)
s = await state()
check('Ctrl+L unlocks again', s.blocks.find((b) => b.id === wall.id).locked === false)

/* --------------------------------------------------------- 11. z-ordering */

const zBefore = (await state()).blocks.find((b) => b.id === wall.id).z
await page.keyboard.press('Control+BracketRight')
await page.waitForTimeout(120)
s = await state()
const zAfter = s.blocks.find((b) => b.id === wall.id).z
const maxZ = Math.max(...s.blocks.map((b) => b.z))
check('Ctrl+] brings to front', zAfter === maxZ, `z ${zBefore} -> ${zAfter}, max=${maxZ}`)

await page.keyboard.press('Control+BracketLeft')
await page.waitForTimeout(120)
s = await state()
const minZ = Math.min(...s.blocks.map((b) => b.z))
check('Ctrl+[ sends to back', s.blocks.find((b) => b.id === wall.id).z === minZ)

/* -------------------------------------------------------- 12. no overlaps */

s = await state()
const rects = s.blocks.map((b) => {
  const quarter = b.rotation === 90 || b.rotation === 270
  return { x: b.x, y: b.y, w: quarter ? b.h : b.w, h: quarter ? b.w : b.h }
})
let overlaps = 0
for (let i = 0; i < rects.length; i++) {
  for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i]
    const c = rects[j]
    if (a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h) overlaps++
  }
}
check('Board holds the no-overlap invariant', overlaps === 0, `overlaps=${overlaps}`)

/* ------------------------------------------------------------- 13. zoom */

const scaleBefore = (await state()).viewport.scale
await page.locator('[data-testid="block-canvas"]').hover()
await page.keyboard.down('Control')
await page.mouse.wheel(0, -240)
await page.keyboard.up('Control')
await page.waitForTimeout(150)
const scaleAfter = (await state()).viewport.scale
check('Ctrl+wheel zooms in', scaleAfter > scaleBefore, `${scaleBefore} -> ${scaleAfter}`)

/* -------------------------------------------- 14. JSON round-trip */

const exported = await page.evaluate(() => window.__BC_EXPORT__())
check(
  'exportToJSON emits a full canvas',
  exported.blocks.length === 6 && typeof exported.viewport.scale === 'number' && exported.version >= 1,
  `blocks=${exported.blocks?.length} v=${exported.version}`,
)

// Mutate, then import the snapshot back and confirm the canvas is restored.
await page.keyboard.press('Control+a')
await page.keyboard.press('Delete')
await page.waitForTimeout(150)
check('Canvas empties before re-import', (await state()).count === 0)

const ok = await page.evaluate((data) => window.__BC_IMPORT__(data), exported)
await page.waitForTimeout(200)
s = await state()
check('importFromJSON restores the canvas', ok === true && s.count === 6, `count=${s.count}`)

/* --------------------------------------------- 15. malformed import safety */

const survived = await page.evaluate(() =>
  window.__BC_IMPORT__({
    blocks: [
      { id: 'good', x: 1, y: 1, w: 2, h: 2, color: '#23a06a' },
      { id: 'bad-pos', x: 9999, y: -40, w: 2, h: 2 },
      'not an object',
      null,
    ],
  }),
)
await page.waitForTimeout(200)
s = await state()
const inBounds = s.blocks.every((b) => b.x >= 0 && b.y >= 0 && b.x < 40 && b.y < 26)
check('Malformed import is coerced, not fatal', survived === true && inBounds, `count=${s.count}`)

/* ------------------------------------------------------------------ done */

await browser.close()

const passed = results.filter((r) => r.startsWith('PASS')).length
console.log(results.join('\n'))
console.log(`\n${passed}/${results.length} PASS`)
console.log(errs.length ? `\nPAGE ERRORS:\n${errs.join('\n')}` : '\nno page errors')
process.exit(passed === results.length && errs.length === 0 ? 0 : 1)
