/**
 * The orientation core: 24-element rotation group, 3-axis rotation, free XYZ
 * placement, oriented snapping, and the v2 -> v3 save migration.
 *
 *   npx vite build --mode single
 *   node tools/orient-test.mjs
 *
 * Part one runs against src/lib/orient.js directly in node — the group is
 * pure integer math and needs no browser. Part two drives the build store in
 * the built bundle, the same way edit-test.mjs does, and re-reads
 * __ARDUINIUM_BUILD__() after every mutation (getState() is a snapshot).
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const here = path.dirname(fileURLToPath(import.meta.url))

const results = []
const check = (name, ok, detail = '') =>
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)

/* ==========================================================================
 * Part 1 — the group itself, pure node.
 * ======================================================================== */

const O = await import('../src/lib/orient.js')

check('The group closes to exactly 24 elements', O.ORIENT_COUNT === 24)
check(
  'Index 0 is the identity',
  JSON.stringify(O.matOf(O.ID)) === JSON.stringify([1, 0, 0, 0, 1, 0, 0, 0, 1]),
)

// The convention pin: fromRotY must reproduce geometry.js's yaw() exactly at
// quarter turns, or every migrated v2 part silently turns the wrong way.
const yaw = ([x, z], r) => [x * Math.cos(r) + z * Math.sin(r), -x * Math.sin(r) + z * Math.cos(r)]
{
  let ok = true
  for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    for (const v of [
      [1, 0],
      [0, 1],
      [2, -3],
    ]) {
      const a = O.apply(O.fromRotY(r), [v[0], 0, v[1]])
      const b = yaw(v, r)
      if (Math.abs(a[0] - b[0]) > 1e-9 || Math.abs(a[2] - b[2]) > 1e-9 || a[1] !== 0) ok = false
    }
  }
  check('fromRotY matches yaw() at every quarter turn', ok)
}

{
  let ok = true
  for (let a = 0; a < 24; a++) if (O.compose(a, O.invert(a)) !== O.ID) ok = false
  check('Every element composed with its inverse is identity', ok)
}

{
  // Stepping about any world axis four times returns home; one step forward
  // then one back is a no-op. This is the pair of facts the old scalar system
  // failed: Math.round(-0.5) === -0 made the reverse step vanish.
  let ok = true
  for (const axis of ['x', 'y', 'z']) {
    let o = O.ID
    for (let i = 0; i < 4; i++) o = O.stepWorld(o, axis, 1)
    if (o !== O.ID) ok = false
    if (O.stepWorld(O.stepWorld(O.ID, axis, 1), axis, -1) !== O.ID) ok = false
    if (O.stepWorld(O.stepWorld(O.ID, axis, -1), axis, 1) !== O.ID) ok = false
  }
  check('Four quarter turns about any axis return home; ±1 cancel', ok)
}

{
  const ups = new Set()
  for (let a = 0; a < 24; a++) ups.add(O.basisY(a).join(','))
  check('The 24 orientations cover all six up-directions', ups.size === 6)
}

{
  // Quaternions must rotate vectors identically to the matrices they mirror.
  const qrot = ([x, y, z, w], [vx, vy, vz]) => {
    const ix = w * vx + y * vz - z * vy
    const iy = w * vy + z * vx - x * vz
    const iz = w * vz + x * vy - y * vx
    const iw = -x * vx - y * vy - z * vz
    return [
      ix * w + iw * -x + iy * -z - iz * -y,
      iy * w + iw * -y + iz * -x - ix * -z,
      iz * w + iw * -z + ix * -y - iy * -x,
    ]
  }
  let ok = true
  for (let a = 0; a < 24; a++) {
    for (const v of [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [1, 2, 3],
    ]) {
      const m = O.apply(a, v)
      const q = qrot(O.quatOf(a), v)
      if (Math.hypot(m[0] - q[0], m[1] - q[1], m[2] - q[2]) > 1e-9) ok = false
    }
  }
  check('quatOf agrees with the matrix for every element', ok)
}

check(
  'stepLocal differs from stepWorld once tilted',
  // After a pitch, spinning about the LOCAL y is not the same as yawing about
  // the WORLD y — if these ever collapse together, spin is broken.
  O.stepLocal(O.stepWorld(O.ID, 'x', 1), 'y', 1) !== O.stepWorld(O.stepWorld(O.ID, 'x', 1), 'y', 1),
)

/* ==========================================================================
 * Part 2 — the store, in the built bundle.
 * ======================================================================== */

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
await page.locator('[data-testid="skip-onboarding"]').first().dispatchEvent('click')
await page.waitForTimeout(300)

const act = (fn, ...args) =>
  page.evaluate(
    ([f, a]) => {
      window.__ARDUINIUM_BUILD__()[f](...a)
    },
    [fn, args],
  )
const snap = () =>
  page.evaluate(() => {
    const b = window.__ARDUINIUM_BUILD__()
    return {
      parts: Object.values(b.parts),
      order: b.order,
      bolts: b.bolts,
      selected: b.selected,
      past: b.past.length,
      future: b.future.length,
      lift: b.buildLift(),
      pending: b.pending
        ? { rot: b.pending.rot, y: b.pending.y, carryY: b.pending.carryY, snap: b.pending.snap }
        : null,
    }
  })

/* ----------------------------------------------- free placement + the grid */

await act('clearAll')
await page.evaluate(() => {
  const b = window.__ARDUINIUM_BUILD__()
  b.beginPlace('strip7')
  b.movePending([0.13, 0, 0.31]) // deliberately off-grid
  b.commitPlace()
})
let s = await snap()
const s7 = s.parts.find((p) => p.kind === 'strip7')
check(
  'Free placement quantises to the PITCH grid',
  s7 && s7.pos[0] === 0 && s7.pos[2] === 0.5,
  s7 ? JSON.stringify(s7.pos) : 'missing',
)
check('A freshly placed part carries rot and its rotY mirror', s7?.rot === 0 && s7?.rotY === 0)

/* --------------------------------- two free strips still bolt via a bridge */

await page.evaluate(() => {
  const b = window.__ARDUINIUM_BUILD__()
  b.beginPlace('strip7')
  b.movePending([0.9, 0, 2.11]) // second strip, free, one PITCH row away in z
  b.commitPlace()
})
s = await snap()
const other = s.parts.filter((p) => p.kind === 'strip7')[1]
check(
  'A second free strip lands on the same grid',
  other && Math.abs(other.pos[2] - 2.0) < 1e-9,
  other ? JSON.stringify(other.pos) : 'missing',
)

/* -------------------------------------------------------- reverse rotation */

await act('clearAll')
await page.evaluate(() => {
  const b = window.__ARDUINIUM_BUILD__()
  b.beginPlace('strip7')
  b.movePending([0, 0, 0])
  b.commitPlace()
})
s = await snap()
const stripId = s.parts[0].id
const degOf = (p) => Math.round((((p.rotY * 180) / Math.PI) % 360 + 360) % 360)

await act('rotatePart', stripId, 1)
s = await snap()
check('rotatePart(+1) turns +90°', degOf(s.parts[0]) === 90, String(degOf(s.parts[0])))
await act('rotatePart', stripId, -1)
s = await snap()
check(
  'rotatePart(-1) turns BACK 90° (the bug the old quantiser hid)',
  degOf(s.parts[0]) === 0,
  String(degOf(s.parts[0])),
)

/* ------------------------------------------------- tilt: strip on its side */

await act('rotatePart', stripId, 1, 'x')
s = await snap()
const tilted = s.parts[0]
check('rotatePart about X changes rot away from yaw-only', tilted.rot !== 0, String(tilted.rot))
// A strip7 on its side: its length now runs vertically... no — pitch about X
// tips the strip's z-width up; its length still runs along x. Its holes' axes
// must now be horizontal.
const nodesTilted = await page.evaluate(() => window.__ARDUINIUM_NODES__('strip5'))
check(
  "A tilted strip's holes offer horizontal axes",
  nodesTilted.length > 0 && nodesTilted.every((n) => n.axis[1] === 0),
  JSON.stringify(nodesTilted[0]?.axis),
)

/* --------------------------- alignment gate: flat part vs. vertical holes */

await page.evaluate(() => {
  const b = window.__ARDUINIUM_BUILD__()
  b.beginPlace('strip5')
  b.movePending([0, 0, 0]) // right on top of the tilted strip's holes
})
s = await snap()
check(
  'A flat-held part does NOT snap to sideways holes (alignment gate)',
  s.pending && s.pending.snap === null,
  JSON.stringify(s.pending?.snap),
)
await act('rotatePending', 1, 'x')
s = await snap()
check(
  'Tilting the held part to the matching plane lets it snap',
  s.pending && s.pending.snap !== null,
  JSON.stringify(s.pending?.snap?.hostId ?? null),
)
await act('cancelPlace')

/* -------------------------------------------------- buildLift when tilted */

// Stand the strip on its END: after a yaw the length runs along z, then pitch
// about X tips that length vertical. The build must float by half its length.
await act('rotatePart', stripId, -1, 'x') // back flat
await act('rotatePart', stripId, 1) // yaw so length runs along z
await act('rotatePart', stripId, 1, 'x') // pitch: now the length is vertical
s = await snap()
const stripLen = 6 * 0.5 + 0.5 // (7-1)*PITCH + STRIP_W
// The part's origin is still at its flat resting height (y = STRIP_T/2);
// what matters is that the lift floats the LOWEST POINT to exactly zero:
// y - len/2 + lift === 0.
check(
  'A strip stood on end rests exactly on the ground',
  Math.abs(s.parts[0].y - stripLen / 2 + s.lift) < 1e-6,
  `lift=${s.lift} y=${s.parts[0].y}`,
)

/* ------------------------------------------------------- carry height Q/E */

await act('clearAll')
await page.evaluate(() => {
  const b = window.__ARDUINIUM_BUILD__()
  b.beginPlace('strip7')
  b.movePending([4, 0, 4])
})
await act('liftPending', 1)
await act('liftPending', 1)
s = await snap()
check(
  'liftPending raises the carried part in PITCH/2 steps',
  s.pending && Math.abs(s.pending.y - (0.045 + 0.5)) < 1e-9,
  `y=${s.pending?.y} carryY=${s.pending?.carryY}`,
)
await act('liftPending', -1)
await act('liftPending', -1)
await act('liftPending', -1)
s = await snap()
check(
  'liftPending clamps at resting height',
  s.pending && Math.abs(s.pending.y - 0.045) < 1e-9,
  `y=${s.pending?.y}`,
)
await page.evaluate(() => window.__ARDUINIUM_BUILD__().commitPlace())

/* ------------------------------------------------------------- nudgePart */

s = await snap()
const nudgeId = s.parts[0].id
const beforeNudge = s.parts[0].pos[0]
const beforePast = s.past
await act('nudgePart', nudgeId, [0.5, 0, 0])
await act('nudgePart', nudgeId, [0.5, 0, 0])
s = await snap()
check(
  'nudgePart moves by the given step',
  Math.abs(s.parts[0].pos[0] - (beforeNudge + 1.0)) < 1e-9,
  `x=${s.parts[0].pos[0]}`,
)
check(
  'Rapid nudges coalesce into one undo frame',
  s.past === beforePast + 1,
  `past ${beforePast} -> ${s.past}`,
)
await act('undo')
s = await snap()
check(
  'Undo returns the part to where the nudge run began',
  Math.abs(s.parts[0].pos[0] - beforeNudge) < 1e-9,
  `x=${s.parts[0].pos[0]}`,
)
await act('nudgePart', nudgeId, [0, 0.25, 0])
s = await snap()
check('nudgePart raises in Y', Math.abs(s.parts[0].y - 0.295) < 1e-9, `y=${s.parts[0].y}`)
await act('nudgePart', nudgeId, [0, -5, 0])
s = await snap()
check(
  'nudgePart clamps Y at resting height',
  Math.abs(s.parts[0].y - 0.045) < 1e-9,
  `y=${s.parts[0].y}`,
)

/* ------------------------------------------- spin: aiming a mounted sensor */

await act('clearAll')
await page.evaluate(() => {
  const b = window.__ARDUINIUM_BUILD__()
  b.beginPlace('strip11')
  b.movePending([0, 0, 0])
  b.commitPlace()
})
await page.evaluate(() => {
  const b = window.__ARDUINIUM_BUILD__()
  b.beginPlace('sensor')
  b.movePending([0, 0, 0], { partId: Object.values(b.parts)[0].id, index: 5 })
  b.commitPlace()
})
s = await snap()
const sensor = s.parts.find((p) => p.kind === 'sensor')
check('Sensor mounted mid-strip', Boolean(sensor), JSON.stringify(s.parts.map((p) => p.kind)))
const axisBefore = await page.evaluate(
  (id) => window.__ARDUINIUM_XFORM__(id).axis,
  sensor?.id ?? '',
)
await act('spinPart', sensor?.id ?? '', 1)
s = await snap()
const spun = s.parts.find((p) => p.kind === 'sensor')
const axisAfter = await page.evaluate((id) => window.__ARDUINIUM_XFORM__(id).axis, spun?.id ?? '')
check('spinPart records a quarter turn', spun?.spin === 1, `spin=${spun?.spin}`)
check(
  "spinPart turns the fitting's chain axis",
  JSON.stringify(axisBefore) !== JSON.stringify(axisAfter),
  `${JSON.stringify(axisBefore)} -> ${JSON.stringify(axisAfter)}`,
)
check(
  'rotatePart on a hole-mounted fitting routes to spin',
  await page.evaluate((id) => {
    const b = window.__ARDUINIUM_BUILD__()
    b.rotatePart(id, 1)
    return window.__ARDUINIUM_BUILD__().parts[id].spin === 2
  }, spun?.id ?? ''),
)

/* ----------------------------------------- v2 -> v3 migration + validation */

const loaded = await page.evaluate(() => {
  const b = window.__ARDUINIUM_BUILD__()
  return b.loadBuildFromJSON(
    {
      format: 'arduinium-build',
      version: 2,
      name: 'migration probe',
      parts: [
        { id: 'm-a', kind: 'strip7', pos: [0, 0, 0], y: 0.045, rotY: Math.PI / 2 },
        { id: 'm-bad', kind: 'no-such-part', pos: [0, 0, 0], y: 0.045, rotY: 0 },
        { id: 'm-orphan', kind: 'motormount', hostId: 'm-gone', hostHole: 0 },
      ],
      bolts: [],
      wires: [],
      program: [],
    },
    'probe',
  )
})
check('A v2 file loads', loaded === true)
s = await snap()
const migrated = s.parts.find((p) => p.id === 'm-a')
check(
  'v2 rotY migrates losslessly onto rot',
  migrated && migrated.rot !== 0 && Math.abs(Math.abs(migrated.rotY) - Math.PI / 2) < 1e-9,
  JSON.stringify({ rot: migrated?.rot, rotY: migrated?.rotY }),
)
check(
  'Unknown kinds and orphaned mounts are dropped, not zombified',
  s.parts.length === 1,
  JSON.stringify(s.parts.map((p) => p.id)),
)
const exported = await page.evaluate(() => window.__ARDUINIUM_BUILD__().exportBuildToJSON())
check('Exports are version 4', exported.version === 4, String(exported.version))
check(
  'Exported parts carry rot',
  exported.parts.every((p) => !p.pos || Number.isInteger(p.rot)),
)

/* ----------------------------- the rover template still migrates and works */

await page.locator('[data-testid="templates"]').first().dispatchEvent('click')
await page.waitForTimeout(250)
await page.locator('[data-template="rover"]').first().dispatchEvent('click')
await page.waitForTimeout(1000)
s = await snap()
check('Rover template (v2) loads through the migration', s.parts.length === 18)
check('Rover bolts survive the axis-aware fit test', s.bolts.length === 8, String(s.bolts.length))
check(
  'Every flat rover part gained rot',
  s.parts.filter((p) => p.pos).every((p) => Number.isInteger(p.rot)),
)

/* ------------------------------------------------------------------ done */

await browser.close()
const passed = results.filter((r) => r.startsWith('PASS')).length
console.log(results.join('\n'))
console.log(`\n${passed}/${results.length} PASS`)
console.log(errs.length ? `\nPAGE ERRORS:\n${errs.slice(0, 6).join('\n')}` : '\nno page errors')
process.exit(passed === results.length && errs.length === 0 ? 0 : 1)
