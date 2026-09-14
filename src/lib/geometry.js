import {
  BOARD,
  BREADBOARD,
  BOARD_HOLES,
  CASTER,
  LBRACKET,
  MECCANO,
  MOUNT,
  PITCH,
  STANDOFF,
  STRIP_T,
  STRIP_W,
  UPRIGHT,
  WHEEL,
  SOCKETS,
  SOCKET_Z,
  BOARD_SURFACE,
  stripHoles,
} from './config.js'
import {
  CATEGORY,
  CHAIN_OFFSET,
  deckHoles,
  deckSize,
  gearHoles,
  gripperJawHoles,
  gripperPalmHoles,
  isFlat,
  isMount,
  isSocket,
  lbracketHoles,
  mountHoleAxis,
  mountHoles,
  plate3x5Holes,
  spec,
  turntableHoles,
} from './parts.js'
import { COMPONENT_SPECS, isKitComponent, isLed } from './electronics.js'
import { breadboardHole } from './breadboard.js'
import {
  ID,
  YAW180,
  apply,
  basisX,
  basisY,
  compose,
  fromRotY,
  isOrient,
  quatOf,
  turnLocal,
  stepLocal,
  yawOf,
} from './orient.js'

/**
 * Positions, attachment nodes and the snap matrix.
 *
 * Two kinds of part:
 *
 *   FLAT   lies on the build plane, stores its own position and yaw, and can
 *          land on any CHASSIS_HOLE — including one raised on a standoff or an
 *          L-bracket, which is what makes multi-level frames possible.
 *   MOUNT  owns no transform at all. It derives everything from whatever it is
 *          attached to, walking up the chain
 *          strip -> motor mount -> motor -> wheel.
 *          A wheel therefore *cannot* be in the wrong place: its position is a
 *          consequence of the shaft it is on.
 */

// `isElectronic` is retained as the legacy name for socket-seated parts.
// Current electronics are all real chassis mounts and must follow the same
// snap/mount chain as every other fitting.
export const ELECTRONIC_KINDS = []
export const isStrip = (kind) => kind.startsWith('strip')
export const isElectronic = (kind) => isSocket(kind)

export function holeCount(kind) {
  if (kind === 'board') return BOARD_HOLES.length
  if (isStrip(kind)) return Number(kind.slice(5))
  if (kind === 'deck') return deckHoles().length
  if (kind === 'plate3x5') return plate3x5Holes().length
  if (kind === 'turntableBase' || kind === 'turntableTop') return turntableHoles().length
  if (kind === 'gearSmall' || kind === 'gearLarge') return gearHoles(kind).length
  if (kind === 'gripperPalm') return gripperPalmHoles().length
  if (kind === 'gripperJawL' || kind === 'gripperJawR') return gripperJawHoles().length
  if (kind === 'lbracket') return lbracketHoles().length
  return 0
}

export function halfThickness(kind) {
  if (kind === 'board') return BOARD.thickness / 2
  if (kind === 'breadboard') return BREADBOARD.height / 2
  if (kind === 'turntableBase' || kind === 'turntableTop') return MECCANO.turntableThickness / 2
  if (kind === 'gearSmall' || kind === 'gearLarge') return MECCANO.gearThickness / 2
  return STRIP_T / 2
}

/** Hole centre in the part's own local space. */
export function localHole(kind, index) {
  if (kind === 'board') {
    const h = BOARD_HOLES[index]
    return h ? [h.x, 0, h.z] : [0, 0, 0]
  }
  if (isStrip(kind)) {
    const xs = stripHoles(holeCount(kind))
    return [xs[index] ?? 0, 0, 0]
  }
  if (kind === 'deck') return deckHoles()[index] ?? [0, 0, 0]
  if (kind === 'plate3x5') return plate3x5Holes()[index] ?? [0, 0, 0]
  if (kind === 'turntableBase' || kind === 'turntableTop') return turntableHoles()[index] ?? [0, 0, 0]
  if (kind === 'gearSmall' || kind === 'gearLarge') return gearHoles(kind)[index] ?? [0, 0, 0]
  if (kind === 'gripperPalm') return gripperPalmHoles()[index] ?? [0, 0, 0]
  if (kind === 'gripperJawL' || kind === 'gripperJawR') return gripperJawHoles()[index] ?? [0, 0, 0]
  if (kind === 'lbracket') return lbracketHoles()[index] ?? [0, 0, 0]
  return [0, 0, 0]
}

/** Rotate a local X/Z offset by a yaw. */
export function yaw([x, z], rotY) {
  const c = Math.cos(rotY)
  const s = Math.sin(rotY)
  return [x * c + z * s, -x * s + z * c]
}

/**
 * A part's orientation as a group index, whatever shape the part is in.
 *
 * New parts carry `rot` (an index into the 24-element orientation group);
 * legacy parts and v2 save files carry a `rotY` scalar. Every reader goes
 * through here, so both shapes keep working and the migration has exactly one
 * definition.
 */
export const orientOf = (part) => (isOrient(part?.rot) ? part.rot : fromRotY(part?.rotY ?? 0))

export function worldHole(part, index) {
  const local = localHole(part.kind, index)
  const d = apply(orientOf(part), local)
  // A tilted part's holes leave its own y-plane — d[1] is no longer zero.
  return [part.pos[0] + d[0], part.y + d[1], part.pos[2] + d[2]]
}

/** Validate the catalogue edge and hole index before following a mount chain. */
export function validMountHost(part, host) {
  if (!host || !isMount(part.kind) || !Number.isInteger(part.hostHole) || part.hostHole < 0) return false
  const category = spec(part.kind).mountTo
  if (!spec(part.kind).accepts?.includes(category) || !spec(host.kind).offers?.includes(category)) return false
  const count = category === CATEGORY.HOLE
    ? (isFlat(host.kind) ? holeCount(host.kind) : mountHoles(host.kind).length)
    : category === CATEGORY.SEAT || category === CATEGORY.SHAFT || category === CATEGORY.SERVO_SHAFT ? 1 : 0
  return part.hostHole < count
}

/* ======================================================== the mount chain */

/**
 * Where a mounted part ends up, derived by walking up to whatever flat part
 * ultimately carries it. Returns null if the chain is broken.
 */
export function chainTransform(part, parts, seen = new Set()) {
  if (!part || !isMount(part.kind) || seen.has(part.id) || seen.size >= 256) return null
  seen.add(part.id)
  const host = parts && Object.hasOwn(parts, part.hostId) ? parts[part.hostId] : null
  if (!host || !validMountHost(part, host)) return null

  if (isFlat(host.kind)) {
    // Root of a chain: a fitting bolted into a hole on a flat part.
    const n = holeCount(host.kind)
    const [lx, , lz] = localHole(host.kind, part.hostHole)
    // Which way does the fitting face? Away from the middle of the host, so
    // a motor mount on the end of a cross-member points outboard.
    const sign = lx < 0 ? -1 : lx > 0 ? 1 : n > 1 && part.hostHole < (n - 1) / 2 ? -1 : 1

    /*
     * The fitting's full orientation: the host's, half-turned when it faces
     * the other way, then spun about the bolt axis if the student aimed it
     * (`spin` is quarter turns about local Y — the axis of the bolt through a
     * chassis hole). On a tilted host all of this happens in the host's own
     * frame, which is what makes a motor bolted to a vertical plate point
     * sideways instead of guessing at world axes.
     */
    const hostO = orientOf(host)
    let orient = sign < 0 ? compose(hostO, YAW180) : hostO
    if (part.spin) orient = turnLocal(orient, 'y', part.spin)

    const axis = basisX(orient) // the chain axis, now genuinely 3D
    const up = basisY(hostO) // the host's plate normal — "rise" happens along it
    const reach = CHAIN_OFFSET[part.kind] ?? 0
    const rise = fittingRise(part.kind, host.kind)
    const hole = apply(hostO, [lx, 0, lz])
    return {
      pos: [
        host.pos[0] + hole[0] + axis[0] * reach + up[0] * rise,
        host.y + hole[1] + axis[1] * reach + up[1] * rise,
        host.pos[2] + hole[2] + axis[2] * reach + up[2] * rise,
      ],
      rotY: yawOf(orient),
      axis,
      sign,
      root: host.id,
      orient,
      up,
    }
  }

  const base = chainTransform(host, parts, seen)
  if (!base) return null

  /*
   * A host that raises holes of its own — a standoff, an L-bracket, an upright
   * post — puts its child AT the chosen hole, not further along the chain axis.
   *
   * Stepping along the axis is right for the drivetrain, where each link
   * continues the same shaft, and wrong for anything that gains height: every
   * level of an upright would land its child in the same place, because the
   * axis step knows nothing about which hole was picked. It also silently
   * cancelled a standoff's whole point — the rise subtraction below put a
   * sensor bolted to a standoff at exactly the height it would have had bolted
   * straight to the strip.
   */
  const raised = mountHoles(host.kind)
  if (raised.length) {
    const local = raised[part.hostHole]
    const pos = mountLocalToWorld(base, local)
    const localAxis = mountHoleAxis(host.kind, part.hostHole)
    // Mounted parts define their bolt axis as local +Y. Side-drilled holes
    // therefore rotate that frame by a quarter turn around local X.
    let orient = localAxis[2] ? stepLocal(base.orient, 'x', 1) : base.orient
    if (part.spin) orient = turnLocal(orient, 'y', part.spin)
    const up = basisY(orient)
    const rise = fittingRise(part.kind, host.kind)
    return {
      pos: [pos[0] + up[0] * rise, pos[1] + up[1] * rise, pos[2] + up[2] * rise],
      rotY: yawOf(orient),
      axis: basisX(orient),
      sign: base.sign,
      root: base.root,
      orient,
      up,
    }
  }

  // Further along a chain: inherit the frame and step along its axis. The
  // rise difference runs along the chain's own up, not world Y — on a tilted
  // chain "above the surface" is wherever that surface's normal points.
  const reach = CHAIN_OFFSET[part.kind] ?? 0
  const up = basisY(base.orient)
  const riseDelta = fittingRise(part.kind) - fittingRise(host.kind)
  return {
    pos: [
      base.pos[0] + base.axis[0] * reach + up[0] * riseDelta,
      base.pos[1] + base.axis[1] * reach + up[1] * riseDelta,
      base.pos[2] + base.axis[2] * reach + up[2] * riseDelta,
    ],
    rotY: base.rotY,
    axis: base.axis,
    sign: base.sign,
    root: base.root,
    orient: base.orient,
    up,
  }
}

/**
 * A point in a mounted fitting's own frame, resolved to world space.
 *
 * The fitting's whole basis comes from its chain orientation, so this is one
 * matrix product. (It used to be hand-rolled from the axis and its horizontal
 * perpendicular plus world Y — correct only while every host lay flat.)
 */
function mountLocalToWorld(t, local) {
  const d = apply(t.orient ?? ID, local)
  return [t.pos[0] + d[0], t.pos[1] + d[1], t.pos[2] + d[2]]
}

/**
 * Vertical lift of a fitting relative to the surface it bolts to, so nothing
 * ever clips into a strip or the floor. This is the bounding-box padding rule
 * from the spec, expressed once per part rather than measured every frame.
 */
function fittingRise(kind, hostKind = 'strip5') {
  if (spec(kind).form === 'sensorModule') return halfThickness(hostKind) + 0.08
  if (spec(kind).form === 'kitComponent') return halfThickness(hostKind) + (COMPONENT_SPECS[kind]?.size?.[1] ?? 0.2) / 2
  switch (kind) {
    // The whole drivetrain shares the chassis plane: the motor axis, and so the
    // wheel centre, is level with the strip it is bolted to. That is what makes
    // the geometry honest — the wheels then stick out *below* the frame, and
    // the build as a whole is floated up onto them (see `buildLift`) instead of
    // each part guessing at a height and disagreeing with its neighbours.
    case 'motormount':
    case 'motor':
    case 'wheel':
    case 'caster':
      return 0
    case 'standoff':
      return STANDOFF.height / 2 + STRIP_T / 2
    case 'sensor':
      // Sits proud of the strip it bolts to, so its four pins clear the frame
      // and the leads have somewhere to go.
      return 0.3 + STRIP_T / 2
    default:
      if (isLed(kind)) return halfThickness(hostKind) + 0.02
      return 0
    case 'lbracket':
      return STRIP_T / 2
    case 'upright':
      // Stands ON the strip, so its centre is half a post above the surface.
      return UPRIGHT.height / 2 + STRIP_T / 2
  }
}

/** How far a part's lowest point sits below its own origin. */
export function partHalfHeight(kind) {
  if (spec(kind).form === 'sensorModule') return 0.06
  if (isKitComponent(kind)) return (COMPONENT_SPECS[kind]?.size?.[1] ?? 0.2) / 2
  switch (kind) {
    case 'wheel':
      return WHEEL.radius
    case 'caster':
      return CASTER.stem + CASTER.ball
    case 'motor':
      return MOUNT.motorRadius
    case 'motormount':
      return MOUNT.bracketHeight / 2
    case 'standoff':
      return STANDOFF.height / 2
    case 'upright':
      return UPRIGHT.height / 2
    case 'sensor':
      return 0.3
    default:
      if (isLed(kind)) return 0
      return halfThickness(kind)
    case 'lbracket':
      // The foot slab is centred on the origin, so the lowest point is half
      // its thickness down. Falling through to halfThickness() read the strip
      // constant instead — close, but the bracket is a touch thicker.
      return LBRACKET.thickness / 2
  }
}

/**
 * Resolved world transform for anything: flat, mounted or plugged in.
 * Returns null when the part has no place of its own to be — an LED whose
 * board has been deleted, or a fitting whose chain is broken.
 */
export function partTransform(part, parts) {
  if (!part) return null
  if (part.breadboardId) return footprintTransform(part, parts)
  if (isMount(part.kind)) return chainTransform(part, parts)
  if (isSocket(part.kind)) {
    const board = Object.values(parts ?? {}).find((p) => p.kind === 'board')
    const t = board && part.socket ? socketTransform(board, part.socket) : null
    return t ? { pos: t.pos, rotY: t.rotY, axis: basisX(t.orient), sign: 1, orient: t.orient } : null
  }
  if (!part.pos) return null
  const orient = orientOf(part)
  // The old fields (pos/rotY/axis/sign) survive for every existing consumer,
  // including the test harnesses; `orient` is the full answer.
  return {
    pos: [part.pos[0], part.y, part.pos[2]],
    rotY: yawOf(orient),
    axis: basisX(orient),
    sign: 1,
    orient,
  }
}

/** Transform of a component whose leads occupy physical breadboard holes. */
export function footprintTransform(part, parts) {
  const board = parts?.[part?.breadboardId]
  const holes = Object.values(part?.holes ?? {}).map(breadboardHole).filter(Boolean)
  if (board?.kind !== 'breadboard' || holes.length === 0) return null
  const boardT = partTransform(board, parts)
  if (!boardT) return null
  const centre = holes.reduce((sum, hole) => sum.map((value, i) => value + hole.local[i]), [0, 0, 0])
    .map((value) => value / holes.length)
  const d = apply(boardT.orient ?? ID, centre)
  return {
    pos: [boardT.pos[0] + d[0], boardT.pos[1] + d[1], boardT.pos[2] + d[2]],
    rotY: boardT.rotY,
    axis: basisX(boardT.orient ?? ID),
    sign: 1,
    root: board.id,
    orient: boardT.orient ?? ID,
    up: basisY(boardT.orient ?? ID),
  }
}

/** The quaternion a renderer needs for a resolved transform. */
export const quatFor = (t) => quatOf(t?.orient ?? ID)

/* ============================================================ snap nodes */

/**
 * Every attachment point a placed part offers, in world space.
 * This is the right-hand side of the snap matrix.
 */
export function worldNodes(part, parts) {
  const s = spec(part.kind)
  const offers = s.offers ?? []
  const out = []

  if (offers.includes(CATEGORY.HOLE)) {
    if (isFlat(part.kind)) {
      // A hole's axis is its plate's normal — exact integers, so the snapper
      // can ask "are these aligned?" without an epsilon.
      const axis = basisY(orientOf(part))
      for (let i = 0; i < holeCount(part.kind); i++) {
        out.push({
          partId: part.id,
          index: i,
          category: CATEGORY.HOLE,
          pos: worldHole(part, i),
          axis,
        })
      }
    } else {
      // A fitting that raises holes above itself: the top of a standoff, the
      // top of an L-bracket's upright arm, every level of an upright post.
      const t = chainTransform(part, parts)
      if (t) {
        mountHoles(part.kind).forEach((local, i) => {
          out.push({
            partId: part.id,
            index: i,
            category: CATEGORY.HOLE,
            pos: mountLocalToWorld(t, local),
            axis: apply(t.orient, mountHoleAxis(part.kind, i)),
          })
        })
      }
    }
  }

  if (offers.includes(CATEGORY.SEAT)) {
    const t = chainTransform(part, parts)
    if (t) {
      out.push({
        partId: part.id,
        index: 0,
        category: CATEGORY.SEAT,
        pos: [...t.pos],
        axis: t.axis,
      })
    }
  }

  if (offers.includes(CATEGORY.SHAFT)) {
    const t = chainTransform(part, parts)
    if (t) {
      const reach = MOUNT.motorLength / 2 + MOUNT.shaftLength
      out.push({
        partId: part.id,
        index: 0,
        category: CATEGORY.SHAFT,
        pos: [t.pos[0] + t.axis[0] * reach, t.pos[1] + t.axis[1] * reach, t.pos[2] + t.axis[2] * reach],
        axis: t.axis,
      })
    }
  }

  if (offers.includes(CATEGORY.SERVO_SHAFT)) {
    const t = chainTransform(part, parts)
    const local = mountHoles(part.kind)[0]
    if (t && local) {
      out.push({
        partId: part.id,
        index: 0,
        category: CATEGORY.SERVO_SHAFT,
        pos: mountLocalToWorld(t, local),
        axis: apply(t.orient, mountHoleAxis(part.kind, 0)),
      })
    }
  }

  return out
}

/** Every node in the build that a given kind is allowed to snap to. */
export function candidateNodes(kind, parts, isTaken) {
  const wanted = new Set(spec(kind).accepts ?? [])
  const out = []
  for (const part of Object.values(parts)) {
    for (const node of worldNodes(part, parts)) {
      if (!wanted.has(node.category)) continue
      if (isTaken?.(node.partId, node.index, node.category)) continue
      out.push(node)
    }
  }
  return out
}

/* ========================================================== board sockets */

export function socketTransform(board, socketId) {
  const socket = SOCKETS.find((s) => s.id === socketId)
  if (!socket || !board) return null
  const orient = orientOf(board)
  const d = apply(orient, [socket.x, BOARD_SURFACE, SOCKET_Z])
  return {
    pos: [board.pos[0] + d[0], board.y + d[1], board.pos[2] + d[2]],
    rotY: yawOf(orient),
    pin: socket.pin,
    orient,
  }
}

/* ===================================================== oriented bounding box */

/**
 * Each kind's box in its own canonical frame. The bottom face is pinned to
 * -partHalfHeight(kind) by construction, so for a yaw-only part everything
 * downstream behaves exactly as it always did; the other extents matter the
 * moment a part is tilted and its "height" becomes its length.
 */
function localBBox(kind) {
  if (spec(kind).form === 'sensorModule') {
    return { min: [-0.3, -0.06, -0.2], max: [0.3, 0.06, 0.2] }
  }
  if (isKitComponent(kind)) {
    const [w, h, d] = COMPONENT_SPECS[kind]?.size ?? [0.5, 0.2, 0.4]
    return { min: [-w / 2, -h / 2, -d / 2], max: [w / 2, h / 2, d / 2] }
  }
  const bottom = -partHalfHeight(kind)
  if (kind === 'board') {
    return { min: [-BOARD.width / 2, bottom, -BOARD.depth / 2], max: [BOARD.width / 2, BOARD.thickness / 2, BOARD.depth / 2] }
  }
  if (kind === 'breadboard') {
    return { min: [-BREADBOARD.width / 2, bottom, -BREADBOARD.depth / 2], max: [BREADBOARD.width / 2, BREADBOARD.height / 2, BREADBOARD.depth / 2] }
  }
  if (kind === 'deck') {
    const [w, d] = deckSize()
    return { min: [-w / 2, bottom, -d / 2], max: [w / 2, STRIP_T / 2, d / 2] }
  }
  if (kind === 'plate3x5') {
    const w = (MECCANO.plateCols - 1) * PITCH + STRIP_W
    const d = (MECCANO.plateRows - 1) * PITCH + STRIP_W
    return { min: [-w / 2, bottom, -d / 2], max: [w / 2, STRIP_T / 2, d / 2] }
  }
  if (kind === 'turntableBase' || kind === 'turntableTop') {
    const r = kind === 'turntableBase' ? MECCANO.turntableBaseRadius : MECCANO.turntableTopRadius
    return { min: [-r, bottom, -r], max: [r, MECCANO.turntableThickness / 2, r] }
  }
  if (kind === 'gearSmall' || kind === 'gearLarge') {
    const r = kind === 'gearLarge' ? MECCANO.gearLargeRadius : MECCANO.gearSmallRadius
    return { min: [-r, bottom, -r], max: [r, MECCANO.gearThickness / 2, r] }
  }
  if (kind === 'gripperPalm') {
    const [w, d] = MECCANO.gripperPalm
    return { min: [-w / 2, bottom, -d / 2], max: [w / 2, STRIP_T / 2, d / 2] }
  }
  if (kind === 'gripperJawL' || kind === 'gripperJawR') {
    return { min: [-MECCANO.gripperJawLength / 2, bottom, -MECCANO.gripperJawWidth / 2], max: [MECCANO.gripperJawLength / 2, STRIP_T / 2, MECCANO.gripperJawWidth / 2] }
  }
  if (isStrip(kind)) {
    const len = (holeCount(kind) - 1) * PITCH + STRIP_W
    return { min: [-len / 2, bottom, -STRIP_W / 2], max: [len / 2, STRIP_T / 2, STRIP_W / 2] }
  }
  switch (kind) {
    case 'wheel':
      return { min: [-WHEEL.width / 2, bottom, -WHEEL.radius], max: [WHEEL.width / 2, WHEEL.radius, WHEEL.radius] }
    case 'caster':
      return { min: [-CASTER.ball, bottom, -CASTER.ball], max: [CASTER.ball, 0.06, CASTER.ball] }
    case 'motor': {
      const half = MOUNT.motorLength / 2 + MOUNT.shaftLength
      return { min: [-half, bottom, -MOUNT.motorRadius], max: [half, MOUNT.motorRadius, MOUNT.motorRadius] }
    }
    case 'motormount':
      return { min: [-MOUNT.bracketDepth / 2, bottom, -MOUNT.bracketWidth / 2], max: [MOUNT.bracketDepth / 2, MOUNT.bracketHeight / 2, MOUNT.bracketWidth / 2] }
    case 'standoff':
      return { min: [-STANDOFF.radius, bottom, -STANDOFF.radius], max: [STANDOFF.radius, STANDOFF.height / 2, STANDOFF.radius] }
    case 'upright': {
      const foot = UPRIGHT.post * 0.8
      return { min: [-foot, bottom, -foot], max: [foot, UPRIGHT.height / 2, foot] }
    }
    case 'lbracket':
      return { min: [-LBRACKET.arm / 2, bottom, -LBRACKET.width / 2], max: [LBRACKET.arm / 2, LBRACKET.arm, LBRACKET.width / 2] }
    case 'sensor':
      return { min: [-0.36, bottom, -0.1], max: [0.36, 0.36, 0.22] }
    case 'servoHorn':
      return { min: [-0.62, -0.04, -0.12], max: [0.62, 0.04, 0.12] }
    default:
      if (isLed(kind)) return { min: [-0.19, 0, -0.19], max: [0.19, 0.67, 0.19] }
      return { min: [-STRIP_W / 2, bottom, -STRIP_W / 2], max: [STRIP_W / 2, STRIP_T / 2, STRIP_W / 2] }
  }
}

/**
 * How far below a part's origin its lowest point sits, GIVEN its orientation.
 * A strip stood on end is as "tall" as it is long — reading the canonical
 * partHalfHeight for it would sink the whole build into the floor.
 */
export function orientedBottom(kind, orient = ID) {
  const { min, max } = localBBox(kind)
  let lowest = Infinity
  for (const x of [min[0], max[0]]) {
    for (const y of [min[1], max[1]]) {
      for (const z of [min[2], max[2]]) {
        const w = apply(orient, [x, y, z])
        if (w[1] < lowest) lowest = w[1]
      }
    }
  }
  return lowest
}

/** Lowest point of a part, used to lift a build clear of the ground on Run. */
export function partBottom(part, parts) {
  const t = partTransform(part, parts)
  if (!t) return Infinity
  return t.pos[1] + orientedBottom(part.kind, t.orient ?? ID)
}

export const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2])
export const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

export { deckSize, isFlat, isMount, spec, CATEGORY }

/** A real hole endpoint plus the flat body that carries it in the physics plan. */
export function boltEndpoint(parts, partId, index) {
  const part = parts?.[partId]
  if (!part || !Number.isInteger(index) || index < 0) return null
  if (isFlat(part.kind)) {
    if (index >= holeCount(part.kind)) return null
    return { partId, index, pos: worldHole(part, index), axis: basisY(orientOf(part)),
      rootId: partId, thickness: halfThickness(part.kind) }
  }
  if (!isMount(part.kind) || index >= mountHoles(part.kind).length) return null
  const t = chainTransform(part, parts)
  if (!t) return null
  return { partId, index, pos: mountLocalToWorld(t, mountHoles(part.kind)[index]),
    axis: apply(t.orient, mountHoleAxis(part.kind, index)), rootId: t.root, thickness: 0 }
}

export function boltEndpoints(parts, bolt) {
  if (!bolt || bolt.aId === bolt.bId) return null
  const a = boltEndpoint(parts, bolt.aId, bolt.aHole)
  const b = boltEndpoint(parts, bolt.bId, bolt.bHole)
  if (!a || !b || a.rootId === b.rootId) return null
  return { a, b }
}

/** Quarter-turn slabs are axis-aligned in world space. Touching faces are allowed. */
export function flatsOverlap(a, b) {
  if (!isFlat(a.kind) || !isFlat(b.kind)) return false
  const bounds = (p) => {
    const box = localBBox(p.kind)
    const lo = apply(orientOf(p), box.min)
    const hi = apply(orientOf(p), box.max)
    const origin = [p.pos[0], p.y, p.pos[2]]
    return origin.map((v, i) => [v + Math.min(lo[i], hi[i]), v + Math.max(lo[i], hi[i])])
  }
  const aa = bounds(a), bb = bounds(b)
  return aa.every(([lo, hi], i) => Math.min(hi, bb[i][1]) - Math.max(lo, bb[i][0]) > 1e-6)
}
