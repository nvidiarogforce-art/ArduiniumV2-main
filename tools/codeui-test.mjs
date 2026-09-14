/**
 * The code tab as a student uses it, plus the new blocks in the palette.
 *
 *   npx vite build --mode single
 *   node tools/codeui-test.mjs
 *
 * tools/code-test.mjs already proves the emitter, the parser and the round
 * trip in pure node. This one proves the parts that only exist in the browser:
 * that the tab actually edits, that applying rewrites the program, that broken
 * code is refused rather than swallowed, and that a program written as text
 * then runs the robot.
 *
 * Synthetic clicks, per ARCHITECTURE.md.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const here = path.dirname(fileURLToPath(import.meta.url))
const url = 'file://' + path.resolve(here, '..', 'dist-single', 'index.html') + '?quality=low'

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

const results = []
const check = (name, ok, detail = '') =>
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)

const tap = async (sel) => {
  await page.locator(sel).first().dispatchEvent('click')
  await page.waitForTimeout(280)
}
const prog = () => page.evaluate(() => window.__ARDUINIUM_PROG__())
const types = async () => (await prog()).map((b) => b.type).join(',')

await page.goto(url, { waitUntil: 'load' })
await page.waitForSelector('canvas')
await page.waitForTimeout(1800)
await tap('[data-testid="skip-onboarding"]')

/* --------------------------------------------- the new blocks are offered */

await tap('[data-dock="program"]')
for (const type of ['setVar', 'ifCompare', 'whileCompare']) {
  const n = await page.locator(`[data-block="${type}"]`).count()
  check(`The palette offers "${type}"`, n === 1, `found ${n}`)
}

await page.evaluate(() => window.__ARDUINIUM_SETPROG__([]))
await page.waitForTimeout(200)
await tap('[data-block="setVar"]')
check('Clicking it adds one to the program', (await types()) === 'setVar', await types())

await tap('[data-testid="block-duplicate"]')
check('Duplicate copies a block', (await types()) === 'setVar,setVar', await types())
const ids = (await prog()).map((b) => b.id)
check('...with a different id', ids[0] !== ids[1], ids.join(' / '))

/* ------------------------------------------------------ drag to reorder */

// Two distinguishable blocks at the top level, then drag the second above the
// first. HTML5 drag-and-drop is real DOM here, not canvas, so Playwright's own
// dragAndDrop drives it — the click-settling problem in ARCHITECTURE.md does not
// apply to the dock.
await page.evaluate(() =>
  window.__ARDUINIUM_SETPROG__([
    { id: 'd1', type: 'wait', ms: 100 },
    { id: 'd2', type: 'print', text: 'second' },
  ]),
)
await page.waitForTimeout(250)
await tap('[data-dock="program"]')

const rows = page.locator('[data-block-id]')
check('Two blocks are on screen', (await rows.count()) === 2, String(await rows.count()))

/**
 * Drag row `from` onto drop zone `zone`.
 *
 * The zones only exist while a drag is live, and creating them reflows the
 * list — so any pixel measured before the drag starts is stale by the time the
 * pointer needs it. The nudge below starts the drag, and only then are the
 * zones measured. Getting this wrong made a downward drag silently miss.
 */
async function dragRowToZone(from, zoneSelector, zoneIndex = 0) {
  const row = page.locator('[data-block-id]').nth(from)
  // Both ends of the gesture need to be on screen: a container with an open
  // body pushes the rows below it past the fold in this viewport, and pressing
  // on a point that is not visible starts no drag at all.
  await row.scrollIntoViewIfNeeded()
  await page.waitForTimeout(120)
  const box = await row.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 12, { steps: 4 })
  await page.waitForTimeout(150)

  const zones = page.locator(zoneSelector)
  const n = await zones.count()
  if (n === 0) {
    await page.mouse.up()
    return { zones: 0 }
  }
  // The last zone in a long program can sit below the fold, where there is
  // nothing under the cursor to drop onto. A student would scroll; so does this.
  const pick = zones.nth(Math.min(zoneIndex, n - 1))
  await pick.scrollIntoViewIfNeeded()
  await page.waitForTimeout(120)
  const target = await pick.boundingBox()
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 8 })
  await page.waitForTimeout(150)
  await page.mouse.up()
  await page.waitForTimeout(300)
  return { zones: n, total: await page.locator('.drop-zone').count() }
}

// Drag the second block into the gap above the first.
const up = await dragRowToZone(1, '.drop-zone', 0)
check('Drop zones appear while a block is being dragged', up.zones === 3, `${up.zones} zones`)
check('Dragging a block above another reorders them', (await types()) === 'print,wait', await types())
check('...without losing or duplicating anything', (await prog()).length === 2, String((await prog()).length))

// And back down, into the gap after the last block.
await dragRowToZone(0, '.drop-zone', 2)
check('...and dragging it back down restores the order', (await types()) === 'wait,print', await types())

/* ------------------------------------------------------- drag to nest */

await page.evaluate(() =>
  window.__ARDUINIUM_SETPROG__([
    { id: 'n1', type: 'repeat', times: 3, body: [] },
    { id: 'n2', type: 'print', text: 'inside me' },
  ]),
)
await page.waitForTimeout(250)

// The only zone inside `.block-children` is the empty Repeat's body.
await dragRowToZone(1, '.block-children .drop-zone', 0)
const nested = await prog()
check(
  'Dragging a block into a container nests it',
  nested.length === 1 && nested[0].type === 'repeat' && nested[0].body?.length === 1,
  nested.map((b) => `${b.type}(${b.body?.length ?? 0})`).join(','),
)
check(
  '...and it is the block that was dragged',
  nested[0]?.body?.[0]?.type === 'print',
  nested[0]?.body?.[0]?.type ?? 'nothing',
)

// Collapsing hides the body without touching the program.
await page.locator('[data-block-id] .block-tool').first().dispatchEvent('click')
await page.waitForTimeout(250)
check(
  'Collapsing a container hides what is inside',
  (await page.locator('.block-children').count()) === 0,
  `${await page.locator('.block-children').count()} child lists`,
)
check('...without changing the program', (await prog())[0]?.body?.length === 1, await types())

/* ------------------------------------------------- the code tab round trip */

await page.evaluate(() =>
  window.__ARDUINIUM_SETPROG__([
    { id: 'x1', type: 'drive', dir: 'forward', speed: 200, ms: 1500 },
    { id: 'x2', type: 'print', text: 'hello' },
  ]),
)
await page.waitForTimeout(200)
await tap('[data-dock="code"]')

const readOnly = await page.locator('[data-testid="code-text"]').count()
check('The code tab starts read-only', readOnly === 0, `textareas: ${readOnly}`)

await tap('[data-testid="code-edit"]')
const seeded = await page.locator('[data-testid="code-text"]').inputValue()
check(
  'Editing seeds the box from the blocks',
  seeded.includes('drive(FORWARD, 200);') && seeded.includes('Serial.println("hello");'),
  seeded.split('\n').filter((l) => l.trim()).slice(-4).join(' | '),
)

const verdictText = async () => (await page.locator('[data-testid="code-verdict"]').first().innerText()).trim()
check('...and says the code is fine', (await verdictText()).toLowerCase().includes('block'), await verdictText())

// Applying unchanged code must leave the program alone.
await tap('[data-testid="code-apply"]')
check(
  'Applying unchanged code keeps the same program',
  (await types()) === 'drive,print',
  await types(),
)

/* ------------------------------------------------- editing the text works */

await tap('[data-testid="code-edit"]')
await page.locator('[data-testid="code-text"]').fill(`void loop() {
  count = count + 1;
  if (count < 3) {
    digitalWrite(13, HIGH);
  } else {
    digitalWrite(13, LOW);
  }
  delay(500);
}`)
await page.waitForTimeout(400)
check('Hand-typed code is accepted', !(await verdictText()).toLowerCase().includes('line'), await verdictText())

await tap('[data-testid="code-apply"]')
check(
  'Applying it rewrites the program',
  (await types()) === 'setVar,ifCompare,wait',
  await types(),
)
const applied = await prog()
check(
  '...with the comparison read correctly',
  applied[1]?.op === '<' && applied[1]?.a?.src === 'var' && applied[1]?.b?.value === 3,
  JSON.stringify(applied[1] && { a: applied[1].a, op: applied[1].op, b: applied[1].b }),
)
check(
  '...and both branches kept',
  applied[1]?.body?.length === 1 && applied[1]?.elseBody?.length === 1,
  JSON.stringify({ body: applied[1]?.body?.length, else: applied[1]?.elseBody?.length }),
)

/* --------------------------------------------------------- broken code */

const before = await types()
await tap('[data-testid="code-edit"]')
await page.locator('[data-testid="code-text"]').fill('void loop() { wibble(1); }')
await page.waitForTimeout(400)
check('Broken code is reported with a line number', /line|строка|qator/i.test(await verdictText()), await verdictText())

await tap('[data-testid="code-apply"]')
check('...and refuses to touch the program', (await types()) === before, `${before} -> ${await types()}`)
check(
  '...leaving the editor open so the text is not lost',
  (await page.locator('[data-testid="code-text"]').count()) === 1,
)

await tap('[data-testid="code-revert"]')
check(
  'Going back to the blocks closes the editor',
  (await page.locator('[data-testid="code-text"]').count()) === 0,
)

/* ----------------------------------------- a text program actually drives */

await tap('[data-testid="templates"]')
await tap('[data-template="rover"]')
await page.waitForTimeout(1200)

await tap('[data-dock="code"]')
await tap('[data-testid="code-edit"]')
await page.locator('[data-testid="code-text"]').fill(`void loop() {
  laps = laps + 1;
  Serial.println("lap");
  drive(FORWARD, 220);
  delay(1200);
  drive(STOP, 0);
}`)
await page.waitForTimeout(400)
await tap('[data-testid="code-apply"]')
check('A text program lands on the rover', (await types()) === 'setVar,print,drive', await types())

await tap('[data-testid="run"]')
await page.waitForTimeout(6500)
const ran = await page.evaluate(() => {
  const a = window.__ARDUINIUM__()
  return { pos: a.robotPos, serial: window.__ARDUINIUM_BUILD__().serial.slice(0, 6) }
})
const moved = Math.hypot(ran.pos[0], ran.pos[2])
check('...and the robot drives from it', moved > 0.5, `travelled ${moved.toFixed(2)}`)
check(
  '...printing to the serial monitor as it goes',
  ran.serial.some((l) => l.includes('lap')),
  ran.serial.join(' | '),
)

/* ------------------------------------------------------------------ done */

await browser.close()
const passed = results.filter((r) => r.startsWith('PASS')).length
console.log(results.join('\n'))
console.log(`\n${passed}/${results.length} PASS`)
console.log(errs.length ? `\nPAGE ERRORS:\n${errs.slice(0, 6).join('\n')}` : '\nno page errors')
process.exit(passed === results.length && errs.length === 0 ? 0 : 1)
