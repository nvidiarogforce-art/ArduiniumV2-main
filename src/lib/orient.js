/**
 * The 24 orientations a part can have when every rotation is a quarter turn.
 *
 * Mathematically this is the rotation group of the cube: every 3×3 rotation
 * matrix whose entries are only -1, 0 or 1. A part's orientation is stored as
 * ONE INTEGER — an index into this table — which buys three things the obvious
 * alternatives (a quaternion array, an Euler triple) do not:
 *
 *   - exact arithmetic. A hole's axis comes out as a unit vector of integers,
 *     so "are these two holes aligned?" is an integer comparison, not an
 *     epsilon test. Only *positions* ever need tolerances.
 *   - composition is a 24×24 lookup table, inversion is a transpose.
 *   - a save file carries `rot: 17`, not eight floats.
 *
 * Matrices are flat row-major 9-tuples acting on column vectors:
 * world = M · local. `apply(a, v)` is that product.
 *
 * ORDER IS PART OF THE SAVE FORMAT. A part's `rot` is an index into MATS, so
 * the canonical order below — identity first, the other 23 sorted by their
 * 9-tuple — must never change. It is derived by sorting, not by generation
 * order, precisely so that refactoring the generator cannot reshuffle it.
 */

const I = [1, 0, 0, 0, 1, 0, 0, 0, 1]
const RX = [1, 0, 0, 0, 0, -1, 0, 1, 0] // +90° about world X: (x,y,z) -> (x,-z,y)
const RY = [0, 0, 1, 0, 1, 0, -1, 0, 0] // +90° about world Y: (x,y,z) -> (z,y,-x)
const RZ = [0, -1, 0, 1, 0, 0, 0, 0, 1] // +90° about world Z: (x,y,z) -> (-y,x,z)

// RY is chosen to match yaw() in geometry.js exactly: yaw([x,z], π/2) = [z,-x],
// and apply(RY, [x,0,z]) = [z,0,-x]. orient-test.mjs pins this equivalence.

function mul(a, b) {
  const m = new Array(9)
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      m[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]
    }
  }
  return m
}

const keyOf = (m) => m.join(',')

const MATS = (() => {
  // Close {I} under the three generators, then impose the canonical order.
  const seen = new Map([[keyOf(I), I]])
  const queue = [I]
  while (queue.length) {
    const m = queue.pop()
    for (const g of [RX, RY, RZ]) {
      const n = mul(g, m)
      const k = keyOf(n)
      if (!seen.has(k)) {
        seen.set(k, n)
        queue.push(n)
      }
    }
  }
  const rest = [...seen.values()].filter((m) => keyOf(m) !== keyOf(I))
  rest.sort((a, b) => {
    for (let i = 0; i < 9; i++) if (a[i] !== b[i]) return a[i] - b[i]
    return 0
  })
  const all = [I, ...rest]
  if (all.length !== 24) throw new Error(`orientation group closed to ${all.length}, expected 24`)
  return all
})()

const INDEX = new Map(MATS.map((m, i) => [keyOf(m), i]))

export const ID = 0
export const ORIENT_COUNT = 24

/** True for anything that can index MATS — the shape a save file must carry. */
export const isOrient = (a) => Number.isInteger(a) && a >= 0 && a < 24

const MUL = (() => {
  const t = new Uint8Array(24 * 24)
  for (let a = 0; a < 24; a++) {
    for (let b = 0; b < 24; b++) {
      t[a * 24 + b] = INDEX.get(keyOf(mul(MATS[a], MATS[b])))
    }
  }
  return t
})()

const INV = (() => {
  const t = new Uint8Array(24)
  for (let a = 0; a < 24; a++) {
    const m = MATS[a]
    // A rotation's inverse is its transpose.
    t[a] = INDEX.get(keyOf([m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]))
  }
  return t
})()

/** compose(a, b): the orientation reached by applying b first, then a. */
export const compose = (a, b) => MUL[a * 24 + b]
export const invert = (a) => INV[a]
export const matOf = (a) => MATS[a]

export function apply(a, [x, y, z]) {
  const m = MATS[a]
  return [
    m[0] * x + m[1] * y + m[2] * z,
    m[3] * x + m[4] * y + m[5] * z,
    m[6] * x + m[7] * y + m[8] * z,
  ]
}

/** Images of the local axes — the columns of the matrix. */
export const basisX = (a) => apply(a, [1, 0, 0])
export const basisY = (a) => apply(a, [0, 1, 0])
export const basisZ = (a) => apply(a, [0, 0, 1])

const STEP = {
  x: { 1: INDEX.get(keyOf(RX)), [-1]: INV[INDEX.get(keyOf(RX))] },
  y: { 1: INDEX.get(keyOf(RY)), [-1]: INV[INDEX.get(keyOf(RY))] },
  z: { 1: INDEX.get(keyOf(RZ)), [-1]: INV[INDEX.get(keyOf(RZ))] },
}

/** A quarter turn about a WORLD axis — what the rotate keys do. */
export const stepWorld = (a, axis, dir = 1) => compose(STEP[axis][dir >= 0 ? 1 : -1], a)

/** A quarter turn about the part's own LOCAL axis — what a fitting's spin is. */
export const stepLocal = (a, axis, dir = 1) => compose(a, STEP[axis][dir >= 0 ? 1 : -1])

/** Compose a count of local quarter turns; spin is not a direction. */
export function turnLocal(a, axis, turns = 0) {
  const count = Number.isInteger(turns) ? ((turns % 4) + 4) % 4 : 0
  for (let i = 0; i < count; i++) a = stepLocal(a, axis)
  return a
}

/** Half a turn about Y, used when a chain fitting faces the other way. */
export const YAW180 = compose(STEP.y[1], STEP.y[1])

/**
 * The orientation a legacy `rotY` maps to. Lossless for everything the app
 * ever wrote: snapAngle() has always quantised rotY to quarter turns.
 */
export function fromRotY(rotY = 0) {
  if (!Number.isFinite(rotY)) return ID
  const k = ((Math.round(rotY / (Math.PI / 2)) % 4) + 4) % 4
  let o = ID
  for (let i = 0; i < k; i++) o = compose(STEP.y[1], o)
  return o
}

/**
 * The yaw a consumer of the old scalar sees. Exact for yaw-only orientations;
 * for a tilted part it is the yaw of wherever local +X ended up — the same
 * collapse mountYaw() in Build.jsx always performed.
 */
export function yawOf(a) {
  const bx = basisX(a)
  return Math.atan2(-bx[2], bx[0])
}

/** Does this orientation keep the part flat on the build plane? */
export const isYawOnly = (a) => MATS[a][4] === 1 && MATS[a][1] === 0 && MATS[a][3] === 0

/** [x, y, z, w] quaternion per orientation, precomputed for rendering. */
export const QUATS = MATS.map((m) => {
  const tr = m[0] + m[4] + m[8]
  let x
  let y
  let z
  let w
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2
    w = s / 4
    x = (m[7] - m[5]) / s
    y = (m[2] - m[6]) / s
    z = (m[3] - m[1]) / s
  } else if (m[0] > m[4] && m[0] > m[8]) {
    const s = Math.sqrt(1 + m[0] - m[4] - m[8]) * 2
    x = s / 4
    w = (m[7] - m[5]) / s
    y = (m[1] + m[3]) / s
    z = (m[2] + m[6]) / s
  } else if (m[4] > m[8]) {
    const s = Math.sqrt(1 + m[4] - m[0] - m[8]) * 2
    y = s / 4
    w = (m[2] - m[6]) / s
    x = (m[1] + m[3]) / s
    z = (m[5] + m[7]) / s
  } else {
    const s = Math.sqrt(1 + m[8] - m[0] - m[4]) * 2
    z = s / 4
    w = (m[3] - m[1]) / s
    x = (m[2] + m[6]) / s
    y = (m[5] + m[7]) / s
  }
  return [x, y, z, w]
})

export const quatOf = (a) => QUATS[a]
