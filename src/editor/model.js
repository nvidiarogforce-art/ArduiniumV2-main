/* ==========================================================================
   Block editor — pure model layer

   Everything in this file is a plain function over plain data. No React, no
   DOM, no module-level mutable state. That is deliberate: all the fiddly parts
   of an editor (rotation about a centroid, overlap rules, distribution
   spacing) are exactly the parts you want to be able to reason about — and
   test — without mounting anything.

   Coordinate conventions used throughout:

     * Cell coordinates are integers. (0,0) is the top-left cell of the grid.
     * x increases to the right, y increases DOWNWARD (screen convention).
       This matters for the rotation math below: with y pointing down, the
       matrix for a *visually* clockwise turn is the one you would normally
       call counter-clockwise.
     * A block's (x, y) is the top-left cell of its footprint, always in
       already-rotated space. There is no separate "anchor" or pivot per
       block — a block's rotation only ever swaps its footprint dimensions.
   ========================================================================== */

/** Grid size in cells, and the unscaled pixel size of one cell. */
export const GRID = { cols: 40, rows: 26, cell: 28 }

/** Zoom limits from the spec. */
export const ZOOM = { min: 0.25, max: 3, step: 1.1 }

/** History depth. Snapshots are cheap here (a few hundred small objects). */
export const HISTORY_LIMIT = 50

/**
 * The palette offered in the inspector. These are the project's own accent
 * colours so a canvas built here sits next to the rest of the UI without
 * looking like it came from a different application.
 */
export const PALETTE = [
  { name: 'blue', fill: '#2f6fd9' },
  { name: 'green', fill: '#23a06a' },
  { name: 'orange', fill: '#ef8b2c' },
  { name: 'red', fill: '#dd5346' },
  { name: 'purple', fill: '#7b5ed6' },
  { name: 'teal', fill: '#1c9aa8' },
  { name: 'slate', fill: '#4d6070' },
]

/**
 * Block kinds available from the palette. `w`/`h` are the *unrotated*
 * footprint; a kind is just a preset, blocks are free to diverge afterwards.
 */
export const BLOCK_KINDS = [
  { kind: 'tile', label: 'Tile', w: 1, h: 1, color: '#2f6fd9' },
  { kind: 'beam', label: 'Beam', w: 4, h: 1, color: '#23a06a' },
  { kind: 'plate', label: 'Plate', w: 3, h: 2, color: '#ef8b2c' },
  { kind: 'block', label: 'Block', w: 2, h: 2, color: '#7b5ed6' },
  { kind: 'wall', label: 'Wall', w: 6, h: 1, color: '#4d6070' },
  { kind: 'pad', label: 'Pad', w: 4, h: 3, color: '#1c9aa8' },
]

let idSeq = 0
/** Monotonic id. Prefixed so ids read clearly in exported JSON. */
export const nextId = () => `b${++idSeq}_${Math.random().toString(36).slice(2, 7)}`

/** Reset the id counter — only used when importing, to avoid unbounded growth. */
export function seedIds(blocks) {
  for (const b of blocks) {
    const n = Number(String(b.id).match(/^b(\d+)_/)?.[1])
    if (Number.isFinite(n) && n > idSeq) idSeq = n
  }
}

/** A block with every field populated, so nothing downstream has to guard. */
export function createBlock(patch = {}) {
  return {
    id: nextId(),
    kind: 'tile',
    label: '',
    x: 0,
    y: 0,
    w: 1,
    h: 1,
    rotation: 0, // 0 | 90 | 180 | 270, clockwise on screen
    color: '#2f6fd9',
    z: 0,
    locked: false,
    hidden: false,
    props: {}, // free-form user key/value pairs, surfaced in the inspector
    ...patch,
  }
}

/* --------------------------------------------------------------- geometry */

/**
 * Effective footprint after rotation. A quarter turn swaps width and height;
 * a half turn leaves them alone. This is the only place rotation affects
 * size, which is why blocks never need a stored "rotated w/h".
 */
export function footprint(b) {
  const quarter = ((b.rotation % 360) + 360) % 360 === 90 || ((b.rotation % 360) + 360) % 360 === 270
  return quarter ? { w: b.h, h: b.w } : { w: b.w, h: b.h }
}

/** The block's occupied rectangle in cell space. */
export function rectOf(b) {
  const f = footprint(b)
  return { x: b.x, y: b.y, w: f.w, h: f.h }
}

/** Half-open rectangle intersection: touching edges do NOT count as overlap. */
export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

/** Does a rectangle fit entirely inside the grid? */
export function inBounds(r, cols = GRID.cols, rows = GRID.rows) {
  return r.x >= 0 && r.y >= 0 && r.x + r.w <= cols && r.y + r.h <= rows
}

/** Tightest bounding box (in cells) around a set of blocks. */
export function boundsOf(blocks) {
  if (!blocks.length) return { x: 0, y: 0, w: 0, h: 0 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const b of blocks) {
    const r = rectOf(b)
    minX = Math.min(minX, r.x)
    minY = Math.min(minY, r.y)
    maxX = Math.max(maxX, r.x + r.w)
    maxY = Math.max(maxY, r.y + r.h)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

/**
 * Is this rectangle a legal place to put a block?
 *
 * `ignore` is the set of ids that should not count as obstacles — during a
 * group drag every block in the moving selection has to ignore every other
 * block in that same selection, or the group would collide with itself.
 *
 * Hidden blocks still occupy their cells. Hiding is a viewing aid; letting a
 * hidden block be silently overlapped would make un-hiding produce an invalid
 * board, which is the kind of surprise that erodes trust in an editor.
 */
export function isPlacementValid(rect, blocks, ignore = EMPTY_SET) {
  if (!inBounds(rect)) return false
  for (const other of blocks) {
    if (ignore.has(other.id)) continue
    if (rectsOverlap(rect, rectOf(other))) return false
  }
  return true
}

const EMPTY_SET = new Set()

/**
 * Does any pair in this set overlap?
 *
 * `isPlacementValid` answers "may this block go here, ignoring these others",
 * which is the right question for a move that preserves relative offsets — the
 * group cannot collide with itself. Align and distribute *rearrange* blocks
 * relative to one another, so they need this whole-set check instead: with
 * every block in the ignore set, the per-block test silently approves a board
 * where the moved blocks have landed on top of each other.
 */
export function hasOverlaps(blocks) {
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      if (rectsOverlap(rectOf(blocks[i]), rectOf(blocks[j]))) return true
    }
  }
  return false
}

/** Every cell a rectangle covers, as "x,y" keys. Used for the drag preview. */
export function cellsOf(rect) {
  const out = []
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) out.push(`${x},${y}`)
  }
  return out
}

/* ---------------------------------------------------------------- movement */

/**
 * Translate a set of blocks by a whole number of cells, preserving relative
 * offsets exactly. Returns null if the move is illegal for any member, so the
 * caller can reject the whole gesture rather than partially applying it —
 * a group drag that moves three of five blocks is worse than one that moves
 * none.
 */
export function translateGroup(blocks, all, dx, dy) {
  const moving = new Set(blocks.map((b) => b.id))
  const moved = blocks.map((b) => ({ ...b, x: b.x + dx, y: b.y + dy }))
  for (const b of moved) {
    if (!isPlacementValid(rectOf(b), all, moving)) return null
  }
  return moved
}

/**
 * Largest fraction of the requested delta that is actually legal.
 *
 * Dragging a group into a wall should slide it up against the wall, not
 * refuse to move at all. We walk the delta down toward zero and take the first
 * offset that fits — cheap, because a drag delta is only ever a few cells per
 * frame, and it makes the group feel like it has weight.
 */
export function clampGroupMove(blocks, all, dx, dy) {
  if (translateGroup(blocks, all, dx, dy)) return { dx, dy }
  const steps = Math.max(Math.abs(dx), Math.abs(dy))
  for (let i = steps - 1; i > 0; i--) {
    const sx = Math.round((dx * i) / steps)
    const sy = Math.round((dy * i) / steps)
    if (translateGroup(blocks, all, sx, sy)) return { dx: sx, dy: sy }
  }
  // Then try sliding along a single axis, so a group blocked vertically can
  // still travel horizontally.
  if (translateGroup(blocks, all, dx, 0)) return { dx, dy: 0 }
  if (translateGroup(blocks, all, 0, dy)) return { dx: 0, dy }
  return { dx: 0, dy: 0 }
}

/* ---------------------------------------------------------------- rotation */

/**
 * Rotate a group 90° about the centre of its own bounding box.
 *
 * This is done in two exact stages rather than one rounded one, because the
 * obvious approach — rotate each block's rectangle about the half-cell pivot
 * and round — rounds every block *independently*, which can shear a group's
 * internal layout, and drifts by a cell each time you turn back and forth.
 *
 * Stage 1: rotate inside the bounding box, in pure integers.
 *
 *   Work in box-local coordinates, lx = x - bx, ly = y - by, in a box of
 *   W x H. Screen y points down, so a *visually clockwise* quarter turn maps
 *   a point (px, py) to (H - py, px) — check the corners: (0,0) -> (H,0) and
 *   (W,H) -> (0,W), so the W x H box becomes an H x W box, as it must.
 *
 *   A block is a rectangle, so map both opposite corners and take the
 *   componentwise minimum. Clockwise:
 *
 *     (lx,      ly     ) -> (H - ly,      lx     )
 *     (lx + fw, ly + fh) -> (H - ly - fh, lx + fw)
 *
 *   giving  newLx = H - ly - fh,  newLy = lx.
 *   Counter-clockwise maps (px, py) -> (py, W - px), giving
 *           newLx = ly,           newLy = W - lx - fw.
 *
 *   Every term is an integer, so relative layout is preserved exactly.
 *
 * Stage 2: recentre the box, once, for the whole group.
 *
 *   Stage 1 leaves the rotated H x W box anchored at the old top-left, but the
 *   spec pivots about the centre, so shift by the difference of the two
 *   centres: d = ((W-H)/2, (H-W)/2). Note dy is exactly -dx. That lands on a
 *   half cell whenever W and H differ in parity — the one unavoidable rounding
 *   in the operation. It is applied to the entire group as a single
 *   translation, so it can never distort the arrangement.
 *
 *   The rounding has to be *odd* (f(-v) === -f(v)) or turns accumulate error:
 *   Math.floor and Math.round both break the dy = -dx symmetry on a half cell
 *   (Math.round(1.5) is 2 but Math.round(-1.5) is -1), and four clockwise
 *   turns then land two cells from where they started instead of home.
 *   Rounding half *away from zero* is odd, which makes cw and ccw exact
 *   inverses and any four same-direction turns the identity.
 *
 * The footprint swap is implicit: bumping `rotation` by 90° makes footprint()
 * report it, so w/h are never rewritten.
 */
export function rotateGroup(blocks, dir = 'cw') {
  if (!blocks.length) return blocks
  const cw = dir === 'cw'
  const bb = boundsOf(blocks)
  const { x: bx, y: by, w: W, h: H } = bb

  // Half-cell recentring offset. Same expression for both directions — the
  // odd rounding is what makes them inverses, not a per-direction special case.
  const dx = roundHalfAway((W - H) / 2)
  const dy = -dx

  return blocks.map((b) => {
    const f = footprint(b)
    const lx = b.x - bx
    const ly = b.y - by
    const nlx = cw ? H - ly - f.h : ly
    const nly = cw ? lx : W - lx - f.w
    return {
      ...b,
      x: bx + nlx + dx,
      y: by + nly + dy,
      rotation: (((b.rotation + (cw ? 90 : 270)) % 360) + 360) % 360,
    }
  })
}

/**
 * Round half away from zero, so that f(-v) === -f(v).
 *
 * JavaScript's Math.round breaks that symmetry — it rounds halves toward
 * +Infinity, so Math.round(1.5) is 2 while Math.round(-1.5) is -1.
 */
function roundHalfAway(v) {
  return v < 0 ? -Math.round(-v) : Math.round(v)
}

/**
 * Rotate, then nudge the result back inside the grid if the turn pushed it
 * out. Returns null when the rotated group cannot be made legal — the caller
 * reports that rather than silently mangling the layout.
 */
export function rotateGroupSafely(blocks, all, dir) {
  let turned = rotateGroup(blocks, dir)
  const bb = boundsOf(turned)

  // Shift the whole group back inside the boundary in one move, preserving
  // relative offsets.
  let sx = 0
  let sy = 0
  if (bb.x < 0) sx = -bb.x
  if (bb.y < 0) sy = -bb.y
  if (bb.x + bb.w > GRID.cols) sx = GRID.cols - (bb.x + bb.w)
  if (bb.y + bb.h > GRID.rows) sy = GRID.rows - (bb.y + bb.h)
  if (sx || sy) turned = turned.map((b) => ({ ...b, x: b.x + sx, y: b.y + sy }))

  const moving = new Set(turned.map((b) => b.id))
  for (const b of turned) {
    if (!isPlacementValid(rectOf(b), all, moving)) return null
  }
  return turned
}

/* --------------------------------------------------------------- alignment */

/**
 * Align every block in the group to one edge (or centre line) of the group's
 * bounding box. Centre alignment rounds, so an odd-width block inside an
 * even-width box lands on a whole cell rather than a half.
 */
export function alignBlocks(blocks, mode) {
  if (blocks.length < 2) return blocks
  const bb = boundsOf(blocks)
  return blocks.map((b) => {
    const f = footprint(b)
    switch (mode) {
      case 'left':
        return { ...b, x: bb.x }
      case 'right':
        return { ...b, x: bb.x + bb.w - f.w }
      case 'centerX':
        return { ...b, x: Math.round(bb.x + (bb.w - f.w) / 2) }
      case 'top':
        return { ...b, y: bb.y }
      case 'bottom':
        return { ...b, y: bb.y + bb.h - f.h }
      case 'centerY':
        return { ...b, y: Math.round(bb.y + (bb.h - f.h) / 2) }
      default:
        return b
    }
  })
}

/**
 * Even spacing along one axis.
 *
 * The two outermost blocks stay put — they define the span — and everything
 * between them is redistributed so the *gaps* are equal. Distributing centres
 * instead of gaps is the other common reading, but it looks wrong the moment
 * blocks have different sizes, which here they usually do.
 *
 * If the blocks are wider than the span they have to share, the gap goes
 * negative; we clamp to zero and pack them, which at least stays legible.
 */
export function distributeBlocks(blocks, axis) {
  if (blocks.length < 3) return blocks
  const pos = axis === 'x' ? 'x' : 'y'
  const dim = axis === 'x' ? 'w' : 'h'

  const sorted = [...blocks].sort((a, b) => a[pos] - b[pos])
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const lastF = footprint(last)

  const span = last[pos] + lastF[dim] - first[pos]
  const used = sorted.reduce((sum, b) => sum + footprint(b)[dim], 0)
  const gap = Math.max(0, (span - used) / (sorted.length - 1))

  let cursor = first[pos]
  const moved = new Map()
  for (const b of sorted) {
    moved.set(b.id, { ...b, [pos]: Math.round(cursor) })
    cursor += footprint(b)[dim] + gap
  }
  // Preserve the caller's ordering; only positions changed.
  return blocks.map((b) => moved.get(b.id) ?? b)
}

/* ------------------------------------------------------------------ layers */

/** Re-pack z-indices into 0..n-1 so they never drift toward huge numbers. */
export function normalizeZ(blocks) {
  const sorted = [...blocks].sort((a, b) => a.z - b.z)
  const z = new Map(sorted.map((b, i) => [b.id, i]))
  return blocks.map((b) => ({ ...b, z: z.get(b.id) }))
}

/**
 * Move the given ids to the top (or bottom) of the stack, keeping their
 * relative order among themselves.
 */
export function reorderLayer(blocks, ids, where) {
  const moving = blocks.filter((b) => ids.has(b.id)).sort((a, b) => a.z - b.z)
  const rest = blocks.filter((b) => !ids.has(b.id)).sort((a, b) => a.z - b.z)
  const ordered = where === 'front' ? [...rest, ...moving] : [...moving, ...rest]
  const z = new Map(ordered.map((b, i) => [b.id, i]))
  return blocks.map((b) => ({ ...b, z: z.get(b.id) }))
}

/* ----------------------------------------------------------- serialization */

export const SCHEMA_VERSION = 2

/** Full canvas state as a plain, JSON-safe object. */
export function serialize(blocks, viewport) {
  return {
    schema: 'arduinium.block-canvas',
    version: SCHEMA_VERSION,
    grid: { cols: GRID.cols, rows: GRID.rows, cell: GRID.cell },
    viewport: { x: viewport.x, y: viewport.y, scale: viewport.scale },
    blocks: blocks.map((b) => ({
      id: b.id,
      kind: b.kind,
      label: b.label,
      x: b.x,
      y: b.y,
      w: b.w,
      h: b.h,
      rotation: b.rotation,
      color: b.color,
      z: b.z,
      locked: b.locked,
      hidden: b.hidden,
      props: { ...b.props },
    })),
  }
}

/**
 * Rebuild state from imported JSON.
 *
 * Import is the one place untrusted data enters the editor, so every field is
 * coerced and range-checked rather than trusted. A malformed block is dropped
 * with a reason instead of poisoning the canvas; the caller reports the count.
 * Throws only when the payload is not recognisably a canvas at all.
 */
export function deserialize(data) {
  if (!data || typeof data !== 'object') throw new Error('Not an object')
  if (!Array.isArray(data.blocks)) throw new Error('Missing "blocks" array')

  const seen = new Set()
  const skipped = []
  const blocks = []

  for (const raw of data.blocks) {
    if (!raw || typeof raw !== 'object') {
      skipped.push('not an object')
      continue
    }
    const w = clampInt(raw.w, 1, GRID.cols, 1)
    const h = clampInt(raw.h, 1, GRID.rows, 1)
    const rotation = [0, 90, 180, 270].includes(Number(raw.rotation)) ? Number(raw.rotation) : 0
    const block = createBlock({
      id: typeof raw.id === 'string' && raw.id && !seen.has(raw.id) ? raw.id : nextId(),
      kind: typeof raw.kind === 'string' ? raw.kind : 'tile',
      label: typeof raw.label === 'string' ? raw.label.slice(0, 64) : '',
      w,
      h,
      rotation,
      color: /^#[0-9a-f]{6}$/i.test(raw.color) ? raw.color : '#2f6fd9',
      z: clampInt(raw.z, 0, 100000, 0),
      locked: Boolean(raw.locked),
      hidden: Boolean(raw.hidden),
      props: raw.props && typeof raw.props === 'object' && !Array.isArray(raw.props)
        ? Object.fromEntries(
            Object.entries(raw.props)
              .slice(0, 24)
              .map(([k, v]) => [String(k).slice(0, 32), String(v).slice(0, 128)]),
          )
        : {},
    })
    // Position is clamped against the *rotated* footprint, which is what
    // actually has to fit.
    const f = footprint(block)
    block.x = clampInt(raw.x, 0, GRID.cols - f.w, 0)
    block.y = clampInt(raw.y, 0, GRID.rows - f.h, 0)

    // The rest of the editor assumes no two blocks overlap — placement search,
    // drag validation and the collision preview all rely on it. Export never
    // emits an overlapping board, but hand-edited or third-party JSON can, so
    // a block landing on top of one already accepted is dropped rather than
    // quietly breaking that invariant.
    if (!isPlacementValid(rectOf(block), blocks)) {
      skipped.push(`overlapping block at ${block.x},${block.y}`)
      continue
    }

    seen.add(block.id)
    blocks.push(block)
  }

  seedIds(blocks)

  const vp = data.viewport && typeof data.viewport === 'object' ? data.viewport : {}
  const viewport = {
    x: Number.isFinite(Number(vp.x)) ? Number(vp.x) : 0,
    y: Number.isFinite(Number(vp.y)) ? Number(vp.y) : 0,
    scale: Math.min(ZOOM.max, Math.max(ZOOM.min, Number(vp.scale) || 1)),
  }

  return { blocks: normalizeZ(blocks), viewport, skipped }
}

function clampInt(v, lo, hi, fallback) {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return fallback
  return Math.min(hi, Math.max(lo, n))
}
