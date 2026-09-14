/**
 * Unit assertions for the block editor's model layer.
 *
 *   node tools/model-test.mjs
 *
 * No build, no browser, no dependencies — src/editor/model.js is deliberately
 * free of React and DOM imports so the fiddly parts (centroid rotation,
 * overlap rules, distribution spacing, import coercion) can be checked
 * directly. This is the harness that actually pins down the rotation maths;
 * the Playwright suite in editor-test.mjs covers the wiring above it.
 */
import {
  GRID,
  alignBlocks,
  boundsOf,
  clampGroupMove,
  createBlock,
  deserialize,
  distributeBlocks,
  footprint,
  hasOverlaps,
  isPlacementValid,
  rectOf,
  rectsOverlap,
  reorderLayer,
  rotateGroup,
  rotateGroupSafely,
  serialize,
  translateGroup,
} from '../src/editor/model.js'

const results = []
const check = (name, ok, detail = '') =>
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)

const pos = (bs) => JSON.stringify(bs.map((b) => [b.x, b.y, footprint(b).w, footprint(b).h]))
const mk = (x, y, w, h, extra) => createBlock({ x, y, w, h, ...extra })

/* ------------------------------------------------------------- footprint */

check('Footprint is unchanged at 0°', footprint(mk(0, 0, 4, 1)).w === 4)
check('Footprint swaps at 90°', JSON.stringify(footprint(mk(0, 0, 4, 1, { rotation: 90 }))) === '{"w":1,"h":4}')
check('Footprint swaps back at 180°', footprint(mk(0, 0, 4, 1, { rotation: 180 })).w === 4)
check('Footprint swaps at 270°', footprint(mk(0, 0, 4, 1, { rotation: 270 })).w === 1)

/* --------------------------------------------------------------- overlap */

check(
  'Touching edges do not overlap',
  !rectsOverlap({ x: 0, y: 0, w: 2, h: 2 }, { x: 2, y: 0, w: 2, h: 2 }),
)
check(
  'Shared interior does overlap',
  rectsOverlap({ x: 0, y: 0, w: 2, h: 2 }, { x: 1, y: 1, w: 2, h: 2 }),
)
check(
  'Placement rejects out-of-bounds',
  !isPlacementValid({ x: GRID.cols - 1, y: 0, w: 3, h: 1 }, []),
)
check(
  'Ignore set lets a block move onto itself',
  isPlacementValid({ x: 0, y: 0, w: 2, h: 2 }, [mk(0, 0, 2, 2, { id: 'self' })], new Set(['self'])),
)

/* -------------------------------------------------------------- rotation */

// The property that matters: cw then ccw is the identity, for any bbox shape.
let roundTripFails = []
for (const group of [
  [mk(0, 0, 4, 1)],
  [mk(5, 5, 3, 2)],
  [mk(2, 2, 1, 1)],
  [mk(3, 4, 6, 1)],
  [mk(0, 0, 4, 1), mk(0, 1, 1, 3), mk(2, 2, 2, 1)],
  [mk(7, 2, 2, 3), mk(9, 2, 1, 1), mk(7, 5, 3, 1)],
]) {
  const there = rotateGroup(group, 'cw')
  const back = rotateGroup(there, 'ccw')
  if (pos(group) !== pos(back)) roundTripFails.push(`${pos(group)} -> ${pos(back)}`)
  // And the other way round, which exercises the opposite rounding branch.
  const there2 = rotateGroup(group, 'ccw')
  const back2 = rotateGroup(there2, 'cw')
  if (pos(group) !== pos(back2)) roundTripFails.push(`ccw-first ${pos(group)} -> ${pos(back2)}`)
}
check('Rotation round-trips exactly (cw+ccw)', roundTripFails.length === 0, roundTripFails.join(' ; '))

// Four turns in the same direction must also be the identity.
let quadFails = []
for (const group of [[mk(0, 0, 4, 1)], [mk(5, 5, 3, 2)], [mk(1, 1, 5, 2), mk(1, 3, 2, 2)]]) {
  let g = group
  for (let i = 0; i < 4; i++) g = rotateGroup(g, 'cw')
  if (pos(group) !== pos(g)) quadFails.push(`${pos(group)} -> ${pos(g)}`)
}
check('Four clockwise turns are the identity', quadFails.length === 0, quadFails.join(' ; '))

// A quarter turn must swap the group's bounding box dimensions.
const wide = [mk(2, 2, 4, 1), mk(2, 3, 2, 1)]
const wideBB = boundsOf(wide)
const turnedBB = boundsOf(rotateGroup(wide, 'cw'))
check(
  'Rotation swaps the group bounding box',
  turnedBB.w === wideBB.h && turnedBB.h === wideBB.w,
  `${wideBB.w}x${wideBB.h} -> ${turnedBB.w}x${turnedBB.h}`,
)

// Relative layout must survive: pairwise offsets rotate together, never shear.
const shape = [mk(0, 0, 4, 1), mk(0, 1, 1, 3), mk(2, 2, 2, 1)]
const rotated = rotateGroup(shape, 'cw')
check(
  'Rotation preserves relative layout (no shear)',
  new Set(rotated.map((b) => `${b.x},${b.y}`)).size === 3 &&
    boundsOf(rotated).w === boundsOf(shape).h,
)

// Rotation must not leave the grid, and must refuse when it genuinely cannot fit.
const nearEdge = [mk(0, 0, 4, 1)]
const safe = rotateGroupSafely(nearEdge, nearEdge, 'cw')
check(
  'rotateGroupSafely pulls the group back in bounds',
  safe && safe.every((b) => isPlacementValid(rectOf(b), [], new Set(safe.map((s) => s.id)))),
  safe ? pos(safe) : 'null',
)

const boxedIn = [mk(0, 0, 3, 1, { id: 'a' })]
const wall = [mk(0, 1, 3, 3, { id: 'w' })]
check(
  'rotateGroupSafely refuses when blocked',
  rotateGroupSafely(boxedIn, [...boxedIn, ...wall], 'cw') === null,
)

/* -------------------------------------------------------------- movement */

const pair = [mk(0, 0, 2, 1, { id: 'p1' }), mk(0, 1, 2, 1, { id: 'p2' })]
const movedPair = translateGroup(pair, pair, 3, 2)
check(
  'translateGroup preserves relative offsets',
  movedPair[0].x === 3 && movedPair[0].y === 2 && movedPair[1].x === 3 && movedPair[1].y === 3,
)
check('translateGroup rejects an illegal move', translateGroup(pair, pair, -1, 0) === null)

const slide = clampGroupMove(pair, pair, -5, 0)
check('clampGroupMove slides against the wall instead of refusing', slide.dx === 0 && slide.dy === 0)
const slideAxis = clampGroupMove(pair, pair, -5, 3)
check(
  'clampGroupMove still travels on the free axis',
  slideAxis.dy === 3 && slideAxis.dx === 0,
  JSON.stringify(slideAxis),
)

/* ------------------------------------------------------------- alignment */

const scattered = [mk(0, 0, 2, 1, { id: 'a' }), mk(5, 3, 1, 1, { id: 'b' }), mk(9, 7, 3, 1, { id: 'c' })]
const left = alignBlocks(scattered, 'left')
check('Align left shares one x', new Set(left.map((b) => b.x)).size === 1 && left[0].x === 0)
const right = alignBlocks(scattered, 'right')
const bbR = boundsOf(scattered)
check(
  'Align right shares a right edge',
  right.every((b) => b.x + footprint(b).w === bbR.x + bbR.w),
)
const top = alignBlocks(scattered, 'top')
check('Align top shares one y', new Set(top.map((b) => b.y)).size === 1)

/* ----------------------------------------------------------- distribute */

const spread = [
  mk(0, 0, 2, 1, { id: 'd1' }),
  mk(3, 0, 1, 1, { id: 'd2' }),
  mk(5, 0, 1, 1, { id: 'd3' }),
  mk(12, 0, 2, 1, { id: 'd4' }),
]
const even = distributeBlocks(spread, 'x')
const sortedEven = [...even].sort((a, b) => a.x - b.x)
const gaps = []
for (let i = 1; i < sortedEven.length; i++) {
  gaps.push(sortedEven[i].x - (sortedEven[i - 1].x + footprint(sortedEven[i - 1]).w))
}
check(
  'Distribute equalises the gaps (within rounding)',
  Math.max(...gaps) - Math.min(...gaps) <= 1,
  `gaps=${gaps.join(',')}`,
)
check(
  'Distribute keeps the outermost blocks anchored',
  sortedEven[0].x === 0 && sortedEven[3].x + footprint(sortedEven[3]).w === 14,
  `first=${sortedEven[0].x} lastEnd=${sortedEven[3].x + footprint(sortedEven[3]).w}`,
)
check('Distribute preserves input order', JSON.stringify(even.map((b) => b.id)) === JSON.stringify(spread.map((b) => b.id)))

/* Regression: align/distribute rearrange blocks *relative to each other*, so
   validating each one against only the blocks that stayed put approves boards
   where the moved blocks have piled onto one another. hasOverlaps is the check
   that actually catches it. */
const collide = [mk(0, 0, 6, 1, { id: 'c1' }), mk(8, 0, 2, 2, { id: 'c2' })]
const piled = alignBlocks(collide, 'left')
check(
  'hasOverlaps catches an align that piles blocks up',
  hasOverlaps(piled),
  JSON.stringify(piled.map((b) => [b.x, b.y])),
)
check('hasOverlaps is false for a legal board', !hasOverlaps(scattered))

/* ---------------------------------------------------------------- layers */

const stack = [mk(0, 0, 1, 1, { id: 'z1', z: 0 }), mk(2, 0, 1, 1, { id: 'z2', z: 1 }), mk(4, 0, 1, 1, { id: 'z3', z: 2 })]
const toFront = reorderLayer(stack, new Set(['z1']), 'front')
check('Bring to front gives the top z', toFront.find((b) => b.id === 'z1').z === 2)
const toBack = reorderLayer(stack, new Set(['z3']), 'back')
check('Send to back gives the bottom z', toBack.find((b) => b.id === 'z3').z === 0)
check('Layer reorder keeps z values dense', new Set(toFront.map((b) => b.z)).size === 3)

/* --------------------------------------------------------- serialization */

const board = [mk(1, 1, 3, 2, { label: 'a', color: '#23a06a' }), mk(6, 4, 2, 2, { rotation: 90 })]
const dump = serialize(board, { x: 12, y: 34, scale: 1.5 })
const round = deserialize(JSON.parse(JSON.stringify(dump)))
check(
  'Serialize/deserialize round-trips positions',
  pos(round.blocks) === pos(board),
  `${pos(board)} -> ${pos(round.blocks)}`,
)
check('Viewport survives the round-trip', round.viewport.x === 12 && round.viewport.scale === 1.5)
check('Round-trip drops nothing', round.skipped.length === 0)

const hostile = deserialize({
  blocks: [
    { id: 'ok', x: 1, y: 1, w: 2, h: 2, color: '#23a06a' },
    { id: 'far', x: 99999, y: -500, w: 2, h: 2 },
    { id: 'huge', x: 0, y: 0, w: 9999, h: 9999 },
    { id: 'ok', x: 20, y: 20, w: 1, h: 1 }, // duplicate id
    { id: 'nan', x: 'abc', y: null, w: 'x', h: undefined },
    'not an object',
    null,
    42,
  ],
  viewport: { x: 'bad', y: NaN, scale: 999 },
})
check(
  'Hostile import keeps every block in bounds',
  hostile.blocks.every((b) => {
    const f = footprint(b)
    return b.x >= 0 && b.y >= 0 && b.x + f.w <= GRID.cols && b.y + f.h <= GRID.rows
  }),
)
check(
  'Hostile import produces no overlaps',
  hostile.blocks.every((b, i) =>
    hostile.blocks.every((o, j) => i === j || !rectsOverlap(rectOf(b), rectOf(o))),
  ),
)
check(
  'Hostile import gives every block a unique id',
  new Set(hostile.blocks.map((b) => b.id)).size === hostile.blocks.length,
)
check(
  'Hostile import clamps the viewport scale',
  hostile.viewport.scale <= 3 && hostile.viewport.scale >= 0.25 && Number.isFinite(hostile.viewport.x),
  JSON.stringify(hostile.viewport),
)
check('Hostile import reports what it dropped', hostile.skipped.length > 0, `${hostile.skipped.length} skipped`)

let threw = false
try {
  deserialize({ nope: true })
} catch {
  threw = true
}
check('Unrecognisable payload throws', threw)

/* ------------------------------------------------------------------ done */

const passed = results.filter((r) => r.startsWith('PASS')).length
console.log(results.join('\n'))
console.log(`\n${passed}/${results.length} PASS`)
process.exit(passed === results.length ? 0 : 1)
