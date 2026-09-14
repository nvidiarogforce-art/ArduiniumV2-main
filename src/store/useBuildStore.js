import { create } from 'zustand'
import { PHYSICS, PITCH, SOCKETS, SNAP_RADIUS } from '../lib/config.js'
import {
  boltEndpoints,
  candidateNodes,
  dist3,
  flatsOverlap,
  chainTransform,
  distXZ,
  halfThickness,
  holeCount,
  isElectronic,
  isFlat,
  isMount,
  localHole,
  orientOf,
  orientedBottom,
  partBottom,
  partTransform,
  socketTransform,
  worldHole,
} from '../lib/geometry.js'
import { ID, apply, basisY, fromRotY, isOrient, stepWorld, yawOf } from '../lib/orient.js'
import { CATEGORY, PART_SPECS, spec } from '../lib/parts.js'
import { BLOCK_TYPES, COMPARE_OPS, DIRECTIONS, MATH_OPS, countBlocks, makeBlock, safeVarName } from '../lib/program.js'
import { useUiStore } from './useUiStore.js'
import { partName } from '../i18n/index.js'
import { getMission } from '../lib/missions.js'
import { canConnect, refusalReason, terminalOf, wireColour } from '../lib/terminals.js'
import { devicePinClaims, motorConnection } from '../lib/circuits.js'
import { isSensor, sensorConnection } from '../lib/sensors.js'
import { BREADBOARD_FOOTPRINTS, breadboardHoles, canInsertOnBreadboard, footprintAt } from '../lib/breadboard.js'
import { solveCircuit, wireCreatesShort } from '../lib/electricalSolver.js'

let idSeq = 0
let wireSeq = 0
let lastProgramSnapAt = 0
let lastNudge = { id: null, at: 0 }
const nextId = (kind) =>
  `${kind}-${(++idSeq).toString(36)}${Math.floor(Math.abs(Math.sin(idSeq) * 1e6)).toString(36)}`

const DEFAULT_PROGRAM = [{ id: 'seed-1', type: 'drive', dir: 'forward', speed: 200, ms: 2000 }]
const emptyBuild = () => ({ parts: {}, order: [], bolts: [], wires: [] })
const SPAWN = [0, 0, 4.2]

export const useBuildStore = create((set, get) => ({
  ...emptyBuild(),

  selected: null,
  pending: null,
  snapEnabled: true,
  toggleSnap: () => set((s) => {
    const snapEnabled = !s.snapEnabled
    return { snapEnabled, pending: s.pending && !isElectronic(s.pending.kind) && s.pending.placement !== 'breadboard'
      ? resolveSnap({ ...s, snapEnabled }, s.pending) : s.pending }
  }),
  /**
   * The lead currently being dragged, or null.
   *
   * Deliberately NOT part of the undo frame: a half-drawn wire is a gesture,
   * not a state of the build, and undoing into one would leave the cursor
   * holding something the user never committed.
   */
  wiring: null,
  running: false,
  serial: [],
  program: DEFAULT_PROGRAM,
  /**
   * Undo and redo stacks.
   *
   * This used to be a single `past` slot, which meant the second edit in a row
   * silently threw away the first, and there was no redo at all. Both are now
   * bounded stacks of plain snapshots — the state here is a few hundred small
   * objects, so a snapshot is cheaper to take than an inverse operation is to
   * write, and every mutation that calls snapshot() becomes undoable for free.
   */
  past: [],
  future: [],
  buildName: 'My build',

  // =====================================================  derived conveniences
  pinMap: () => {
    const { parts, wires } = get()
    const map = devicePinClaims(parts, wires)
    for (const p of Object.values(parts)) {
      if (isElectronic(p.kind) && p.socket) {
        const socket = SOCKETS.find((s) => s.id === p.socket)
        if (socket) map[socket.pin] = { id: p.id, kind: p.kind }
      }
      if (!isSensor(p.kind)) continue
      const connection = sensorConnection(p, parts, wires)
      if (connection.ready && connection.pin != null) map[connection.pin] = { id: p.id, kind: p.kind }
    }
    return map
  },

  boardPart: () => Object.values(get().parts).find((p) => p.kind === 'board') ?? null,
  circuitReport: () => solveCircuit(get().parts, get().wires),

  /** Is this attachment node already in use? */
  isNodeTaken: (partId, index, category) => {
    const { bolts, parts } = get()
    if (category === CATEGORY.HOLE) {
      if (
        bolts.some(
          (b) =>
            (b.aId === partId && b.aHole === index) || (b.bId === partId && b.bHole === index),
        )
      )
        return true
    }
    return Object.values(parts).some(
      (p) => isMount(p.kind) && p.hostId === partId && p.hostHole === index,
    )
  },

  boltsBetween: (a, b) =>
    get().bolts.filter((x) => (x.aId === a && x.bId === b) || (x.aId === b && x.bId === a)).length,

  /** Anything mounted on this part, directly or further down the chain. */
  dependentsOf: (id) => {
    const { parts } = get()
    const out = []
    const walk = (hostId) => {
      for (const p of Object.values(parts)) {
        if ((isMount(p.kind) && p.hostId === hostId) || p.breadboardId === hostId) {
          out.push(p.id)
          walk(p.id)
        }
      }
    }
    walk(id)
    return out
  },

  // ================================================================  placing
  beginPlace: (kind, from = null) => {
    if (get().running || !Object.hasOwn(PART_SPECS, kind)) return
    if (get().pending) get().cancelPlace()
    const ui = useUiStore.getState()
    if (isElectronic(kind) && !get().boardPart()) return ui.say('boardFirst', {}, 'warn')
    const onBreadboard = canInsertOnBreadboard(kind) && Object.values(get().parts).some((p) => p.kind === 'breadboard')
    set({
      selected: null,
      pending: {
        kind,
        pos: [...SPAWN],
        cursor: [...SPAWN],
        spin: 0,
        rot: ID, // full orientation, an index into the 24-element group
        rotY: 0, // derived mirror of rot, kept for every scalar consumer
        y: halfThickness(kind),
        carryY: 0, // student-controlled carry height (Q/E), above resting
        snap: null,
        socket: null,
        from, // where to fly back to if the drag is cancelled
        placement: onBreadboard ? 'breadboard' : null,
        footprint: null,
      },
    })
    ui.teach('pickPart', { part: partName(kind) })
    ui.setDrawer('left', false) // hand the whole viewport over to the build
  },

  /** Escape or right-click: put it back exactly where it came from. */
  cancelPlace: () => {
    const { pending, past } = get()
    if (pending?.from && past.length) {
      // Restore the actual pre-pickup frame, including all removed leads.
      set({ ...past[past.length - 1], past: past.slice(0, -1) })
    }
    set({ pending: null })
  },

  /**
   * Turn the held part a quarter turn about a WORLD axis: 'y' is the familiar
   * yaw, 'x' and 'z' tip it over — a strip stood on its end, a plate turned
   * into a wall. The snap is re-resolved immediately so the rings and the
   * ghost react to the new orientation without waiting for a mouse move.
   */
  rotatePending: (dir = 1, axis = 'y') =>
    set((s) => {
      if (!s.pending || !['x', 'y', 'z'].includes(axis) || !Number.isFinite(dir)) return {}
      if (s.pending.placement === 'breadboard') return {}
      if (isMount(s.pending.kind)) {
        if (spec(s.pending.kind).mountTo !== CATEGORY.HOLE && !spec(s.pending.kind).clockable) return {}
        const spin = ((s.pending.spin ?? 0) + (dir >= 0 ? 1 : 3)) % 4
        return { pending: resolveSnap(s, { ...s.pending, spin }) }
      }
      const rot = stepWorld(s.pending.rot ?? ID, axis, dir)
      const next = { ...s.pending, rot, rotY: yawOf(rot) }
      if (isElectronic(next.kind)) return { pending: next }
      return { pending: resolveSnap(s, next) }
    }),

  /** Raise or lower the carried part in half-hole steps (Q/E). */
  liftPending: (dir = 1) =>
    set((s) => {
      if (!s.pending || isElectronic(s.pending.kind) || s.pending.placement === 'breadboard' || !Number.isFinite(dir)) return {}
      const carryY = Math.max(0, (s.pending.carryY ?? 0) + dir * (PITCH / 2))
      return { pending: resolveSnap(s, { ...s.pending, carryY,
        cursor: isMount(s.pending.kind) ? [(s.pending.cursor ?? s.pending.pos)[0], carryY, (s.pending.cursor ?? s.pending.pos)[2]] : s.pending.cursor }) }
    }),

  /**
   * `hint` names the node the pointer is actually nearest ON SCREEN, when the
   * caller has a camera to work that out with (Placement.jsx does; a test or a
   * template does not). It is how stacked holes are told apart — see
   * `resolveSnap`.
   */
  movePending: (point, hint = null) => {
    const s = get()
    if (!s.pending || !Array.isArray(point) || point.length !== 3 || !point.every(Number.isFinite)) return
    const kind = s.pending.kind
    if (s.pending.placement === 'breadboard') {
      set({ pending: resolveBreadboardPlacement(s, { ...s.pending, pos: point, cursor: [...point] }) })
      return
    }
    if (isElectronic(kind)) {
      set({ pending: { ...s.pending, pos: point, socket: nearestFreeSocket(s, point) } })
      return
    }
    set({ pending: resolveSnap(s, { ...s.pending, pos: [point[0], 0, point[2]], cursor: [...point], hint }) })
  },

  commitPlace: () => {
    const s = get()
    const p = s.pending
    if (!p || s.running) return
    const ui = useUiStore.getState()

    /**
     * Picking a part up and setting it down again is ONE undoable move.
     *
     * `pickUpPart` already snapshotted the build with the part at its old
     * position, so snapshotting again here would make the round trip cost two
     * history steps — and the first undo would land on the state where the
     * part had been lifted out but not yet put back, i.e. the part simply
     * vanishes with nothing in hand. Placing a genuinely new part still takes
     * its own snapshot, because nothing has been recorded for it yet.
     */
    const record = () => {
      if (!p.from) snapshot(set, get)
    }

    /**
     * Moving a part keeps its identity.
     *
     * A picked-up part is put back under the id it already had, rather than
     * being minted as a new one — otherwise "move" quietly destroys the part
     * and creates a stranger in its place, and anything that remembers a part
     * by id (a motor's pin assignment, a saved selection, a future wire
     * endpoint) would be pointing at something that no longer exists.
     */
    const idFor = () => p.from?.id ?? nextId(p.kind)

    // ---- component leads into individual breadboard contacts
    if (p.placement === 'breadboard') {
      if (!p.footprint || p.footprint.blocked) return ui.say('moveOverBreadboardHole', {}, 'warn')
      const id = idFor()
      const part = {
        id,
        kind: p.kind,
        breadboardId: p.footprint.breadboardId,
        holes: { ...p.footprint.holes },
      }
      record()
      set((st) => ({
        parts: { ...st.parts, [id]: part },
        order: [...st.order, id],
        pending: null,
        selected: id,
      }))
      ui.say('insertedBreadboard', { part: partName(p.kind) }, 'good')
      return
    }

    // ---- electronics into a board socket
    if (isElectronic(p.kind)) {
      if (!p.socket) return ui.say('moveOverSocket', {}, 'warn')
      const socket = SOCKETS.find((x) => x.id === p.socket)
      const id = idFor()
      record()
      set((st) => ({
        parts: { ...st.parts, [id]: { id, kind: p.kind, socket: p.socket } },
        order: [...st.order, id],
        pending: null,
        selected: id,
      }))
      ui.teach('plugged', { part: partName(p.kind), pin: socket.pin })
      ui.say('plugged', { part: partName(p.kind), pin: socket.pin }, 'good')
      return
    }

    // ---- fittings that mount onto a node
    if (isMount(p.kind)) {
      if (!p.snap || p.snap.blocked) return ui.say(mountHint(p.kind), {}, 'warn')
      const id = idFor()
      const part = { id, kind: p.kind, hostId: p.snap.hostId, hostHole: p.snap.index, spin: p.spin ?? 0 }
      record()
      set((st) => ({
        parts: { ...st.parts, [id]: part },
        order: [...st.order, id],
        pending: null,
        selected: id,
      }))
      ui.teach(mountLesson(p.kind), { pin: part.pin ?? null, part: partName(p.kind) })
      return
    }

    // ---- flat parts
    if (p.snap?.blocked) {
      ui.say('holeTaken', {}, 'warn')
      ui.teach('boltBlocked', {})
      return
    }

    const id = idFor()
    const rot = p.rot ?? ID
    const part = {
      id,
      kind: p.kind,
      pos: [...p.pos],
      y: p.y ?? halfThickness(p.kind),
      rot,
      rotY: yawOf(rot), // derived, kept in step for scalar consumers
    }
    if (Object.values(s.parts).some((other) => flatsOverlap(part, other))) {
      return ui.say('placementOverlap', {}, 'warn')
    }
    const newBolts = s.snapEnabled ? findBolts(s, part) : []

    record()
    set((st) => ({
      parts: { ...st.parts, [id]: part },
      order: [...st.order, id],
      bolts: [...st.bolts, ...newBolts],
      pending: null,
      selected: id,
    }))

    if (newBolts.length === 0) {
      ui.teach('placedFree', { part: partName(p.kind) })
    } else {
      const otherId = newBolts[0].bId === id ? newBolts[0].aId : newBolts[0].bId
      const other = s.parts[otherId]
      const total = get().boltsBetween(id, otherId)
      ui.teach(total >= 2 ? 'boltedRigid' : 'boltedHinge', {
        a: partName(p.kind),
        b: partName(other?.kind ?? 'strip5'),
      })
      ui.say(total >= 2 ? 'bolted' : 'boltedHinge', {}, 'good')
    }
  },

  /**
   * Pick a placed part back up. Its bolts and node occupancy are released and
   * it goes straight back into the cursor's hand, carrying enough state to be
   * put back untouched if the drag is cancelled.
   */
  pickUpPart: (id) => {
    const s = get()
    const part = s.parts[id]
    if (!part || s.running) return
    if (s.dependentsOf(id).length > 0) return useUiStore.getState().say('detachFirst', {}, 'warn')

    if (s.pending) get().cancelPlace()
    snapshot(set, get)
    const transform = partTransform(part, s.parts)
    const parts = { ...s.parts }
    delete parts[id]
    set({
      parts,
      order: s.order.filter((x) => x !== id),
      bolts: s.bolts.filter((b) => b.aId !== id && b.bId !== id),
      // Leads come off with the part, the same way its bolts do; putting it
      // back down re-finds bolts but does not re-run wires.
      wires: s.wires.filter((w) => w.a.partId !== id && w.b.partId !== id),
      selected: null,
      pending: {
        kind: part.kind,
        pos: part.pos ? [...part.pos] : transform?.pos ?? [...SPAWN],
        cursor: transform?.pos ?? [...SPAWN],
        spin: part.spin ?? 0,
        rot: orientOf(part),
        rotY: yawOf(orientOf(part)),
        y: part.y ?? halfThickness(part.kind),
        carryY: isFlat(part.kind) ? Math.max(0, part.y + orientedBottom(part.kind, orientOf(part))) : Math.max(0, transform?.pos[1] ?? 0),
        snap: null,
        socket: part.socket ?? null,
        from: part,
        placement: part.breadboardId ? 'breadboard' : null,
        footprint: part.breadboardId ? { breadboardId: part.breadboardId, holes: { ...part.holes }, blocked: false } : null,
      },
    })
    useUiStore.getState().teach('pickedUp', { part: partName(part.kind) })
    useUiStore.getState().setDrawer('left', false)
  },

  /** Carry a new copy of one slab; committing creates its one undo step. */
  duplicatePart: (id) => {
    const part = get().parts[id]
    if (!part || !isFlat(part.kind) || get().running) return
    get().beginPlace(part.kind)
    const rot = orientOf(part)
    set((s) => ({ pending: { ...s.pending, rot, rotY: yawOf(rot),
      pos: [...part.pos], cursor: [part.pos[0], part.y, part.pos[2]], y: part.y,
      carryY: Math.max(0, part.y + orientedBottom(part.kind, rot)), from: null } }))
  },

  /** Put a picked-up part back exactly as it was. */
  restorePart: (part) => {
    const s = get()
    if (!part || s.parts[part.id]) return
    const parts = { ...s.parts, [part.id]: part }
    const bolts = isFlat(part.kind)
      ? [...s.bolts, ...findBolts({ ...s, parts: s.parts }, part)]
      : s.bolts
    set({ parts, order: [...s.order, part.id], bolts })
  },

  // =================================================================  wiring
  /**
   * Start dragging a lead out of a terminal.
   *
   * Nothing is recorded in history yet — the wire only exists once both ends
   * are anchored, so an abandoned drag leaves no trace to undo.
   */
  beginWire: (partId, terminal) => {
    if (get().running) return
    const part = get().parts[partId]
    const point = part ? terminalOf(part, terminal) : null
    if (point?.capacity === 1 && wireUsesEndpoint(get().wires, partId, terminal)) {
      return useUiStore.getState().say('breadboardHoleBusy', {}, 'warn')
    }
    set({ wiring: { from: { partId, terminal }, cursor: null, target: null }, selected: null })
    useUiStore.getState().teach('wireStart', {})
  },

  /**
   * Follow the pointer, and remember which terminal it is hovering.
   *
   * The two arguments have separate owners and either may be omitted, which
   * matters more than it looks. The live wire updates `cursor` every frame,
   * while the pin dots update `target` on hover. When both wrote both fields,
   * the per-frame writer kept restoring the `target` its render closure had
   * captured — usually null — a frame after a dot had set it, so a drag could
   * never register that it was over a pin. Passing undefined now leaves a
   * field alone.
   */
  dragWire: (cursor, target) =>
    set((s) =>
      s.wiring
        ? {
            wiring: {
              ...s.wiring,
              cursor: cursor === undefined ? s.wiring.cursor : cursor,
              target: target === undefined ? s.wiring.target : target,
            },
          }
        : {},
    ),

  cancelWire: () => set({ wiring: null }),

  /**
   * Anchor the far end.
   *
   * Legality is decided in terminals.js, which also says why when it refuses —
   * shorting 5V to GND is the mistake worth catching, and catching it here is
   * cheaper than modelling the consequences.
   */
  commitWire: (partId, terminal) => {
    const s = get()
    if (!s.wiring) return
    const a = terminalRef(s.parts, s.wiring.from)
    const b = terminalRef(s.parts, { partId, terminal })
    const ui = useUiStore.getState()

    if (!canConnect(a, b)) {
      ui.say(refusalReason(a, b), {}, 'warn')
      set({ wiring: null })
      return
    }
    if ((a.capacity === 1 && wireUsesEndpoint(s.wires, a.partId, a.id)) ||
        (b.capacity === 1 && wireUsesEndpoint(s.wires, b.partId, b.id))) {
      ui.say('breadboardHoleBusy', {}, 'warn')
      set({ wiring: null })
      return
    }
    if (
      s.wires.some(
        (w) =>
          (w.a.partId === a.partId && w.a.terminal === a.id && w.b.partId === b.partId && w.b.terminal === b.id) ||
          (w.a.partId === b.partId && w.a.terminal === b.id && w.b.partId === a.partId && w.b.terminal === a.id),
      )
    ) {
      ui.say('wireDuplicate', {}, 'warn')
      set({ wiring: null })
      return
    }

    const wire = {
      id: `w-${++wireSeq}`,
      a: { partId: a.partId, terminal: a.id },
      b: { partId: b.partId, terminal: b.id },
      colour: wireColour(a, b),
    }
    if (wireCreatesShort(s.parts, s.wires, wire)) {
      ui.say('circuitShort', {}, 'warn')
      set({ wiring: null })
      return
    }
    snapshot(set, get)
    set({ wires: [...get().wires, wire], wiring: null })
    ui.teach('wired', { a: a.label, b: b.label })
    ui.say('wired', { a: a.label, b: b.label }, 'good')
  },

  deleteWire: (id) => {
    const s = get()
    if (!s.wires.some((w) => w.id === id)) return
    snapshot(set, get)
    set({ wires: s.wires.filter((w) => w.id !== id) })
    useUiStore.getState().teach('wireRemoved', {})
  },

  // ==============================================================  selection
  select: (id) => set({ selected: id }),

  /**
   * Turn a part that is already on the table, without picking it up.
   *
   * Rotation is an exact quarter turn around world X, Y or Z. `rot` indexes
   * the canonical 24-orientation group; `rotY` is only the compatibility
   * mirror retained for old saves and scalar consumers.
   *
   * Fittings mounted on this part need no attention: `chainTransform` derives
   * their placement from their host every frame, so they turn with it. Bolts
   * do not — they are stored pairs of hole indices, and the holes have just
   * moved. So the part's own bolts are dropped and re-found at the new angle,
   * which is what lets a rotated strip pick up a neighbour it now lines up
   * with, and drop one it no longer does.
   *
   * The drop and the re-find are two separate commits on purpose:
   * `findBolts` tests candidate holes through `isNodeTaken`, which reads live
   * store state, so the stale bolts have to be gone before it runs or every
   * hole still reads as occupied.
   */
  rotatePart: (id, dir = 1, axis = 'y') => {
    const s = get()
    const part = s.parts[id]
    if (!part || s.running || !Number.isFinite(dir) || !['x', 'y', 'z'].includes(axis)) return
    if (isElectronic(part.kind)) return
    if (isMount(part.kind)) {
      // Most fittings inherit their angle from whatever carries them — but a
      // hole-mounted one may SPIN about its own bolt, which is how a sensor
      // gets aimed. Seat- and shaft-keyed fittings (motor, wheel) cannot.
      if (spec(part.kind).mountTo === CATEGORY.HOLE || spec(part.kind).clockable) return get().spinPart(id, dir)
      return useUiStore.getState().say('rotateHostInstead', {}, 'warn')
    }

    snapshot(set, get)
    const rot = stepWorld(orientOf(part), axis, dir)
    const rotated = { ...part, rot, rotY: yawOf(rot) }
    const parts = { ...s.parts, [id]: rotated }
    const kept = s.bolts.filter((b) => b.aId !== id && b.bId !== id && boltFits(parts, b, 0.12, true))
    set({ parts, bolts: kept })

    if (isFlat(rotated.kind)) {
      set({ bolts: [...kept, ...findBolts(get(), rotated)] })
    }
    useUiStore.getState().teach('rotatedPart', {
      part: partName(part.kind),
      deg: Math.round((((rotated.rotY * 180) / Math.PI) % 360 + 360) % 360),
    })
  },

  /**
   * Quarter-turn a hole-mounted fitting about its own bolt axis. This is what
   * aims a sensor down the arena, or turns an L-bracket's arm to face the way
   * the build needs. The chain below the fitting turns with it — that is the
   * point, not a side effect.
   */
  spinPart: (id, dir = 1) => {
    const s = get()
    const part = s.parts[id]
    if (!part || s.running) return
    if (!isMount(part.kind) || (spec(part.kind).mountTo !== CATEGORY.HOLE && !spec(part.kind).clockable)) return
    snapshot(set, get)
    const spin = ((part.spin ?? 0) + (dir >= 0 ? 1 : 3)) % 4
    const parts = { ...s.parts, [id]: { ...part, spin } }
    set({ parts, bolts: s.bolts.filter((b) => boltFits(parts, b, 0.12, true)) })
    useUiStore.getState().teach('rotatedPart', {
      part: partName(part.kind),
      deg: spin * 90,
    })
  },

  /**
   * Move a placed flat part one grid step without picking it up — the arrow
   * keys. dy moves in half-hole steps and is clamped so the part can rest on
   * the ground but never sink through it. Bolts are dropped and re-found the
   * same way rotatePart does, and consecutive nudges of the same part within
   * half a second share one undo frame, so "tap tap tap tap" is one step back.
   */
  nudgePart: (id, delta) => {
    if (!Array.isArray(delta) || delta.length !== 3 || !delta.every(Number.isFinite)) return
    const [dx, dy, dz] = delta
    if (dx === 0 && dy === 0 && dz === 0) return
    const s = get()
    const part = s.parts[id]
    if (!part || s.running) return
    if (!isFlat(part.kind)) return useUiStore.getState().say('rotateHostInstead', {}, 'warn')

    const nowMs = Date.now()
    if (!(lastNudge.id === id && nowMs - lastNudge.at < 500)) snapshot(set, get)
    lastNudge = { id, at: nowMs }

    set((st) => {
      const p = st.parts[id]
      if (!p) return {}
      const rest = -orientedBottom(p.kind, orientOf(p))
      const moved = {
        ...p,
        pos: [p.pos[0] + dx, 0, p.pos[2] + dz],
        y: Math.max(rest, (p.y ?? rest) + dy),
      }
      return {
        parts: { ...st.parts, [id]: moved },
        bolts: st.bolts.filter((b) => b.aId !== id && b.bId !== id),
      }
    })
    const moved = get().parts[id]
    if (moved) set({ bolts: [...get().bolts.filter((b) => boltFits(get().parts, b, 0.12, true)), ...findBolts(get(), moved)] })
  },

  deletePart: (id) => {
    const s = get()
    const part = s.parts[id]
    if (!part) return
    snapshot(set, get)

    const doomed = new Set([id, ...s.dependentsOf(id)])
    if (part.kind === 'board') {
      for (const p of Object.values(s.parts)) if (isElectronic(p.kind)) doomed.add(p.id)
    }
    const parts = { ...s.parts }
    for (const d of doomed) delete parts[d]

    set({
      parts,
      order: s.order.filter((x) => !doomed.has(x)),
      bolts: s.bolts.filter((b) => !doomed.has(b.aId) && !doomed.has(b.bId)),
      // A lead into a part that no longer exists would hang in mid-air and,
      // worse, keep claiming that part's pin in pinMap.
      wires: s.wires.filter((w) => !doomed.has(w.a.partId) && !doomed.has(w.b.partId)),
      selected: null,
    })
    useUiStore.getState().teach('deleted', { part: partName(part.kind) })
  },

  moveComponent: (id, socketId) => {
    const s = get()
    if (Object.values(s.parts).some((p) => p.socket === socketId && p.id !== id)) {
      return useUiStore.getState().say('socketBusy', {}, 'warn')
    }
    const socket = SOCKETS.find((x) => x.id === socketId)
    snapshot(set, get)
    set({ parts: { ...s.parts, [id]: { ...s.parts[id], socket: socketId } } })
    useUiStore.getState().teach('plugged', { part: partName(s.parts[id].kind), pin: socket.pin })
  },

  undo: () => {
    const s = get()
    if (!s.past.length) return useUiStore.getState().say('nothingToUndo')
    lastNudge = { id: null, at: 0 }
    const frame = s.past[s.past.length - 1]
    set({
      ...frame,
      past: s.past.slice(0, -1),
      // The build being undone becomes the thing redo puts back.
      future: [...s.future, frameOf(s)].slice(-HISTORY_LIMIT),
      selected: null,
      pending: null,
    })
    useUiStore.getState().teach('undo', {})
  },

  redo: () => {
    const s = get()
    if (!s.future.length) return useUiStore.getState().say('nothingToRedo')
    lastNudge = { id: null, at: 0 }
    const frame = s.future[s.future.length - 1]
    set({
      ...frame,
      future: s.future.slice(0, -1),
      past: [...s.past, frameOf(s)].slice(-HISTORY_LIMIT),
      selected: null,
      pending: null,
    })
    useUiStore.getState().teach('redo', {})
  },

  clearAll: () => {
    snapshot(set, get)
    set({ ...emptyBuild(), selected: null, pending: null, serial: [], running: false })
  },

  // ================================================================  program
  /**
   * Program edits are undoable. Without the snapshot, undoing a *build* action
   * restored the program captured in that older frame and silently threw away
   * every block edit made since. Consecutive edits inside a short window share
   * one undo frame, so dragging a slider or typing a number is one step back,
   * not thirty.
   */
  setProgram: (program) => {
    const nowMs = Date.now()
    if (nowMs - lastProgramSnapAt > 800) snapshot(set, get)
    lastProgramSnapAt = nowMs
    set({ program })
  },
  pushSerial: (line) =>
    set((s) => {
      const serial = [...s.serial, line]
      return { serial: serial.length > 200 ? serial.slice(-200) : serial }
    }),
  clearSerial: () => set({ serial: [] }),

  toggleRun: () => {
    const s = get()
    const ui = useUiStore.getState()
    if (s.running) {
      set({ running: false })
      ui.teach('runStop', {})
      return
    }
    const driven = Object.values(s.parts).filter(
      (p) =>
        p.kind === 'wheel' &&
        s.parts[p.hostId]?.kind === 'motor' &&
        motorConnection(s.parts[p.hostId], s.parts, s.wires).ready,
    ).length
    // A mission needs something that can actually drive. Warn — don't block:
    // an LED-only program in the sandbox is a perfectly good run.
    if (driven === 0 && getMission(ui.mission).kind !== 'none') ui.say('needRover', {}, 'warn')
    set({ running: true, serial: [], pending: null })
    ui.teach('runStart', { parts: s.order.length, bolts: s.bolts.length, driven })
    ui.teach('programStarted', { steps: countBlocks(s.program) })
  },

  /**
   * How far the whole assembly floats so its lowest point just kisses the
   * ground. Parts are authored on a flat build plane — a strip lies at
   * y = thickness/2 — and wheels hang below that plane, exactly as they do on a
   * real chassis. Rather than fudging every part's height, the finished build is
   * lifted as one rigid thing, so a rover ends up standing on its wheels with
   * the frame properly clear of the floor.
   */
  buildLift: () => {
    const s = get()
    let lowest = Infinity
    for (const p of Object.values(s.parts)) {
      if (isElectronic(p.kind)) continue
      const bottom = partBottom(p, s.parts)
      if (Number.isFinite(bottom)) lowest = Math.min(lowest, bottom)
    }
    return Number.isFinite(lowest) ? Math.max(0, -lowest) : 0
  },

  /** Same, plus a visible little drop so Run reads as "now it's real". */
  liftForRun: () => get().buildLift() + PHYSICS.dropClearance,

  // ==========================================================  save and load
  /**
   * Format version 4 adds breadboard footprints: one stable hole id per lead.
   * Flat parts still carry `rot` (an orientation-group index) and
   * hole-mounted fittings may carry `spin` (quarter turns about their bolt).
   * The `rotY` mirror rides along too — a v3 file still opens in anything
   * that only ever understood the scalar. Version 2 files load through the
   * migration in loadBuildFromJSON, and the bundled templates stay v2 on
   * purpose so that migration is exercised on every template load.
   */
  exportBuildToJSON: () => {
    const s = get()
    return {
      format: 'arduinium-build',
      version: 4,
      name: s.buildName,
      parts: s.order.map((id) => s.parts[id]),
      bolts: s.bolts,
      wires: s.wires,
      program: s.program,
    }
  },

  loadBuildFromJSON: (json, label = 'build') => {
    if (!json || json.format !== 'arduinium-build' || !Array.isArray(json.parts)) {
      useUiStore.getState().say('notArduinium', {}, 'warn')
      return false
    }
    const parts = {}
    const order = []
    let partsSkipped = 0
    const usedSockets = new Set()
    for (const p of json.parts) {
      if (!p || !safeId(p.id) || !Object.hasOwn(PART_SPECS, p.kind) || Object.hasOwn(parts, p.id)) {
        partsSkipped++
        continue
      }
      let loaded = { id: p.id, kind: p.kind }
      if (p.breadboardId != null) {
        if (!safeId(p.breadboardId) || !p.holes || typeof p.holes !== 'object' || Array.isArray(p.holes)) {
          partsSkipped++
          continue
        }
        loaded = { ...loaded, breadboardId: p.breadboardId, holes: { ...p.holes } }
      } else if (isFlat(p.kind)) {
        if (!Array.isArray(p.pos) || p.pos.length !== 3 || !p.pos.every(Number.isFinite) ||
            (p.y != null && !Number.isFinite(p.y))) {
          partsSkipped++
          continue
        }
        const rot = isOrient(p.rot) ? p.rot : fromRotY(p.rotY)
        loaded = { ...loaded, pos: [p.pos[0], 0, p.pos[2]], y: p.y ?? -orientedBottom(p.kind, rot), rot, rotY: yawOf(rot) }
        // A fixture is an explicit part of a starter/build, not a physics
        // heuristic. It models a base plate bolted to the work surface.
        if (p.anchored === true) loaded.anchored = true
        // A second copy in the identical pose is never a stack.
        if (Object.values(parts).some((q) => isFlat(q.kind) && q.kind === loaded.kind &&
            orientOf(q) === rot && q.y === loaded.y && q.pos[0] === loaded.pos[0] && q.pos[2] === loaded.pos[2])) {
          partsSkipped++
          continue
        }
      } else if (isMount(p.kind)) {
        loaded.hostId = p.hostId
        loaded.hostHole = p.hostHole
        loaded.spin = Number.isInteger(p.spin) && p.spin >= 0 && p.spin < 4 &&
          (spec(p.kind).mountTo === CATEGORY.HOLE || spec(p.kind).clockable) ? p.spin : 0
        if (p.kind === 'servo' && safeId(p.actuatesBolt)) loaded.actuatesBolt = p.actuatesBolt
        if (spec(p.kind).pinned) loaded.pin = Number.isInteger(p.pin) && p.pin >= 2 && p.pin <= 19 ? p.pin : null
      } else if (isElectronic(p.kind)) {
        if (!SOCKETS.some((s) => s.id === p.socket) || usedSockets.has(p.socket)) {
          partsSkipped++
          continue
        }
        loaded.socket = p.socket
        usedSockets.add(p.socket)
      }
      parts[loaded.id] = loaded
      order.push(loaded.id)
      idSeq++
    }

    // Validate the whole graph, not only host existence: reject cycles,
    // incompatible edges, invalid indices and duplicate node claims, then
    // prune every dependent of a rejected host.
    let pruned = true
    while (pruned) {
      pruned = false
      const occupied = new Set()
      const occupiedBreadboard = new Set()
      const board = Object.values(parts).some((p) => p.kind === 'board')
      for (const id of [...order]) {
        const p = parts[id]
        const key = JSON.stringify([p.hostId, p.hostHole, spec(p.kind).mountTo])
        const footprintKeys = p.breadboardId
          ? Object.values(p.holes ?? {}).map((hole) => `${p.breadboardId}/${hole}`)
          : []
        const expected = Object.keys(BREADBOARD_FOOTPRINTS[p.kind]?.leads ?? {})
        const actual = Object.keys(p.holes ?? {})
        const badFootprint = p.breadboardId && (
          parts[p.breadboardId]?.kind !== 'breadboard' ||
          expected.length === 0 || expected.length !== actual.length || expected.some((terminal) => !actual.includes(terminal)) ||
          new Set(footprintKeys).size !== footprintKeys.length ||
          footprintKeys.some((hole) => occupiedBreadboard.has(hole)) ||
          actual.some((terminal) => !terminalOf(p, terminal) || !terminalOf(parts[p.breadboardId], p.holes[terminal])) ||
          !partTransform(p, parts)
        )
        const bad = p.breadboardId ? badFootprint : isMount(p.kind)
          ? !safeId(p.hostId) || !chainTransform(p, parts) || occupied.has(key)
          : isElectronic(p.kind) && !board
        if (bad) {
          delete parts[id]
          order.splice(order.indexOf(id), 1)
          partsSkipped++
          pruned = true
        } else if (p.breadboardId) footprintKeys.forEach((hole) => occupiedBreadboard.add(hole))
        else if (isMount(p.kind)) occupied.add(key)
      }
    }
    if (partsSkipped) useUiStore.getState().say('partsSkipped', { n: partsSkipped }, 'warn')

    const bolts = []
    const boltIds = new Set()
    const occupied = new Set(Object.values(parts).filter((p) => isMount(p.kind) && spec(p.kind).mountTo === CATEGORY.HOLE)
      .map((p) => nodeKey(p.hostId, p.hostHole)))
    let dropped = 0
    for (const b of Array.isArray(json.bolts) ? json.bolts : []) {
      const endpoints = b && [nodeKey(b.aId, b.aHole), nodeKey(b.bId, b.bHole)]
      if (!b || !safeId(b.id) || boltIds.has(b.id) || endpoints.some((key) => occupied.has(key)) ||
          !boltFits(parts, b, 0.12, true)) {
        dropped++
        continue
      }
      bolts.push({ id: b.id, aId: b.aId, aHole: b.aHole, bId: b.bId, bHole: b.bHole })
      boltIds.add(b.id)
      endpoints.forEach((key) => occupied.add(key))
    }
    if (dropped) useUiStore.getState().say('boltsSkipped', { n: dropped }, 'warn')

    const wires = []
    const wireKeys = new Set()
    const wireIds = new Set()
    const usedWireContacts = new Set(Object.values(parts).flatMap((part) =>
      part.breadboardId ? Object.values(part.holes ?? {}).map((hole) => `${part.breadboardId}/${hole}`) : []))
    for (const w of Array.isArray(json.wires) ? json.wires : []) {
      const a = terminalRef(parts, w?.a), b = terminalRef(parts, w?.b)
      const capacityKeys = [a, b].filter((terminal) => terminal?.capacity === 1)
        .map((terminal) => `${terminal.partId}/${terminal.id}`)
      if (!canConnect(a, b) || capacityKeys.some((key) => usedWireContacts.has(key))) continue
      const key = JSON.stringify([[a.partId, a.id], [b.partId, b.id]].sort())
      if (wireKeys.has(key)) continue
      wireKeys.add(key)
      let id = safeId(w.id) && !wireIds.has(w.id) ? w.id : null
      while (!id || wireIds.has(id)) id = 'w-import-' + ++wireSeq
      wireIds.add(id)
      wires.push({ id, a: { partId: a.partId, terminal: a.id }, b: { partId: b.partId, terminal: b.id }, colour: wireColour(a, b) })
      capacityKeys.forEach((key) => usedWireContacts.add(key))
    }
    const name = typeof json.name === 'string' ? json.name : label
    set({
      parts, order, bolts, wires,
      program: Array.isArray(json.program) ? safeProgram(json.program) : structuredClone(DEFAULT_PROGRAM),
      buildName: name, selected: null, pending: null, wiring: null, running: false,
      serial: [], past: [], future: [],
    })
    lastNudge = { id: null, at: 0 }
    useUiStore.getState().teach('loaded', { name })
    return true
  },
}))

// ===========================================================  internal helpers

/** Roughly a wheel-and-a-half: forgiving, but not "anywhere on the table". */
const MOUNT_SNAP_RADIUS = SNAP_RADIUS * 6

/** How high an unsnapped fitting hovers while carried. */
const MOUNT_HOVER_Y = 0.5

/**
 * How close two nodes' X/Z distances must be to count as the same spot, i.e. as
 * one directly above the other. Well below any real hole spacing, so it only
 * ever groups a genuine stack.
 */
const STACK_EPS = 1e-6

/** Find the exact set of breadboard holes a carried through-hole part occupies. */
function resolveBreadboardPlacement(state, pending) {
  const cursor = pending.cursor ?? pending.pos
  const occupied = new Set()
  for (const wire of state.wires ?? []) {
    for (const end of [wire?.a, wire?.b]) {
      if (state.parts[end?.partId]?.kind === 'breadboard') occupied.add(`${end.partId}/${end.terminal}`)
    }
  }
  for (const part of Object.values(state.parts ?? {})) {
    if (!part.breadboardId || part.id === pending.from?.id) continue
    for (const hole of Object.values(part.holes ?? {})) occupied.add(`${part.breadboardId}/${hole}`)
  }

  let best = null
  for (const board of Object.values(state.parts ?? {})) {
    if (board.kind !== 'breadboard') continue
    const boardT = partTransform(board, state.parts)
    if (!boardT) continue
    for (const hole of breadboardHoles()) {
      if (hole.region !== 'terminal') continue
      const holes = footprintAt(pending.kind, hole.id)
      if (!holes || Object.values(holes).some((id) => occupied.has(`${board.id}/${id}`))) continue
      const d = apply(boardT.orient ?? ID, hole.local)
      const pos = [boardT.pos[0] + d[0], boardT.pos[1] + d[1], boardT.pos[2] + d[2]]
      const distance = distXZ(cursor, pos)
      if (distance > 0.34 || (best && distance >= best.distance)) continue
      best = { board, holes, distance }
    }
  }

  if (!best) return { ...pending, pos: [cursor[0], 0, cursor[2]], y: 0.48, footprint: null, snap: null }
  const fake = { id: '__pending__', kind: pending.kind, breadboardId: best.board.id, holes: best.holes }
  const transform = partTransform(fake, state.parts)
  if (!transform) return { ...pending, footprint: null, snap: null }
  return {
    ...pending,
    pos: [transform.pos[0], 0, transform.pos[2]],
    y: transform.pos[1],
    rot: transform.orient,
    rotY: transform.rotY,
    footprint: { breadboardId: best.board.id, holes: best.holes, blocked: false },
    snap: null,
  }
}

/** How many steps back you can go. Snapshots are small; 40 is generous. */
const HISTORY_LIMIT = 40

/** The slice of state that undo/redo restores. */
const frameOf = ({ parts, order, bolts, wires, program }) => ({
  parts: { ...parts },
  order: [...order],
  bolts: [...bolts],
  wires: [...wires],
  program,
})

/**
 * Push the current build onto the undo stack.
 *
 * Taking a new action always clears the redo stack — once you branch off, the
 * old future is unreachable, and keeping it would let redo paste in a build
 * that never followed from what is now on screen.
 */
/** Resolve a { partId, terminal } reference to a full terminal descriptor. */
function terminalRef(parts, ref) {
  const part = parts[ref?.partId]
  const t = part ? terminalOf(part, ref.terminal) : null
  return t ? { ...t, partId: part.id, partKind: part.kind } : null
}

const wireUsesEndpoint = (wires, partId, terminal) => (Array.isArray(wires) ? wires : []).some((wire) =>
  (wire?.a?.partId === partId && wire.a.terminal === terminal) ||
  (wire?.b?.partId === partId && wire.b.terminal === terminal))

function snapshot(set, get) {
  const past = [...get().past, frameOf(get())]
  set({ past: past.slice(-HISTORY_LIMIT), future: [] })
}

const mountHint = (kind) =>
  kind === 'wheel' ? 'wheelNeedsShaft' : kind === 'motor' ? 'motorNeedsMount' : 'needsHole'

const mountLesson = (kind) =>
  kind === 'wheel' ? 'wheelAttached' : kind === 'motor' ? 'motorMounted' : 'fittingMounted'

function nearestFreeSocket(state, point) {
  const board = state.boardPart()
  if (!board) return null
  const used = new Set(Object.values(state.parts).map((p) => p.socket).filter(Boolean))
  let best = null
  let bestD = 1.1
  for (const socket of SOCKETS) {
    if (used.has(socket.id)) continue
    const d = distXZ(point, socketTransform(board, socket.id).pos)
    if (d < bestD) {
      bestD = d
      best = socket.id
    }
  }
  return best
}

/**
 * The snap matrix in action: only nodes whose category this part accepts are
 * considered at all, so a wheel can never find a chassis hole and a motor can
 * never end up plugged into the board.
 */
function resolveSnap(state, pending) {
  const { kind } = pending
  const cursor = pending.cursor ?? pending.pos
  const rot = pending.rot ?? ID
  const carryY = Number.isFinite(pending.carryY) ? Math.max(0, pending.carryY) : 0
  const rest = -orientedBottom(kind, rot)
  const centerY = rest + carryY
  const freeDrop = () => ({
    ...pending,
    pos: [Math.round(cursor[0] / PITCH) * PITCH, 0, Math.round(cursor[2] / PITCH) * PITCH],
    y: isMount(kind) ? carryY + MOUNT_HOVER_Y : centerY,
    snap: null,
  })
  if (state.snapEnabled === false) return freeDrop()
  const all = candidateNodes(kind, state.parts, () => false)

  if (isMount(kind)) {
    const point = [cursor[0], cursor[1] ?? carryY, cursor[2]]
    const eligible = all.filter((node) => dist3(point, node.pos) < MOUNT_SNAP_RADIUS)
    const preview = (node) => {
      const t = chainTransform({ id: '__pending__', kind, hostId: node.partId, hostHole: node.index, spin: pending.spin ?? 0 }, state.parts)
      if (!t) return freeDrop()
      return { ...pending, pos: [t.pos[0], 0, t.pos[2]], y: t.pos[1],
        snap: { hostId: node.partId, index: node.index, category: node.category,
          blocked: state.isNodeTaken(node.partId, node.index, node.category),
          worldPos: node.pos, axis: t.axis, orient: t.orient } }
    }
    const aimed = eligible.find((n) => n.partId === pending.hint?.partId && n.index === pending.hint?.index)
    if (aimed) return preview(aimed)
    // A ground-plane caller still fills a local upright from the bottom up.
    // Full 3D distance bounds that convenience to the nearby assembly.
    let best = null
    for (const node of eligible) {
      const d = distXZ(point, node.pos)
      const blocked = state.isNodeTaken(node.partId, node.index, node.category)
      const betterStack = best && Math.abs(d - best.d) <= STACK_EPS &&
        ((best.blocked && !blocked) || (best.blocked === blocked && Math.abs(node.pos[1] - point[1]) < Math.abs(best.node.pos[1] - point[1])))
      if (!best || d < best.d - STACK_EPS || betterStack) best = { node, d, blocked }
    }
    return best ? preview(best.node) : freeDrop()
  }

  const normal = basisY(rot)
  let best = null
  for (const node of all) {
    const dot = normal.reduce((sum, v, i) => sum + v * node.axis[i], 0)
    if (Math.abs(dot) !== 1) continue
    const host = state.parts[node.partId]
    const surface = (isFlat(host.kind) ? halfThickness(host.kind) : 0) + halfThickness(kind)
    for (let i = 0; i < holeCount(kind); i++) {
      const local = apply(rot, localHole(kind, i))
      const hole = [cursor[0] + local[0], centerY + local[1], cursor[2] + local[2]]
      const delta = hole.map((v, j) => v - node.pos[j])
      const along = delta.reduce((sum, v, j) => sum + v * node.axis[j], 0)
      const perp = Math.hypot(...delta.map((v, j) => v - along * node.axis[j]))
      // Both dimensions are bounded. A screen hint only selects an eligible
      // nearby hole and cannot pull a part to a remote parallel plane.
      if (perp >= SNAP_RADIUS || Math.abs(along) > surface + SNAP_RADIUS) continue
      const side = isFlat(host.kind) && along < -1e-6 ? -1 : 1
      const origin = node.pos.map((v, j) => v + node.axis[j] * surface * side - local[j])
      const score = Math.hypot(perp, Math.abs(along) - surface)
      const aimed = node.partId === pending.hint?.partId && node.index === pending.hint?.index
      const blocked = state.isNodeTaken(node.partId, node.index, node.category)
      if (!best || (aimed && !best.aimed) || (aimed === best.aimed &&
          (score < best.score - STACK_EPS || (Math.abs(score - best.score) <= STACK_EPS && best.blocked && !blocked)))) {
        best = { node, i, origin, score, aimed, blocked }
      }
    }
  }
  if (!best) return freeDrop()
  const { node, i, origin, blocked } = best
  return { ...pending, pos: [origin[0], 0, origin[2]], y: origin[1],
    snap: { hostId: node.partId, index: node.index, myHole: i, category: node.category,
      blocked, worldPos: node.pos, axis: node.axis } }
}

const nodeKey = (id, index) => JSON.stringify([id, index])
const safeId = (id) => typeof id === 'string' && id.length > 0 &&
  !['__proto__', 'constructor', 'prototype'].includes(id)

function safeProgram(blocks, depth = 0, context = { ids: new Set(), remaining: 5000 }) {
  if (!Array.isArray(blocks) || depth > 64) return []
  const out = []
  for (const raw of blocks) {
    if (!context.remaining) break
    if (!raw || !Object.hasOwn(BLOCK_TYPES, raw.type)) continue
    const block = makeBlock(raw.type)
    if (safeId(raw.id) && !context.ids.has(raw.id)) block.id = raw.id
    while (context.ids.has(block.id)) block.id = makeBlock(raw.type).id
    context.ids.add(block.id)
    context.remaining--
    // Copy only fields the known block declares, retaining its safe defaults.
    for (const [key, fallback] of Object.entries(block)) {
      if (key === 'id' || key === 'type') continue
      const value = raw[key]
      if (key === 'body' || key === 'elseBody') block[key] = safeProgram(value, depth + 1, context)
      else if (key === 'a' || key === 'b') block[key] = safeOperand(value, fallback)
      else if (typeof fallback === 'number') {
        if (Number.isFinite(value)) block[key] = value
      } else if (typeof fallback === 'string' && typeof value === 'string') block[key] = value
    }
    if ('pin' in block && (!Number.isInteger(block.pin) || block.pin < 0 || block.pin > 19)) block.pin = BLOCK_TYPES[raw.type].make().pin
    if ('ms' in block) block.ms = Math.max(0, block.ms)
    if ('times' in block) block.times = Math.max(0, Math.trunc(block.times))
    if ('speed' in block) block.speed = Math.max(block.type === 'motor' ? -255 : 0, Math.min(255, block.speed))
    if ('angle' in block) block.angle = Math.max(0, Math.min(180, block.angle))
    if ('name' in block) block.name = safeVarName(block.name)
    if ('dir' in block && !DIRECTIONS.includes(block.dir) && block.dir !== 'stop') block.dir = 'forward'
    if (block.type === 'digitalWrite' && !['HIGH', 'LOW'].includes(block.value)) block.value = 'HIGH'
    if ('op' in block) {
      const ops = block.type === 'setVar' ? MATH_OPS : COMPARE_OPS
      if (!ops.includes(block.op)) block.op = BLOCK_TYPES[block.type].make().op
    }
    out.push(block)
  }
  return out
}

function safeOperand(value, fallback) {
  if (!value || typeof value !== 'object') return { ...fallback }
  if (value.src === 'distance') return { src: 'distance' }
  if (value.src === 'var' && typeof value.name === 'string') return { src: 'var', name: safeVarName(value.name) }
  if (value.src === 'sensor' && Number.isInteger(value.pin) && value.pin >= 0 && value.pin <= 19) {
    return { src: 'sensor', pin: value.pin }
  }
  if (value.src === 'num' && Number.isFinite(value.value)) return { src: 'num', value: value.value }
  return { ...fallback }
}

/** Import preserves the historic bolt reach; new joints must meet the surface. */
function boltFits(parts, bolt, tolerance = 0.09, legacy = false) {
  const ends = boltEndpoints(parts, bolt)
  if (!ends) return false
  const { a, b } = ends
  if (Math.abs(a.axis.reduce((sum, v, i) => sum + v * b.axis[i], 0)) !== 1) return false
  const delta = b.pos.map((v, i) => v - a.pos[i])
  const along = delta.reduce((sum, v, i) => sum + v * a.axis[i], 0)
  const perp = Math.hypot(...delta.map((v, i) => v - along * a.axis[i]))
  const surface = a.thickness + b.thickness
  return Number.isFinite(perp) && perp <= tolerance &&
    Math.abs(along) >= surface - 0.015 &&
    (legacy ? Math.abs(along) <= 0.35 : Math.abs(Math.abs(along) - surface) <= 0.035)
}

function findBolts(state, part) {
  if (!isFlat(part.kind)) return []
  const parts = { ...state.parts, [part.id]: part }
  const bolts = []
  const used = new Set()
  for (let i = 0; i < holeCount(part.kind); i++) {
    if (state.isNodeTaken(part.id, i, CATEGORY.HOLE)) continue
    for (const node of candidateNodes(part.kind, state.parts)) {
      const key = nodeKey(node.partId, node.index)
      if (node.partId === part.id || used.has(key) || state.isNodeTaken(node.partId, node.index, CATEGORY.HOLE)) continue
      const bolt = { id: 'bolt-' + part.id + '-' + i + '-' + node.partId + '-' + node.index,
        aId: part.id, aHole: i, bId: node.partId, bHole: node.index }
      if (!boltFits(parts, bolt)) continue
      bolts.push(bolt)
      used.add(key)
      break // one physical bolt per held hole
    }
  }
  return bolts
}
