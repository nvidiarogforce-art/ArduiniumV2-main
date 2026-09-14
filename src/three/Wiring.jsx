import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useBuildStore } from '../store/useBuildStore.js'
import { useUiStore } from '../store/useUiStore.js'
import { allTerminals, canConnect, wireColour } from '../lib/terminals.js'
import { partTransform } from '../lib/geometry.js'
import { HEADER_TOP, WIRE_COLOUR } from '../lib/config.js'
import { flexibleWireCurve, wireGeometry } from '../lib/wirePath.js'
import { rt } from './runtime.js'

/**
 * THE INTERACTIVE WIRING LAYER.
 *
 * Three things live here, and they are separate on purpose:
 *
 *   PinDots    a clickable dot at every terminal in the build
 *   LiveWire   the lead being dragged, from its anchor to the cursor
 *   Wire       a committed lead between two terminals
 *
 * Terminal positions are recomputed from the parts each render, so a wire
 * never stores a coordinate — move the sensor and both its dot and every lead
 * running to it follow, with nothing to invalidate.
 */

const DOT_R = 0.055

/**
 * How big the invisible grab sphere is, per terminal.
 *
 * It cannot simply be "generous". Header pins sit 0.1 apart, so a 0.275-radius
 * sphere — an early "five times the dot" attempt — swallows five neighbours
 * on each side, and the raycast then returns whichever overlapping surface
 * happens to face the camera: pressing on D9 armed D6. Board pins therefore
 * get just under half the pitch, so neighbouring spheres never overlap and the
 * hit is unambiguous. Terminals that stand alone — motor tags, sensor pins,
 * LED legs — have no neighbours to confuse and keep a genuinely generous
 * target.
 */
const hitRadius = (t, terminals) => {
  if (t.partKind === 'board') return 0.048
  // Module pins and a motor's M+/M- tags are close enough that a fixed 0.16
  // sphere overlaps its neighbour. Cap the hit target below half the nearest
  // same-part spacing so pressing the visible dot always selects that dot.
  const nearest = terminals
    .filter((other) => other.partId === t.partId && other.id !== t.id)
    .reduce(
      (best, other) => Math.min(best, Math.hypot(...t.pos.map((n, i) => n - other.pos[i]))),
      Infinity,
    )
  return Number.isFinite(nearest) ? Math.min(0.16, nearest * 0.43) : 0.16
}

/**
 * The dot must fit inside its own grab sphere. Board dots drawn at the shared
 * DOT_R (0.055) poked out past their 0.048 hit sphere, so a press on the rim
 * of the very dot being aimed at fell through to nothing.
 */
const dotRadius = (t) => (t.partKind === 'board' ? 0.045 : DOT_R)

/**
 * How close the cursor must come to a pin, in normalised screen units, for a
 * dragged lead to snap to it. About 3% of the viewport — roughly 35 px on a
 * 1500-wide window.
 *
 * Precision-clicking a 2.54 mm pin in a rotating 3D view is not a reasonable
 * ask of a ten-year-old, which is the same reasoning behind MOUNT_SNAP_RADIUS
 * being far larger than a bolt hole. Snapping is by distance rather than by
 * raycast hover because with pins this close together the hover sets of
 * neighbouring spheres thrash, and a lead could never reliably tell it was
 * over a pin.
 */
const SNAP_NDC = 0.045

export default function Wiring({ parts, livePosition = null }) {
  const wires = useBuildStore((s) => s.wires)
  const wiring = useBuildStore((s) => s.wiring)
  const cancel = useBuildStore((s) => s.cancelWire)

  /*
   * Where the pointer last went down, and whether a lead was already in flight
   * when it did.
   *
   * Registered in the CAPTURE phase on purpose: a pin's own onPointerDown arms
   * or lands a lead, and this has to read the state as it was *before* that
   * happened to tell "the press that started this lead" apart from "a press
   * while one was already in flight".
   */
  const press = useRef({ x: 0, y: 0, wiring: false })
  useEffect(() => {
    const onDown = (e) => {
      press.current = {
        x: e.clientX,
        y: e.clientY,
        wiring: Boolean(useBuildStore.getState().wiring),
      }
    }
    window.addEventListener('pointerdown', onDown, true)
    return () => window.removeEventListener('pointerdown', onDown, true)
  }, [])

  /*
   * What a release does, and the cancel routes.
   *
   * The listeners are on window rather than on a mesh because a release can end
   * anywhere — over the pin you meant, over a neighbour, or over nothing at all
   * — and only one of those is a mesh you could have hung a handler on.
   *
   * A release LANDS THE LEAD ON WHATEVER THE PREVIEW IS SHOWING, which is the
   * whole point. Terminals used to commit from their own onPointerUp, and that
   * was wrong twice over. A board pin's grab sphere is about four pixels across
   * on screen while the snapper reaches thirty-four (see SNAP_NDC), so a lead
   * could sit previewing "D9" in green and still be thrown away on release for
   * missing a four-pixel target; and when the raycast did hit, overlapping
   * spheres meant it could hit a neighbour and quietly wire up a different pin
   * than the one being previewed. Committing to `target` makes the promise the
   * preview is already making — "this is where it will land" — true.
   *
   * Still deferred a frame, because a pin's onPointerDown may have landed the
   * lead on this same press; the guard below then finds nothing left to do.
   */
  useEffect(() => {
    if (!wiring) return
    const onContext = (e) => {
      e.preventDefault()
      cancel()
    }
    const onUp = (e) => {
      // Whether this was a drag or a click. Below the threshold it is the press
      // that armed the lead, and its own release must not undo it — that is the
      // first half of the click-a-pin, click-another-pin gesture.
      const dragged = Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > 4
      const arming = !dragged && !press.current.wiring
      requestAnimationFrame(() => {
        const s = useBuildStore.getState()
        if (!s.wiring) return
        if (s.wiring.target) s.commitWire(s.wiring.target.partId, s.wiring.target.terminal)
        else if (!arming) s.cancelWire()
      })
    }
    window.addEventListener('contextmenu', onContext)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('contextmenu', onContext)
      window.removeEventListener('pointerup', onUp)
    }
  }, [wiring, cancel])

  const terminals = useMemo(() => allTerminals(parts), [parts])

  /*
   * The height every lead has to arch over.
   *
   * Almost all wiring here crosses the Arduino, and the board's headers are
   * the tallest thing in the way, so the board's own top is the clearance.
   * Without it a lead drawn from one edge of the board to the other cuts
   * straight through the PCB.
   */
  const clearance = useMemo(() => {
    const board = Object.values(parts).find((p) => p.kind === 'board')
    const bt = board && partTransform(board, parts)
    return bt ? bt.pos[1] + HEADER_TOP : 0
  }, [parts])
  const byKey = useMemo(
    () => new Map(terminals.map((t) => [`${t.partId}/${t.id}`, t])),
    [terminals],
  )

  return (
    <group>
      {wires.map((w) => {
        const a = byKey.get(`${w.a.partId}/${w.a.terminal}`)
        const b = byKey.get(`${w.b.partId}/${w.b.terminal}`)
        if (!a || !b) return null
        return (
          <Wire
            key={w.id}
            id={w.id}
            from={a.pos}
            to={b.pos}
            colour={w.colour}
            clearance={clearance}
            livePosition={livePosition ? () => [livePosition(a), livePosition(b)] : null}
          />
        )
      })}

      {wiring && <LiveWire terminals={terminals} clearance={clearance} />}

      <PinDots terminals={terminals} />
    </group>
  )
}

/**
 * A dot on every terminal.
 *
 * Only shown while wiring is possible — a build covered in permanent dots
 * reads as clutter, and this project's whole visual argument is that the
 * machine should be the biggest thing on screen. They appear when you hover
 * the layer or while a lead is in flight.
 *
 * The dot is what you press to start a lead and what you release over to
 * finish one, so both handlers live on the same mesh.
 */
function PinDots({ terminals }) {
  const wiring = useBuildStore((s) => s.wiring)
  const begin = useBuildStore((s) => s.beginWire)
  const commit = useBuildStore((s) => s.commitWire)
  const drag = useBuildStore((s) => s.dragWire)
  const running = useBuildStore((s) => s.running)
  const wireMode = useUiStore((s) => s.wireMode)
  const [hover, setHover] = useState(null)

  // Hidden unless asked for, or while a lead is already in flight — a drag
  // that started must be able to see where it can land.
  if (running || (!wireMode && !wiring)) return null

  const source = wiring
    ? terminals.find((t) => t.partId === wiring.from.partId && t.id === wiring.from.terminal)
    : null

  // While dragging, only the terminal nearest the cursor gets a label —
  // labelling all 32 at once would be a wall of text.
  const nearestKey = wiring?.target ? `${wiring.target.partId}/${wiring.target.terminal}` : null

  const breadboard = terminals.filter((t) => t.partKind === 'breadboard')
  const ordinary = terminals.filter((t) => t.partKind !== 'breadboard')

  return <>
    {ordinary.map((t) => {
    const key = `${t.partId}/${t.id}`
    const isNear = key === nearestKey
    const isSource = source && source.partId === t.partId && source.id === t.id
    // While a lead is in flight every other terminal answers one question:
    // may this land here? Green yes, red no, and the source itself stays put.
    const legal = wiring ? (isSource ? null : canConnect(source, t)) : null
    const hovered = hover === key

    const colour =
      legal === true ? '#23c07a' : legal === false ? '#d9534f' : hovered ? '#ffd166' : dotColour(t)

    return (
      <group key={`${t.partId}/${t.id}`} position={t.pos}>
        {/* The dot you see. Small, because a real header pin is small. */}
        <mesh scale={hovered || legal === true ? 1.6 : 1}>
          <sphereGeometry args={[dotRadius(t), 10, 8]} />
          <meshBasicMaterial color={colour} toneMapped={false} />
        </mesh>

        {/*
          The thing you actually hit.
          
          A header pin is 2.54 mm apart from its neighbour and the visible dot
          is 1.4 mm across; asking a ten-year-old to land on that with a mouse
          in a rotating 3D view is not reasonable. This invisible sphere is
          sized by hitRadius() — as generous as its neighbours allow — and
          carries every handler, the same spirit as MOUNT_SNAP_RADIUS being far
          larger than a bolt hole.

          visible={false} would remove it from raycasting too, so it stays
          visible with a fully transparent material and no depth write.
        */}
        <mesh
          onPointerOver={(e) => {
            e.stopPropagation()
            setHover(`${t.partId}/${t.id}`)
            if (wiring) drag(undefined, { partId: t.partId, terminal: t.id })
          }}
          onPointerOut={(e) => {
            e.stopPropagation()
            setHover(null)
            if (wiring) drag(undefined, null)
          }}
          onPointerDown={(e) => {
            e.stopPropagation()
            if (e.button !== 0) return
            // Click-click and press-drag-release are the same gesture to the
            // store: press on a pin either starts a lead or lands the one in
            // flight. Landing goes to the previewed target rather than to this
            // pin for the same reason the release path does — with pins this
            // close together, the sphere the raycast happened to return is not
            // reliably the pin the student is looking at. Arming does use this
            // pin: nothing is previewed yet, and hitRadius() keeps board pins
            // tight precisely so pressing D9 cannot arm D6.
            if (!wiring) begin(t.partId, t.id)
            else if (wiring.target) commit(wiring.target.partId, wiring.target.terminal)
            else if (!isSource) commit(t.partId, t.id)
          }}
        >
          <sphereGeometry args={[hitRadius(t, terminals), 8, 6]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        {/* Which pin this is, shown before you commit rather than after. */}
        {(legal === true && isNear) || hovered ? <PinLabel text={t.label} /> : null}
      </group>
    )
    })}
    {breadboard.length > 0 && (
      <BreadboardPinDots
        terminals={breadboard}
        source={source}
        wiring={wiring}
        hover={hover}
        setHover={setHover}
        begin={begin}
        commit={commit}
        drag={drag}
      />
    )}
  </>
}

/**
 * The breadboard has 830 targets. Rendering them as the ordinary two-mesh pin
 * widget would add 1,660 draw calls in Wiring mode, so all sockets share one
 * coloured InstancedMesh and instanceId identifies the physical hole hit.
 */
function BreadboardPinDots({ terminals, source, wiring, hover, setHover, begin, commit, drag }) {
  const mesh = useRef()
  const matrix = useMemo(() => new THREE.Matrix4(), [])
  const colour = useMemo(() => new THREE.Color(), [])

  useLayoutEffect(() => {
    if (!mesh.current) return
    terminals.forEach((terminal, index) => {
      const key = `${terminal.partId}/${terminal.id}`
      const isSource = source && source.partId === terminal.partId && source.id === terminal.id
      const legal = wiring ? (isSource ? null : canConnect(source, terminal)) : null
      const highlighted = hover === key || legal === true
      matrix.compose(
        new THREE.Vector3(...terminal.pos),
        new THREE.Quaternion(),
        new THREE.Vector3().setScalar(highlighted ? 1.42 : 1),
      )
      mesh.current.setMatrixAt(index, matrix)
      mesh.current.setColorAt(index, colour.set(
        legal === true ? '#23c07a' : legal === false ? '#d9534f' : hover === key ? '#ffd166' : '#66717b',
      ))
    })
    mesh.current.instanceMatrix.needsUpdate = true
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
    mesh.current.computeBoundingSphere()
  }, [terminals, source, wiring, hover, matrix, colour])

  const terminalAt = (event) => terminals[event.instanceId]
  const aim = (event) => {
    event.stopPropagation()
    const terminal = terminalAt(event)
    if (!terminal) return
    setHover(`${terminal.partId}/${terminal.id}`)
    if (wiring) drag(undefined, { partId: terminal.partId, terminal: terminal.id })
  }

  const hovered = terminals.find((terminal) => `${terminal.partId}/${terminal.id}` === hover)
  const near = wiring?.target && terminals.find((terminal) =>
    terminal.partId === wiring.target.partId && terminal.id === wiring.target.terminal)
  const label = hovered ?? near

  return (
    <group>
      <instancedMesh
        ref={mesh}
        args={[null, null, terminals.length]}
        onPointerMove={aim}
        onPointerOver={aim}
        onPointerOut={(event) => {
          event.stopPropagation()
          setHover(null)
          if (wiring) drag(undefined, null)
        }}
        onPointerDown={(event) => {
          event.stopPropagation()
          if (event.button !== 0) return
          const terminal = terminalAt(event)
          if (!terminal) return
          const isSource = source && source.partId === terminal.partId && source.id === terminal.id
          if (!wiring) begin(terminal.partId, terminal.id)
          else if (wiring.target) commit(wiring.target.partId, wiring.target.terminal)
          else if (!isSource) commit(terminal.partId, terminal.id)
        }}
      >
        <sphereGeometry args={[0.041, 8, 6]} />
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>
      {label ? <group position={label.pos}><PinLabel text={label.label} /></group> : null}
    </group>
  )
}


/**
 * How the label is sized.
 *
 * `LABEL_EM` is the world-space em size — the number drei's <Text fontSize>
 * used to carry. The canvas is drawn at `LABEL_PX` pixels per em for crispness
 * and the sprite is then scaled back down by that ratio, so changing the
 * resolution cannot change how big the label looks. `LABEL_PAD` is breathing
 * room for the dark halo, which is stroked centred on the glyph and would be
 * clipped by a tight canvas.
 */
const LABEL_EM = 0.16
const LABEL_PX = 96
const LABEL_PAD = 16

/**
 * Labels are drawn once per distinct string and kept.
 *
 * There are only about thirty in the whole app — every board pin plus a handful
 * of motor, sensor and LED tags — and the same few reappear on every hover, so
 * this costs a few small textures and saves redrawing one on every pointer
 * move.
 */
const labelCache = new Map()

function labelTexture(text) {
  const cached = labelCache.get(text)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const font = `700 ${LABEL_PX}px 'Nunito', 'Segoe UI', system-ui, sans-serif`

  // Measure first, then size the canvas to fit — resizing a canvas clears it,
  // so everything below the resize has to be set on the context again.
  ctx.font = font
  canvas.width = Math.ceil(ctx.measureText(text).width) + LABEL_PAD * 2
  canvas.height = LABEL_PX + LABEL_PAD * 2

  ctx.font = font
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  // The dark halo, stroked under the fill. It is what keeps "D9" readable
  // against white silkscreen and pale sky alike.
  ctx.strokeStyle = '#1b232c'
  ctx.lineWidth = LABEL_PX * 0.28
  ctx.strokeText(text, canvas.width / 2, canvas.height / 2)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(text, canvas.width / 2, canvas.height / 2)

  const texture = new THREE.CanvasTexture(canvas)
  // A colour map, unlike the vertex colours elsewhere in this project: three
  // converts sRGB textures to linear when sampling, so the authored values
  // come out as authored.
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  labelCache.set(text, texture)
  return texture
}

/**
 * The pin's name, floating just above it.
 *
 * The point of this is that a student sees "D9" *before* letting go, not after
 * — committing to a pin you cannot read is guesswork. It faces the camera from
 * any angle and draws on top of everything (depthTest off) so the board itself
 * cannot hide the label for the pin you are aiming at.
 *
 * It is a canvas texture on a sprite, and NOT drei's <Text>, for a measured
 * reason. <Text> is troika, and troika resolves fonts by fetching Unicode
 * metadata from a CDN the first time it lays out a string — while drei's
 * wrapper suspends until that resolves. This app ships as one HTML file opened
 * over file://, where Chrome blocks fetch() outright, and Wiring
 * renders inside Scene's <Suspense fallback={null}>. So the first hover over a
 * pin suspended the entire 3D scene: terrain, build and every pin dot vanished,
 * leaving a blank blue canvas for as long as a lead was held. With nothing left
 * to raycast against, a drag could never land on the pin it was aimed at —
 * which is what the "harness and snapper disagree by ~45 px" report really was.
 *
 * A sprite is billboarded by definition, so there is no <Billboard> either, and
 * dropping both imports takes troika out of the bundle entirely.
 */
function PinLabel({ text }) {
  const texture = useMemo(() => labelTexture(text), [text])
  const { width, height } = texture.image
  return (
    <sprite
      position={[0, 0.26, 0]}
      scale={[(LABEL_EM * width) / LABEL_PX, (LABEL_EM * height) / LABEL_PX, 1]}
      renderOrder={10}
      // Decoration only. Without this the label sits between the camera and the
      // pin it names, and a sprite is raycastable — the one thing a label for a
      // grab target must never do is become a grab target.
      raycast={() => null}
    >
      <spriteMaterial
        map={texture}
        transparent
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </sprite>
  )
}

const dotColour = (t) =>
  t.type === 'vcc' ? WIRE_COLOUR.vcc : t.type === 'gnd' ? '#6b7280' : WIRE_COLOUR.sensor

/**
 * The lead in flight.
 *
 * Its far end follows the pointer across a horizontal plane at the anchor's
 * height, which is the one projection that behaves predictably from any camera
 * angle: a ray-to-plane intersection cannot fall behind the camera or shoot to
 * infinity the way a free 3D projection does near grazing angles.
 *
 * When the pointer is over a legal terminal the wire snaps to it instead, so
 * the preview shows exactly what committing would produce.
 */
function LiveWire({ terminals, clearance }) {
  const wiring = useBuildStore((s) => s.wiring)
  const drag = useBuildStore((s) => s.dragWire)
  /*
   * Terminal positions are in BUILD space; the camera's ray is in world space.
   * The whole build is rendered inside a group raised by buildLift(), so the
   * two differ by exactly that much in Y. Without it the ray was compared
   * against points sitting a wheel-radius below where they are drawn, and a
   * lead aimed at D9 snapped to whatever the ray happened to pass near on the
   * far side of the board — IOREF, every time.
   */
  const lift = useBuildStore((s) => s.buildLift())
  const { camera, pointer } = useThree()
  const [tip, setTip] = useState(null)
  const plane = useRef(new THREE.Plane())
  const ray = useRef(new THREE.Raycaster())
  const hit = useRef(new THREE.Vector3())
  const probe = useRef(new THREE.Vector3())

  const source = terminals.find(
    (t) => t.partId === wiring.from.partId && t.id === wiring.from.terminal,
  )

  useFrame(() => {
    if (!source) return
    const target = wiring.target
      ? terminals.find((t) => t.partId === wiring.target.partId && t.id === wiring.target.terminal)
      : null
    if (target) {
      setTip(target.pos)
      return
    }
    plane.current.set(new THREE.Vector3(0, 1, 0), -(source.pos[1] + lift))
    ray.current.setFromCamera(pointer, camera)
    if (!ray.current.ray.intersectPlane(plane.current, hit.current)) return
    // back into build space, which is what everything else here speaks
    const p = [hit.current.x, hit.current.y - lift, hit.current.z]

    /*
     * Snap to the nearest terminal this lead may legally reach, measured ON
     * SCREEN.
     *
     * Two earlier attempts got this wrong for instructive reasons. Comparing
     * against `p` — the cursor dropped onto a horizontal plane at the source's
     * height — snapped to whatever sat near that plane point rather than to
     * what the mouse was over, so dragging onto D9 caught IOREF. Comparing
     * against the camera ray in world space then missed the board entirely by
     * a constant, because this scene shifts the camera frustum (see
     * ViewportOffset in Scene.jsx) to keep the robot clear of the drawers.
     *
     * Screen space sidesteps both: project each candidate through the same
     * camera that drew it and compare to the pointer in the same normalised
     * coordinates the pointer is already given in. Whatever the projection
     * does, "nearest to the cursor" means the same thing to the code as it
     * does to the person looking at it.
     */
    let near = null
    let best = SNAP_NDC
    for (const t of terminals) {
      if (t.partId === source.partId && t.id === source.id) continue
      if (!canConnect(source, t)) continue
      probe.current.set(t.pos[0], t.pos[1] + lift, t.pos[2]).project(camera)
      // Behind the camera: project() wraps these round, so reject them.
      if (probe.current.z > 1) continue
      const d = Math.hypot(probe.current.x - pointer.x, probe.current.y - pointer.y)
      if (d < best) {
        best = d
        near = t
      }
    }

    setTip(near ? near.pos : p)
    const nextTarget = near ? { partId: near.partId, terminal: near.id } : null
    const sameTarget =
      (wiring.target?.partId ?? null) === (nextTarget?.partId ?? null) &&
      (wiring.target?.terminal ?? null) === (nextTarget?.terminal ?? null)
    if (!sameTarget) drag(p, nextTarget)
    else if (!wiring.cursor || dist(wiring.cursor, p) > 0.05) drag(p)
  })

  if (!source || !tip) return null
  const target = wiring.target
    ? terminals.find((t) => t.partId === wiring.target.partId && t.id === wiring.target.terminal)
    : null
  const colour = target && canConnect(source, target) ? wireColour(source, target) : '#9aa4b2'
  return <Wire from={source.pos} to={tip} colour={colour} clearance={clearance} live />
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/**
 * One lead, as a sagging tube.
 *
 * Same catenary approximation the fixed harness uses: slack scales with the
 * span and pulls the middle down, clamped well short of a real cable so it
 * does not dive through the chassis it is slung over.
 *
 * A committed lead is clickable, and clicking removes it — wires are the one
 * thing here with no other way to get rid of them, since they belong to a pair
 * of parts rather than to either one.
 */
function Wire({ id, from, to, colour, live = false, clearance = 0, livePosition = null }) {
  const remove = useBuildStore((s) => s.deleteWire)
  const [hover, setHover] = useState(false)

  if (livePosition) {
    return <FlexibleWire id={id} colour={colour} hover={hover} setHover={setHover} remove={remove} livePosition={livePosition} />
  }

  const geometry = useMemo(
    () => wireGeometry(from, to, { clearance, radius: hover ? 0.05 : 0.035 }),
    [from, to, hover, clearance],
  )
  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh
      geometry={geometry}
      castShadow={!live}
      onPointerOver={live ? undefined : (e) => (e.stopPropagation(), setHover(true))}
      onPointerOut={live ? undefined : (e) => (e.stopPropagation(), setHover(false))}
      onPointerDown={
        live
          ? undefined
          : (e) => {
              e.stopPropagation()
              if (e.button === 0) remove(id)
            }
      }
    >
      <meshBasicMaterial
        color={hover ? '#ffffff' : colour}
        toneMapped={false}
        transparent={live}
        opacity={live ? 0.85 : 1}
      />
    </mesh>
  )
}

/**
 * A live Dupont lead represented by a short chain of cylinders.
 *
 * Rebuilding a TubeGeometry for every wire on every physics frame created a
 * steady stream of allocations. One InstancedMesh keeps the same geometry and
 * only updates segment matrices as the two connected rigid bodies move. The
 * curve includes connector exits, clearance and gravity sag, so it behaves
 * like a flexible lead while remaining electrically attached at both ends.
 */
const FLEX_SEGMENTS = 14
function FlexibleWire({ id, colour, hover, setHover, remove, livePosition }) {
  const mesh = useRef()
  const lastUpdate = useRef(-1)
  const matrix = useMemo(() => new THREE.Matrix4(), [])
  const midpoint = useMemo(() => new THREE.Vector3(), [])
  const direction = useMemo(() => new THREE.Vector3(), [])
  const scale = useMemo(() => new THREE.Vector3(), [])
  const rotation = useMemo(() => new THREE.Quaternion(), [])
  const yAxis = useMemo(() => new THREE.Vector3(0, 1, 0), [])

  useFrame(({ clock }) => {
    if (!mesh.current) return
    // 30 Hz is visually continuous for a soft cable and halves the CPU work
    // of a 24-lead rover harness on school laptops.
    if (clock.elapsedTime - lastUpdate.current < 1 / 30) return
    lastUpdate.current = clock.elapsedTime
    const [from, to] = livePosition()
    const points = flexibleWireCurve(from, to).getPoints(FLEX_SEGMENTS)
    for (let i = 0; i < FLEX_SEGMENTS; i++) {
      const a = points[i]
      const b = points[i + 1]
      direction.subVectors(b, a)
      const length = Math.max(0.001, direction.length())
      midpoint.addVectors(a, b).multiplyScalar(0.5)
      rotation.setFromUnitVectors(yAxis, direction.normalize())
      scale.set(1, length, 1)
      matrix.compose(midpoint, rotation, scale)
      mesh.current.setMatrixAt(i, matrix)
    }
    mesh.current.instanceMatrix.needsUpdate = true
    rt.wireDebug[id] = { from, to, span: Math.hypot(...to.map((value, index) => value - from[index])) }
  })

  useEffect(() => () => { delete rt.wireDebug[id] }, [id])

  return (
    <instancedMesh
      ref={mesh}
      args={[null, null, FLEX_SEGMENTS]}
      castShadow
      frustumCulled={false}
      onPointerOver={(e) => (e.stopPropagation(), setHover(true))}
      onPointerOut={(e) => (e.stopPropagation(), setHover(false))}
      onPointerDown={(e) => {
        e.stopPropagation()
        if (e.button === 0) remove(id)
      }}
    >
      <cylinderGeometry args={[hover ? 0.05 : 0.035, hover ? 0.05 : 0.035, 1, 7]} />
      <meshBasicMaterial color={hover ? '#ffffff' : colour} toneMapped={false} />
    </instancedMesh>
  )
}
