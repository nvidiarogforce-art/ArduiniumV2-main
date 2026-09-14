import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useBuildStore } from '../store/useBuildStore.js'
import { candidateNodes, isElectronic, orientedBottom, partTransform, socketTransform } from '../lib/geometry.js'
import { ID, basisY, quatOf } from '../lib/orient.js'
import { CATEGORY, isMount } from '../lib/parts.js'
import { SOCKETS } from '../lib/config.js'
import { PartVisual } from './Build.jsx'
import { sfx } from '../lib/sfx.js'
import { terminalWorld } from '../lib/terminals.js'

/**
 * Carrying a part — the Blender-flavoured half of the app.
 *
 *  - the held part chases the cursor with an eased lerp rather than teleporting
 *  - R or the mouse wheel rotates it in exact 90° steps
 *  - Escape or right-click cancels and puts it back where it came from
 *  - a translucent ghost with a green ring shows the snap it would make, red
 *    if that node is already occupied
 *
 * Only nodes the part is *allowed* to use are ever shown, so a wheel simply
 * never sees a chassis hole light up.
 */
/**
 * How close the cursor must come to a snap ring, in normalised screen units,
 * for that ring to be the one being aimed at. Matches SNAP_NDC in Wiring.jsx —
 * the same question, asked about rings instead of pins.
 */
const NODE_SNAP_NDC = 0.045

export default function Placement() {
  const { camera, gl } = useThree()
  const pending = useBuildStore((s) => s.pending)
  const movePending = useBuildStore((s) => s.movePending)
  const commitPlace = useBuildStore((s) => s.commitPlace)
  const cancelPlace = useBuildStore((s) => s.cancelPlace)
  const rotatePending = useBuildStore((s) => s.rotatePending)
  const lift = useBuildStore((s) => s.buildLift())

  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const probe = useMemo(() => new THREE.Vector3(), [])
  const lastPointer = useRef(null)
  const holding = Boolean(pending)
  const carryY = useBuildStore((s) => s.pending?.carryY ?? 0)
  // The cursor is projected onto the *build* plane, which floats with the
  // assembly, not onto the floor — otherwise the ghost drifts under the mouse
  // as soon as the robot is standing on its wheels. Q/E raise the carried
  // part, and the plane rises with it so the cursor still means "here".
  const planeY = carryY + (pending && !isMount(pending.kind) && !isElectronic(pending.kind)
    ? -orientedBottom(pending.kind, pending.rot ?? ID) : 0)
  const plane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), -(lift + planeY)),
    [lift, planeY],
  )

  useEffect(() => {
    if (!holding) return
    const ndc = new THREE.Vector2()
    const hit = new THREE.Vector3()


    const onMove = (e) => {
      if (e.target && e.target !== gl.domElement) return
      lastPointer.current = { clientX: e.clientX, clientY: e.clientY }
      const rect = gl.domElement.getBoundingClientRect()
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(ndc, camera)
      if (raycaster.ray.intersectPlane(plane, hit)) {
        movePending([hit.x, carryY, hit.z], nearestNodeOnScreen(ndc))
      }
    }

    /**
     * Which snap node the cursor is nearest to ON SCREEN.
     *
     * The cursor is projected onto a horizontal plane, so the point handed to
     * the store carries no height — and an upright post's holes differ ONLY in
     * height. On screen they do not: they are drawn a good distance apart, and
     * the student is aiming at one of them with their eyes. Comparing there is
     * the only comparison that matches what they are doing.
     *
     * Only the store's X/Z fallback runs when this returns null, so nothing
     * that already worked depends on this succeeding.
     */
    function nearestNodeOnScreen(cursor) {
      const state = useBuildStore.getState()
      const held = state.pending
      if (!held || isElectronic(held.kind)) return null
      const nodes = candidateNodes(held.kind, state.parts, () => false)
      let best = null
      for (const n of nodes) {
        probe.set(n.pos[0], n.pos[1] + lift, n.pos[2]).project(camera)
        if (probe.z < -1 || probe.z > 1) continue // behind the camera; project() wraps these round
        const d = Math.hypot(probe.x - cursor.x, probe.y - cursor.y)
        if (d < NODE_SNAP_NDC && (!best || d < best.d)) {
          best = { d, partId: n.partId, index: n.index }
        }
      }
      return best && { partId: best.partId, index: best.index }
    }

    const onDown = (e) => {
      // Only clicks on the canvas count. This guard used to sit below the
      // right-click branch, so right-clicking inside a side panel while
      // carrying a part dropped it.
      if (e.target !== gl.domElement) return
      if (e.button === 2) {
        // Right-click cancels, exactly like Blender.
        e.preventDefault()
        cancelPlace()
        sfx.deny()
        return
      }
      if (e.button !== 0) return
      onMove(e)
      const before = useBuildStore.getState().pending
      commitPlace()
      if (before && !useBuildStore.getState().pending) sfx.snap()
      else sfx.deny()
    }

    const onWheel = (e) => {
      // Scroll to spin the held part; the camera keeps the wheel otherwise.
      e.preventDefault()
      rotatePending(e.deltaY > 0 ? 1 : -1)
      sfx.click()
    }

    const onContext = (e) => e.preventDefault()

    // E/Q and a change of resting height move the projection plane. Reproject
    // the remembered pointer immediately; waiting for mouse motion left the
    // hint at stale X/Z and made keyboard-only lifting snap unpredictably.
    if (lastPointer.current) onMove(lastPointer.current)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('contextmenu', onContext)
    gl.domElement.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('contextmenu', onContext)
      gl.domElement.removeEventListener('wheel', onWheel)
    }
  }, [holding, camera, gl, movePending, commitPlace, cancelPlace, rotatePending, raycaster, plane, probe, lift, carryY])

  if (!pending) return null
  return (
    // Same floating frame the static build uses, so the ghost and the snap
    // rings line up with the parts they are about to join.
    <group position={[0, lift, 0]}>
      <NodeMarkers pending={pending} />
      <SocketMarkers pending={pending} />
      <BreadboardMarkers pending={pending} />
      <Ghost pending={pending} lift={lift} />
    </group>
  )
}

/* ------------------------------------------------------------------ ghost */

function Ghost({ pending, lift = 0 }) {
  const group = useRef()
  const parts = useBuildStore((s) => s.parts)
  const target = useRef(new THREE.Vector3())
  const targetQuat = useRef(new THREE.Quaternion())

  useFrame((_, delta) => {
    if (!group.current) return
    const snapped = (!!pending.snap && !pending.snap.blocked) || (!!pending.footprint && !pending.footprint.blocked)
    target.current.set(
      pending.pos[0],
      (pending.y ?? 0.1) + (snapped ? 0 : 0.3),
      pending.pos[2],
    )
    // Eased chase rather than a teleport — the thing the spec calls fluid.
    const k = 1 - Math.exp(-18 * delta)
    group.current.position.lerp(target.current, k)
    // The ghost previews the orientation the part will really commit with:
    // the chain's own frame when snapped to a mount node, the held part's
    // otherwise. (snap.orient is what fixed the old preview showing a motor
    // along +X and then committing it along the host's outboard axis.)
    const q = quatOf(pending.snap?.orient ?? pending.rot ?? ID)
    targetQuat.current.set(q[0], q[1], q[2], q[3])
    group.current.quaternion.slerp(targetQuat.current, k)
  })

  if (isElectronic(pending.kind)) return null
  const fake = { id: '__ghost__', kind: pending.kind, pos: [0, 0, 0], y: 0, rotY: 0, pin: null }

  return (
    <group ref={group}>
      <PartVisual part={fake} parts={parts} selectedId="__ghost__" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -(pending.y ?? 0) - lift + 0.02, 0]}>
        <circleGeometry args={[0.5, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.14} depthWrite={false} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------ snap markers */

const CATEGORY_COLOUR = {
  [CATEGORY.HOLE]: '#79c79a',
  [CATEGORY.SEAT]: '#7fc8f5',
  [CATEGORY.SHAFT]: '#f2a03d',
}

function NodeMarkers({ pending }) {
  const parts = useBuildStore((s) => s.parts)
  const isNodeTaken = useBuildStore((s) => s.isNodeTaken)
  const pulse = useRef()

  useFrame(({ clock }) => {
    if (pulse.current) pulse.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 7) * 0.16)
  })

  const nodes = useMemo(
    () => (isElectronic(pending.kind) || pending.placement === 'breadboard' ? [] : candidateNodes(pending.kind, parts, () => false)),
    [pending.kind, pending.placement, parts],
  )

  return (
    <group>
      {nodes.map((n) => {
        const taken = isNodeTaken(n.partId, n.index, n.category)
        const active =
          pending.snap && pending.snap.hostId === n.partId && pending.snap.index === n.index
        /*
         * The ring lies in the plane of the hole it marks: its normal is the
         * node's real axis. The old two-pose special-case (flat-up, or yawed
         * sideways for shafts) stopped being enough the moment a strip could
         * stand on its side and offer holes pointing along X or Z.
         */
        const quat = new THREE.Quaternion().setFromUnitVectors(
          RING_NORMAL,
          new THREE.Vector3(n.axis[0], n.axis[1], n.axis[2]),
        )
        const off = n.category === CATEGORY.HOLE ? 0.12 : 0
        return (
          <group
            key={`${n.partId}:${n.category}:${n.index}`}
            position={[
              n.pos[0] + n.axis[0] * off,
              n.pos[1] + n.axis[1] * off,
              n.pos[2] + n.axis[2] * off,
            ]}
            quaternion={quat}
          >
            <mesh ref={active ? pulse : undefined}>
              <ringGeometry args={[0.15, active ? 0.27 : 0.2, 20]} />
              <meshBasicMaterial
                color={taken ? '#e0574a' : active ? '#2fb673' : CATEGORY_COLOUR[n.category]}
                transparent
                opacity={active ? 0.95 : taken ? 0.5 : 0.38}
                depthWrite={false}
                depthTest={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

/** ringGeometry lies in the XY plane — its normal is +Z. */
const RING_NORMAL = new THREE.Vector3(0, 0, 1)

function BreadboardMarkers({ pending }) {
  const parts = useBuildStore((s) => s.parts)
  const footprint = pending.footprint
  if (pending.placement !== 'breadboard' || !footprint) return null
  const board = parts[footprint.breadboardId]
  const transform = board && partTransform(board, parts)
  if (!transform) return null
  const quat = new THREE.Quaternion().setFromUnitVectors(
    RING_NORMAL,
    new THREE.Vector3(...basisY(transform.orient)),
  )
  return Object.values(footprint.holes).map((hole) => {
    const pos = terminalWorld(board, hole, parts)
    return pos ? (
      <mesh key={hole} position={pos} quaternion={quat}>
        <ringGeometry args={[0.035, 0.066, 14]} />
        <meshBasicMaterial color="#2fb673" transparent opacity={0.96} depthWrite={false} depthTest={false} side={THREE.DoubleSide} />
      </mesh>
    ) : null
  })
}

function SocketMarkers({ pending }) {
  const parts = useBuildStore((s) => s.parts)
  const board = useMemo(() => Object.values(parts).find((p) => p.kind === 'board'), [parts])
  const used = useMemo(
    () => new Set(Object.values(parts).map((p) => p.socket).filter(Boolean)),
    [parts],
  )
  const pulse = useRef()
  useFrame(({ clock }) => {
    if (pulse.current) pulse.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 7) * 0.18)
  })

  if (!isElectronic(pending.kind) || !board) return null

  return (
    <group>
      {SOCKETS.map((socket) => {
        if (used.has(socket.id)) return null
        const t = socketTransform(board, socket.id)
        const active = pending.socket === socket.id
        return (
          <mesh
            key={socket.id}
            ref={active ? pulse : undefined}
            position={[t.pos[0], t.pos[1] + 0.02, t.pos[2]]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[0.18, active ? 0.3 : 0.24, 22]} />
            <meshBasicMaterial
              color={active ? '#2fb673' : '#79c79a'}
              transparent
              opacity={active ? 0.95 : 0.4}
              depthWrite={false}
              depthTest={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        )
      })}
    </group>
  )
}
