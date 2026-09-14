/**
 * Vertical mounting: the upright post, and the L-bracket's raised hole.
 *
 *   npx vite build --mode single
 *   node tools/mount-test.mjs
 *
 * What this is really testing is that ONE number decides where a raised hole
 * is. `mountHoles(kind)` in parts.js feeds the snap matrix, the mount chain and
 * the mesh alike. Before it existed the L-bracket's node was hard-coded as
 * "straight up by one arm" while its mesh drew the hole at the top of the
 * upright arm, half an arm away along +X — so the green ring a student aimed at
 * and the place the part landed were different places.
 *
 * Synthetic clicks, per ARCHITECTURE.md: a real .click() on the full-bleed WebGL
 * canvas never settles under swiftshader.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const here = path.dirname(fileURLToPath(import.meta.url))
const url = 'file://' + path.resolve(here, '..', 'dist-single', 'index.html') + '?quality=low'

const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
page.setDefaultTimeout(15000)

const errs = []
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errs.push('console: ' + m.text())
})

const results = []
const check = (name, ok, detail = '') =>
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps

await page.goto(url, { waitUntil: 'load' })
await page.waitForSelector('canvas')
await page.waitForTimeout(1800)
await page.locator('[data-testid="skip-onboarding"]').first().dispatchEvent('click')
await page.waitForTimeout(250)

/**
 * Place a part and return the new part's id.
 *
 * `hint` is the {partId, index} the pointer would be nearest to on screen. The
 * UI works this out from the camera (see nearestNodeOnScreen in Placement.jsx);
 * here it is passed straight in, which exercises the same store path without
 * needing a camera. Omit it and the X/Z fallback decides, exactly as it does
 * for a template load.
 */
const place = (kind, at, hint = null) =>
  page.evaluate(
    ([k, p, h]) => {
      const b = () => window.__ARDUINIUM_BUILD__()
      const before = new Set(Object.keys(b().parts))
      b().beginPlace(k)
      b().movePending(p, h)
      b().commitPlace()
      return Object.keys(b().parts).find((id) => !before.has(id)) ?? null
    },
    [kind, at, hint],
  )

const xform = (id) => page.evaluate((i) => window.__ARDUINIUM_XFORM__(i), id)
const nodesFor = (kind) => page.evaluate((k) => window.__ARDUINIUM_NODES__(k), kind)

/* --------------------------------------------------------------- geometry */

const dims = await page.evaluate(() => {
  const b = window.__ARDUINIUM_BUILD__()
  return { lift: b.buildLift() }
})
check('Debug hooks are present', dims.lift != null, JSON.stringify(dims))

/* --------------------------------------------- an upright bolts to a strip */

await page.evaluate(() => window.__ARDUINIUM_BUILD__().clearAll())
const stripId = await place('strip11', [0, 0, 0])
const strip = await xform(stripId)
const uprightId = await place('upright', [strip.pos[0] + 1, 0, strip.pos[2]])

check('An upright bolts onto a strip', Boolean(uprightId), String(uprightId))

const up = uprightId ? await xform(uprightId) : null
check('...and resolves a transform through the chain', Boolean(up), JSON.stringify(up))
check(
  '...standing above the strip it bolts to',
  Boolean(up) && up.pos[1] > strip.pos[1],
  `strip y=${strip?.pos[1]}  upright y=${up?.pos[1]}`,
)

/* ------------------------------------------- it offers three graded levels */

// Ask as a sensor: sensor accepts CHASSIS_HOLE, so its candidate list is every
// hole in the build including the ones the upright raises.
const all = await nodesFor('sensor')
const levels = all.filter((n) => n.partId === uprightId).sort((a, b) => a.index - b.index)

check('The upright offers three holes', levels.length === 3, `got ${levels.length}`)
check(
  '...each one PITCH above the last',
  levels.length === 3 &&
    near(levels[1].pos[1] - levels[0].pos[1], 0.5, 1e-9) &&
    near(levels[2].pos[1] - levels[1].pos[1], 0.5, 1e-9),
  levels.map((n) => n.pos[1].toFixed(3)).join(' -> '),
)
check(
  '...all of them on the post, not beside it',
  levels.every((n) => near(n.pos[0], up.pos[0], 1e-9) && near(n.pos[2], up.pos[2], 1e-9)),
  levels.map((n) => `[${n.pos.map((v) => v.toFixed(2)).join(',')}]`).join(' '),
)
check(
  '...and all of them above the strip',
  levels.every((n) => n.pos[1] > strip.pos[1]),
  levels.map((n) => n.pos[1].toFixed(3)).join(', '),
)

/* ------------------------------- a fitting lands on the level it was given */

// This is the bug the mount chain used to have: every level put its child in
// the same place, because the axis step never looked at hostHole.
const top = levels[2]
const sensorId = await place('sensor', top.pos, { partId: uprightId, index: 2 })
const sensor = sensorId ? await xform(sensorId) : null
const sensorHole = await page.evaluate(
  (i) => window.__ARDUINIUM_BUILD__().parts[i]?.hostHole ?? null,
  sensorId,
)

check('A sensor mounts onto the top level', sensorHole === 2, `hostHole=${sensorHole}`)
check(
  '...and sits at that level, not at the post centre',
  Boolean(sensor) && sensor.pos[1] > up.pos[1],
  `upright centre y=${up?.pos[1].toFixed(3)}  sensor y=${sensor?.pos[1].toFixed(3)}`,
)
check(
  '...higher than the same sensor bolted flat to the strip',
  Boolean(sensor) && sensor.pos[1] > strip.pos[1] + 1.0,
  `strip y=${strip.pos[1].toFixed(3)}  sensor y=${sensor?.pos[1].toFixed(3)}`,
)

// Two different levels must give two different heights.
const bottom = levels[0]
const standoffId = await place('standoff', bottom.pos, { partId: uprightId, index: 0 })
const lower = standoffId ? await xform(standoffId) : null
check(
  'A second fitting on a lower level sits lower',
  Boolean(lower) && Boolean(sensor) && lower.pos[1] < sensor.pos[1] - 0.5,
  `low y=${lower?.pos[1].toFixed(3)}  high y=${sensor?.pos[1].toFixed(3)}`,
)

/* ------------------------------------------------------------- occupancy */

const free = (await nodesFor('sensor')).filter((n) => n.partId === uprightId)
check(
  'Taken levels drop out of the candidate list',
  free.length === 1 && free[0].index === 1,
  `free indices: ${free.map((n) => n.index).join(',') || 'none'}`,
)

/* ------------------------------------------- the L-bracket's raised hole */

await page.evaluate(() => window.__ARDUINIUM_BUILD__().clearAll())
const s2 = await place('strip11', [0, 0, 0])
const strip2 = await xform(s2)
const lbId = await place('lbracket', [strip2.pos[0] + 1, 0, strip2.pos[2]])
const lb = lbId ? await xform(lbId) : null
const lbNodes = (await nodesFor('sensor')).filter((n) => n.partId === lbId)

check('An L-bracket bolts onto a strip', Boolean(lbId), String(lbId))
check('...and raises exactly one hole', lbNodes.length === 1, `got ${lbNodes.length}`)

// The fix: the node must sit at the top of the UPRIGHT ARM, which is offset
// along the bracket's own +X — not directly above its origin, where it used to
// be while the mesh drew it half an arm away.
const armOffset =
  lbNodes.length === 1
    ? Math.hypot(lbNodes[0].pos[0] - lb.pos[0], lbNodes[0].pos[2] - lb.pos[2])
    : 0
check(
  '...offset along the arm, where the mesh draws it',
  near(armOffset, 0.45, 1e-6),
  `offset ${armOffset.toFixed(4)} (expected 0.45 = arm/2 - thickness/2)`,
)
check(
  '...and one arm above the bracket',
  lbNodes.length === 1 && near(lbNodes[0].pos[1] - lb.pos[1], 1.0, 1e-9),
  `rise ${(lbNodes[0]?.pos[1] - lb?.pos[1]).toFixed(4)}`,
)

/* ------------------------------------------------- a standoff still works */

await page.evaluate(() => window.__ARDUINIUM_BUILD__().clearAll())
const s3 = await place('strip11', [0, 0, 0])
const strip3 = await xform(s3)
const soId = await place('standoff', [strip3.pos[0] + 1, 0, strip3.pos[2]])
const so = soId ? await xform(soId) : null
const soNodes = (await nodesFor('sensor')).filter((n) => n.partId === soId)

check('A standoff raises exactly one hole', soNodes.length === 1, `got ${soNodes.length}`)
check(
  '...straight up, with no sideways offset',
  soNodes.length === 1 &&
    near(soNodes[0].pos[0], so.pos[0], 1e-9) &&
    near(soNodes[0].pos[2], so.pos[2], 1e-9),
  JSON.stringify(soNodes[0]?.pos),
)

// A fitting on a standoff must actually GAIN the standoff's height. It used to
// not: the chain subtracted the host's rise straight back off again, so a
// sensor on a standoff ended up level with one bolted to the bare strip.
const onStandoff = await place('sensor', soNodes[0].pos, { partId: soId, index: 0 })
const raised = onStandoff ? await xform(onStandoff) : null
await page.evaluate(() => window.__ARDUINIUM_BUILD__().clearAll())
const s4 = await place('strip11', [0, 0, 0])
const flatSensor = await place('sensor', [0, 0, 0])
const flat = flatSensor ? await xform(flatSensor) : null

check(
  'A sensor on a standoff sits higher than one on the bare strip',
  Boolean(raised) && Boolean(flat) && raised.pos[1] > flat.pos[1] + 0.3,
  `standoff ${raised?.pos[1].toFixed(3)} vs strip ${flat?.pos[1].toFixed(3)}`,
)

/* ------------------------------------------------------------------ done */

await browser.close()
const passed = results.filter((r) => r.startsWith('PASS')).length
console.log(results.join('\n'))
console.log(`\n${passed}/${results.length} PASS`)
console.log(errs.length ? `\nPAGE ERRORS:\n${errs.slice(0, 6).join('\n')}` : '\nno page errors')
process.exit(passed === results.length && errs.length === 0 ? 0 : 1)
