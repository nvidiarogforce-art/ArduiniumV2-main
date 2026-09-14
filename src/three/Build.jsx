import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Quaternion, Vector3 } from 'three'
import {
  RigidBody,
  CuboidCollider,
  CylinderCollider,
  BallCollider,
  CoefficientCombineRule,
  interactionGroups,
  useBeforePhysicsStep,
  useRevoluteJoint,
} from '@react-three/rapier'
import { driveWheels, bodyRegistry, liveBodyPoint, sensorRays } from './jointRegistry.js'
import { apply as applyOrient } from '../lib/orient.js'
import { useBuildStore } from '../store/useBuildStore.js'
import { useUiStore } from '../store/useUiStore.js'
import {
  chainTransform,
  holeCount,
  isElectronic,
  isMount,
  isStrip,
  orientOf,
  partTransform,
  quatFor,
  boltEndpoints,
} from '../lib/geometry.js'
import { quatOf } from '../lib/orient.js'
import { stripColliderArgs, deckColliderArgs } from '../lib/stripGeometry.js'
import { rt } from './runtime.js'
import { isSensor, SENSOR_SPECS, SENSOR_MODULE_SIZE } from '../lib/sensors.js'
import SensorModuleMesh, { SensorPinMarkers } from './SensorMeshes.jsx'
import KitPartMesh, { ServoHornMesh } from './KitPartMeshes.jsx'
import { COMPONENT_SPECS, isKitComponent, isLed } from '../lib/electronics.js'
import { ledConnection, motorConnection, outputConnection } from '../lib/circuits.js'
import { planAssembly } from '../lib/assembly.js'
import { BOARD, BREADBOARD, CASTER, LBRACKET, MECCANO, MOUNT, PHYSICS, STANDOFF, STRIP_T, UPRIGHT, WHEEL } from '../lib/config.js'
import {
  StripMesh,
  WheelMesh,
  BoltMesh,
  DeckMesh,
  LBracketMesh,
  StandoffMesh,
  UprightMesh,
  CasterMesh,
  MotorMountMesh,
  MotorMesh,
  LedMesh,
  SensorMesh,
  Plate3x5Mesh,
  TurntableMesh,
  GearMesh,
  GripperPalmMesh,
  GripperJawMesh,
} from './PartMeshes.jsx'
import ArduinoUnoLowPoly from './ArduinoUnoLowPoly.jsx'
import Wiring from './Wiring.jsx'
import BreadboardMesh from './BreadboardMesh.jsx'

/**
 * Group 1 is "the robot". It collides with group 0 (the world) but never with
 * itself: a bolted assembly is held together by joints, and letting its own
 * plates grind against each other only feeds the solver energy it does not
 * need. Terrain and obstacles live in group 0 and collide with everything.
 */
export const ROBOT_GROUP = interactionGroups(1, [0])
export const WORLD_GROUP = interactionGroups(0, [0, 1])

/** Yaw that points a part's local +X along a world axis. */
export const mountYaw = (axis) => Math.atan2(-axis[2], axis[0])

/**
 * Which way is *forward* for this robot, and which wheel is on which side.
 *
 * A wheel's mount axis points outboard, so the two sides of a rover have
 * opposite axes. Deriving "forward" from a single wheel's axis therefore made
 * the left and right wheels push against each other and the robot sat there
 * humming — which is exactly what happened before this function existed.
 *
 * Instead the whole assembly gets ONE frame:
 *
 *   axle    the shared axis of the driven wheels (either sign will do)
 *   forward from the driven wheels towards the rest of the chassis, with any
 *          sideways component removed. On a rear-wheel-drive rover that points
 *          at the caster end, which is the end that leads.
 *   right   forward turned 90°, used only to label each wheel left or right so
 *          that turning drives one side harder than the other.
 */
function driveFrame(wheels, members) {
  const axle3 = wheels[0].t.axis
  // Work in the ground plane. A wheel mounted on a tilted chain can have an
  // axle pointing anywhere; if the axle has no horizontal component at all
  // (the wheel is lying flat like a turntable), there is no rolling direction
  // to derive and the wheel simply isn't part of the drive.
  const axleLen = Math.hypot(axle3[0], axle3[2])
  if (axleLen < 0.3) return { centre: [0, 0, 0], forward: null, right: [1, 0, 0] }
  const axle = [axle3[0] / axleLen, 0, axle3[2] / axleLen]
  const centre = [
    wheels.reduce((s, w) => s + w.t.pos[0], 0) / wheels.length,
    0,
    wheels.reduce((s, w) => s + w.t.pos[2], 0) / wheels.length,
  ]

  // Aim away from the drive axle, towards the body of the machine.
  let fx = 0
  let fz = 0
  if (members.length > 0) {
    const bx = members.reduce((s, m) => s + m.pos[0], 0) / members.length
    const bz = members.reduce((s, m) => s + m.pos[2], 0) / members.length
    fx = bx - centre[0]
    fz = bz - centre[2]
    // Strip out anything along the axle — that direction is sideways, not ahead.
    const along = fx * axle[0] + fz * axle[2]
    fx -= along * axle[0]
    fz -= along * axle[2]
  }

  // All-wheel-drive, or a perfectly symmetric frame: no end is more "front"
  // than the other, so pick the stable perpendicular to the axle.
  const len = Math.hypot(fx, fz)
  const forward = len > 0.25 ? [fx / len, 0, fz / len] : [axle[2], 0, -axle[0]]
  return { centre, forward, right: [-forward[2], 0, forward[0]] }
}

/** A wheel is driven by the signal lead on its motor, with legacy pin fallback. */
export function drivenPin(wheel, parts, wires = []) {
  const motor = parts?.[wheel.hostId]
  if (motor?.kind !== 'motor') return null
  const connection = motorConnection(motor, parts, wires)
  return connection.ready ? connection.pin : null
}

/** Powered servo structurally coupled to this real hinge. */
export function servoActuatorForHinge(hinge, plan, parts, wires = []) {
  const leafGroup = plan.groupOf(hinge.partId)
  const candidates = []
  for (const servo of Object.values(parts)) {
    if (servo.kind !== 'servo') continue
    if (hinge.actuatorId && servo.id !== hinge.actuatorId) continue
    if (!hinge.actuatorId && servo.actuatesBolt && servo.actuatesBolt !== hinge.id) continue
    const connection = outputConnection(servo, parts, wires)
    const transform = partTransform(servo, parts)
    const rootGroup = transform?.root ? plan.groupOf(transform.root) : null
    if (!connection.ready || !transform || ![leafGroup, hinge.groupId].includes(rootGroup)) continue
    const pivot = [hinge.anchorPart.x, hinge.anchorPart.y, hinge.anchorPart.z]
    const distance = Math.hypot(...pivot.map((value, index) => value - transform.pos[index]))
    if (!hinge.actuatorId && distance > 1.35) continue
    const shaftAxis = applyOrient(transform.orient, [0, 1, 0])
    const axis = [hinge.axis.x, hinge.axis.y, hinge.axis.z]
    const alignment = shaftAxis.reduce((sum, value, index) => sum + value * axis[index], 0)
    if (Math.abs(alignment) < 0.99) continue
    candidates.push({
      servoId: servo.id,
      pin: connection.pin,
      distance,
      explicit: servo.id === hinge.actuatorId || servo.actuatesBolt === hinge.id,
      sign: alignment < 0 ? -1 : 1,
    })
  }
  return candidates.sort((a, b) => Number(b.explicit) - Number(a.explicit) || a.distance - b.distance)[0] ?? null
}

/* ---------------------------------------------------------------- visuals */

export function PartVisual({ part, parts, wires = [], components, selectedId, onPick }) {
  const selected = selectedId === part.id
  switch (part.kind) {
    case 'board':
      return <ArduinoUnoLowPoly selected={selected} />
    case 'breadboard':
      return <BreadboardMesh selected={selected} />
    case 'deck':
      return <DeckMesh selected={selected} />
    case 'plate3x5':
      return <Plate3x5Mesh selected={selected} />
    case 'turntableBase':
    case 'turntableTop':
      return <TurntableMesh kind={part.kind} selected={selected} />
    case 'gearSmall':
    case 'gearLarge':
      return <GearMesh kind={part.kind} selected={selected} />
    case 'gripperPalm':
      return <GripperPalmMesh selected={selected} />
    case 'gripperJawL':
    case 'gripperJawR':
      return <GripperJawMesh kind={part.kind} selected={selected} />
    case 'servoHorn':
      return <ServoHornMesh part={part} parts={parts} wires={wires} selected={selected} />
    case 'lbracket':
      return <LBracketMesh selected={selected} />
    case 'standoff':
      return <StandoffMesh selected={selected} />
    case 'upright':
      return <UprightMesh selected={selected} />
    case 'caster':
      return <CasterMesh selected={selected} />
    case 'motormount':
      return <MotorMountMesh selected={selected} />
    case 'motor':
      return <MotorMesh pin={motorConnection(part, parts, wires).pin} selected={selected} />
    // Sensors are external fittings and therefore follow the same mount chain
    // as the other chassis parts.
    case 'sensor':
      return <group><SensorMesh selected={selected} /><SensorPinMarkers kind="sensor" /></group>
    case 'wheel':
      return <WheelMesh selected={selected} driven={drivenPin(part, parts, wires) != null} />
    default:
      if (isLed(part.kind)) {
        const connection = ledConnection(part, parts, wires)
        return <LedMesh kind={part.kind} pins={connection.ready ? connection.pins : {}} selected={selected} />
      }
      return isKitComponent(part.kind) ? <KitPartMesh part={part} parts={parts} wires={wires} selected={selected} /> :
        isSensor(part.kind) ? <SensorModuleMesh kind={part.kind} selected={selected} /> :
        isStrip(part.kind) ? <StripMesh kind={part.kind} selected={selected} /> : null
  }
}

/** Colliders for a mounted fitting, in its own local frame. */
function MountCollider({ kind }) {
  if (kind === 'servoHorn') return <CuboidCollider args={[0.59, 0.05, 0.08]} density={0.18} friction={0.4} collisionGroups={ROBOT_GROUP} />
  if (isKitComponent(kind)) return <CuboidCollider args={(COMPONENT_SPECS[kind]?.size ?? [0.5, 0.2, 0.4]).map((n) => n / 2)} density={0.35} friction={0.4} collisionGroups={ROBOT_GROUP} />
  if (kind !== 'sensor' && isSensor(kind)) return <CuboidCollider args={SENSOR_MODULE_SIZE.map((n) => n / 2)} density={0.35} friction={0.4} collisionGroups={ROBOT_GROUP} />
  switch (kind) {
    case 'wheel':
      return (
        <group rotation={[0, 0, Math.PI / 2]}>
          <CylinderCollider
            args={[WHEEL.width / 2, WHEEL.radius]}
            friction={PHYSICS.wheelFriction}
            frictionCombineRule={CoefficientCombineRule.Min}
            density={2}
            collisionGroups={ROBOT_GROUP}
          />
        </group>
      )
    case 'caster':
      return (
        <group position={[0, -CASTER.stem, 0]}>
          <BallCollider
            args={[CASTER.ball]}
            friction={0.04}
            frictionCombineRule={CoefficientCombineRule.Min}
            density={1}
            collisionGroups={ROBOT_GROUP}
          />
        </group>
      )
    case 'motor':
      return (
        <group rotation={[0, 0, Math.PI / 2]}>
          <CylinderCollider
            args={[MOUNT.motorLength / 2, MOUNT.motorRadius]}
            friction={0.4}
            density={1.4}
            collisionGroups={ROBOT_GROUP}
          />
        </group>
      )
    case 'motormount':
      return (
        <CuboidCollider
          args={[MOUNT.bracketDepth / 2, MOUNT.bracketHeight / 2, MOUNT.bracketWidth / 2]}
          friction={0.5}
          density={1}
          collisionGroups={ROBOT_GROUP}
        />
      )
    case 'standoff':
      return (
        <CylinderCollider
          args={[STANDOFF.height / 2, STANDOFF.radius]}
          friction={0.5}
          density={1}
          collisionGroups={ROBOT_GROUP}
        />
      )
    case 'upright':
      return (
        <CuboidCollider
          args={[UPRIGHT.post / 2, UPRIGHT.height / 2, UPRIGHT.post / 2]}
          friction={0.5}
          // Light for its size on purpose: a mast is thin-walled aluminium, and
          // giving it the density of a solid block puts the centre of mass of a
          // small rover well above its wheels and tips it over on the first turn.
          density={0.4}
          collisionGroups={ROBOT_GROUP}
        />
      )
    case 'lbracket':
      // Two boxes matching the two slabs LBracketMesh draws. The old single
      // box was a 1×1 block whose bottom sat 0.25 below the strip — buildLift
      // read the mesh's numbers, so the build spawned intersecting the floor —
      // and whose top stopped at 0.75, leaving the arm's last quarter with no
      // collision at all.
      return (
        <>
          <group>
            <CuboidCollider
              args={[LBRACKET.arm / 2, LBRACKET.thickness / 2, LBRACKET.width / 2]}
              friction={0.5}
              density={1}
              collisionGroups={ROBOT_GROUP}
            />
          </group>
          <group
            position={[LBRACKET.arm / 2 - LBRACKET.thickness / 2, LBRACKET.arm / 2, 0]}
          >
            <CuboidCollider
              args={[LBRACKET.thickness / 2, LBRACKET.arm / 2, LBRACKET.width / 2]}
              friction={0.5}
              density={1}
              collisionGroups={ROBOT_GROUP}
            />
          </group>
        </>
      )
    default:
      return null
  }
}

function flatColliderArgs(kind) {
  if (kind === 'board') return [BOARD.width / 2, BOARD.thickness / 2, BOARD.depth / 2]
  if (kind === 'breadboard') return [BREADBOARD.width / 2, BREADBOARD.height / 2, BREADBOARD.depth / 2]
  if (kind === 'plate3x5') return [1.25, STRIP_T / 2, 0.75]
  if (kind === 'gripperPalm') return [MECCANO.gripperPalm[0] / 2, STRIP_T / 2, MECCANO.gripperPalm[1] / 2]
  if (kind === 'gripperJawL' || kind === 'gripperJawR') return [MECCANO.gripperJawLength / 2, STRIP_T / 2, MECCANO.gripperJawWidth / 2]
  if (kind === 'deck') return deckColliderArgs()
  return stripColliderArgs(holeCount(kind))
}

function FlatCollider({ kind }) {
  if (kind === 'turntableBase' || kind === 'turntableTop') {
    const radius = kind === 'turntableBase' ? MECCANO.turntableBaseRadius : MECCANO.turntableTopRadius
    return <CylinderCollider args={[MECCANO.turntableThickness / 2, radius]} friction={PHYSICS.stripFriction} density={1.4} collisionGroups={ROBOT_GROUP} />
  }
  if (kind === 'gearSmall' || kind === 'gearLarge') {
    const radius = kind === 'gearLarge' ? MECCANO.gearLargeRadius : MECCANO.gearSmallRadius
    return <CylinderCollider args={[MECCANO.gearThickness / 2, radius]} friction={PHYSICS.stripFriction} density={0.8} collisionGroups={ROBOT_GROUP} />
  }
  return <CuboidCollider
    args={flatColliderArgs(kind)}
    friction={PHYSICS.stripFriction}
    density={kind === 'board' ? 0.9 : kind === 'breadboard' ? 0.35 : 1.6}
    collisionGroups={ROBOT_GROUP}
  />
}

/** Flat and raised fitting holes share one validated position/axis source. */
function AssemblyBolt({ bolt, parts }) {
  const ends = boltEndpoints(parts, bolt)
  if (!ends) return null
  const { a, b } = ends
  const along = b.pos.reduce((sum, n, i) => sum + (n - a.pos[i]) * a.axis[i], 0)
  const upper = along > 0 ? b : a
  const pos = upper.pos.map((n, i) => n + a.axis[i] * (upper.thickness - STRIP_T / 2))
  const rotation = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(...a.axis)).toArray()
  return <group position={pos} quaternion={rotation}><BoltMesh /></group>
}

/* ------------------------------------------------------ frozen build (idle) */

export function StaticBuild() {
  const parts = useBuildStore((s) => s.parts)
  const order = useBuildStore((s) => s.order)
  const bolts = useBuildStore((s) => s.bolts)
  const wires = useBuildStore((s) => s.wires)
  const selected = useBuildStore((s) => s.selected)
  const pickUp = useBuildStore((s) => s.pickUpPart)
  const select = useBuildStore((s) => s.select)
  const lift = useBuildStore((s) => s.buildLift())

  const components = order.map((id) => parts[id]).filter((p) => p && isElectronic(p.kind))

  return (
    <group position={[0, lift, 0]}>
      {/* Jumper leads belong to the pair of terminals they join. */}
      <Wiring parts={parts} />

      {order.map((id) => {
        const part = parts[id]
        if (!part || isElectronic(part.kind)) return null
        const t = partTransform(part, parts)
        if (!t) return null
        return (
          <group
            key={id}
            position={t.pos}
            quaternion={quatFor(t)}
            onPointerDown={(e) => {
              /*
               * In wiring mode the pin dots own the pointer. A terminal sits
               * ON its part — a motor's tags against the bracket, a board pin
               * against the header — so the part's own mesh is often the
               * nearer raycast hit, and stopping propagation here would
               * swallow the press the dot was waiting for.
               */
              if (useUiStore.getState().wireMode) return
              e.stopPropagation()
              // Blender-style: a click selects; clicking an already-selected
              // part picks it back up for re-placement.
              if (selected === id && e.button === 0) pickUp(id)
              else select(id)
            }}
          >
            <PartVisual
              part={part}
              parts={parts}
              components={components}
              wires={wires}
              selectedId={selected}
              onPick={select}
            />
          </group>
        )
      })}

      {bolts.map((bolt) => <AssemblyBolt key={bolt.id} bolt={bolt} parts={parts} />)}
    </group>
  )
}

/* --------------------------------------------------- simulated build (Run) */

export function PhysicsBuild() {
  const parts = useBuildStore((s) => s.parts)
  const order = useBuildStore((s) => s.order)
  const bolts = useBuildStore((s) => s.bolts)
  const wires = useBuildStore((s) => s.wires)
  const selected = useBuildStore((s) => s.selected)
  const lift = useBuildStore((s) => Object.values(s.parts).some((part) => part.anchored) ? s.buildLift() : s.liftForRun())

  const bodies = useRef(new Map())
  const [stage, setStage] = useState(0)
  useEffect(() => {
    const raf1 = requestAnimationFrame(() => setStage(1))
    return () => {
      cancelAnimationFrame(raf1)
    }
  }, [])
  // GroupBody registers its Rapier ref in a child layout effect. Advance to
  // the joint pass in the same paint cycle, before the independent physics
  // clock can step a set of disconnected arm pieces under gravity.
  useLayoutEffect(() => {
    if (stage === 1) setStage(2)
  }, [stage])
  useEffect(
    () => () => {
      driveWheels.clear()
      sensorRays.clear()
    },
    [],
  )

  const components = order.map((id) => parts[id]).filter((p) => p && isElectronic(p.kind))
  const plan = useMemo(() => planAssembly(parts, bolts), [parts, bolts])
  // Stable arrays keep a selection/highlight render from tearing down wheel
  // registrations and silently resetting cumulative encoder rotation.
  const groupedMounts = useMemo(() => {
    const grouped = new Map(plan.groups.map((group) => [group.id, []]))
    for (const id of order) {
      const part = parts[id]
      if (!part || !isMount(part.kind)) continue
      const transform = partTransform(part, parts)
      const root = part.breadboardId ?? transform?.root
      if (transform && root) grouped.get(plan.groupOf(root))?.push(part)
    }
    return grouped
  }, [plan, parts, order])

  const liveTerminalPosition = useMemo(() => (terminal) => {
    const part = parts[terminal.partId]
    if (!part) return terminal.pos
    const transform = partTransform(part, parts)
    const root = part.breadboardId ?? transform?.root ?? part.id
    const groupId = plan.groupOf(root)
    return liveBodyPoint(groupId, terminal.pos) ?? terminal.pos
  }, [parts, plan])

  if (stage === 0) return null

  return (
    <group>
      {/* Leads live in world space during simulation. Each endpoint is
          transformed through the Rapier body that owns its terminal, so a
          moving servo/arm cannot leave its cable hanging in the old pose. */}
      <Wiring parts={parts} livePosition={liveTerminalPosition} />
      {plan.groups.map((group) => {
        const myMounts = groupedMounts.get(group.id)
        return (
          <GroupBody
            key={group.id}
            group={group}
            lift={lift}
            bodies={bodies}
            bolts={bolts}
            wires={wires}
            parts={parts}
            components={components}
            mounts={myMounts}
            selected={selected}
          />
        )
      })}

      {stage >= 2 &&
        plan.hinges.map((hinge) => {
          const refPart = bodies.current.get(plan.groupOf(hinge.partId))
          const refGroup = bodies.current.get(hinge.groupId)
          if (!refPart || !refGroup || refPart === refGroup) return null
          const actuator = servoActuatorForHinge(hinge, plan, parts, wires)
          return <HingeJoint key={hinge.id} hinge={hinge} refPart={refPart} refGroup={refGroup} actuator={actuator} />
        })}
    </group>
  )
}

function useBodyRegistration(id, bodies) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    bodies.current.set(id, ref)
    bodyRegistry.set(id, ref)
    return () => {
      bodies.current.delete(id)
      bodyRegistry.delete(id)
    }
  }, [id, bodies])
  return ref
}

/**
 * One rigid body per welded group, plus every fitting bolted onto it.
 *
 * Wheels are welded in rather than hung off joints, and the robot is driven by
 * forces applied at each driven wheel. Real forces, real friction, real
 * terrain and real differential steering — but nothing fragile enough to throw
 * the robot across the arena.
 */
function GroupBody({ group, lift, bodies, bolts, wires, parts, components, mounts, selected }) {
  const ref = useBodyRegistration(group.id, bodies)
  const anchored = group.members.some((part) => part.anchored)
  const memberIds = new Set(group.members.map((m) => m.id))
  const ownBolts = bolts.filter((bolt) => {
    const ends = boltEndpoints(parts, bolt)
    return ends && memberIds.has(ends.a.rootId) && memberIds.has(ends.b.rootId)
  })

  useEffect(() => {
    const wheels = mounts
      .filter((m) => m.kind === 'wheel')
      .map((w) => ({ part: w, t: chainTransform(w, parts) }))
      .filter((x) => x.t)
    if (wheels.length === 0) return undefined

    const frame = driveFrame(wheels, group.members)
    for (const { part, t } of wheels) {
      const connection = motorConnection(parts[part.hostId], parts, wires)
      const lateral =
        (t.pos[0] - frame.centre[0]) * frame.right[0] +
        (t.pos[2] - frame.centre[2]) * frame.right[2]
      driveWheels.set(part.id, {
        pin: connection.ready ? connection.pin : null,
        reversePin: connection.ready ? connection.reversePin : null,
        groupId: group.id,
        body: ref,
        localPos: t.pos,
        forward: frame.forward,
        side: lateral >= 0 ? 'right' : 'left',
        spin: 0,
      })
    }
    // A snapshot for the harnesses: which wheel ended up on which side, and
    // which way the frame decided "forward" points.
    rt.driveDebug = {
      forward: frame.forward,
      wheels: wheels.map(({ part, t }) => ({
        id: part.id,
        pin: drivenPin(part, parts, wires),
        reversePin: motorConnection(parts[part.hostId], parts, wires).reversePin,
        side: driveWheels.get(part.id)?.side,
        pos: t.pos,
      })),
    }
    return () => {
      for (const wheel of mounts) driveWheels.delete(wheel.id)
    }
  }, [mounts, parts, wires, group.id, group.members, ref])

  useEffect(() => {
    // Every sensing point/direction is transformed through its mount, then
    // SensorRay applies the moving body's quaternion. The WORLD filter keeps
    // the chassis out of all probes, including modules mounted under a plate.
    const sensors = mounts.filter((m) => isSensor(m.kind))
    if (sensors.length === 0) return undefined
    for (const part of sensors) {
      const t = partTransform(part, parts)
      if (!t) continue
      const spec = SENSOR_SPECS[part.kind]
      const eye = applyOrient(t.orient, spec.origin)
      // A loose wheel elsewhere in the arena cannot drive this encoder.
      const wheel = mounts.filter((m) => m.kind === 'wheel' && (!part.wheelId || part.wheelId === m.id))
        .map((m) => ({ id: m.id, t: chainTransform(m, parts) }))
        .filter((m) => m.t)
        .sort((a, b) => Math.hypot(...a.t.pos.map((n, i) => n - t.pos[i])) - Math.hypot(...b.t.pos.map((n, i) => n - t.pos[i])))[0]
      sensorRays.set(part.id, {
        kind: part.kind,
        groupId: group.id,
        wheelId: part.kind === 'encoderSensor' ? wheel?.id ?? null : null,
        body: ref,
        localPos: [t.pos[0] + eye[0], t.pos[1] + eye[1], t.pos[2] + eye[2]],
        localDir: applyOrient(t.orient, spec.direction),
        localUp: applyOrient(t.orient, [0, 1, 0]),
      })
    }
    return () => {
      for (const part of sensors) sensorRays.delete(part.id)
    }
  }, [mounts, parts, ref, group.id])

  return (
    <RigidBody
      ref={ref}
      type={anchored ? 'fixed' : 'dynamic'}
      colliders={false}
      canSleep={anchored}
      position={[0, lift, 0]}
      linearDamping={0.15}
      angularDamping={0.4}
    >
      {/* Collider transforms go on a wrapping <group>, never as props on the
          collider: props are ignored and every collider ends up piled at the
          body origin, which spawns the robot inside the terrain. */}
      {group.members.map((part) => (
        <group
          key={`c-${part.id}`}
          position={[part.pos[0], part.y, part.pos[2]]}
          quaternion={quatOf(orientOf(part))}
        >
          <FlatCollider kind={part.kind} />
        </group>
      ))}

      {mounts.map((part) => {
        const t = partTransform(part, parts)
        if (!t) return null
        return (
          <group key={`mc-${part.id}`} position={t.pos} quaternion={quatFor(t)}>
            <MountCollider kind={part.kind} />
          </group>
        )
      })}

      {group.members.map((part) => (
        <group
          key={part.id}
          position={[part.pos[0], part.y, part.pos[2]]}
          quaternion={quatOf(orientOf(part))}
        >
          <PartVisual part={part} parts={parts} wires={wires} components={components} selectedId={selected} />
        </group>
      ))}

      {mounts.map((part) => {
        const t = partTransform(part, parts)
        if (!t) return null
        return (
          <group key={part.id} position={t.pos} quaternion={quatFor(t)}>
            {part.kind === 'wheel' ? (
              <SpinningWheel
                wheelId={part.id}
                selected={selected === part.id}
                driven={drivenPin(part, parts, wires) != null}
              />
            ) : (
              <PartVisual part={part} parts={parts} wires={wires} selectedId={selected} />
            )}
          </group>
        )
      })}

      {ownBolts.map((bolt) => <AssemblyBolt key={bolt.id} bolt={bolt} parts={parts} />)}
    </RigidBody>
  )
}

/** The wheel mesh, turned by however far the robot has actually travelled. */
function SpinningWheel({ wheelId, selected, driven }) {
  const spin = useRef()
  useFrame(() => {
    const entry = driveWheels.get(wheelId)
    if (spin.current && entry) spin.current.rotation.x = entry.spin
  })
  return (
    <group ref={spin}>
      <WheelMesh selected={selected} driven={driven} />
    </group>
  )
}

/**
 * A part held by a single bolt really can swing, so it gets a real revolute
 * joint. A one-bolt part is always a leaf, so these joints can never form a
 * loop — which is exactly why the assembly stays stable.
 */
function HingeJoint({ hinge, refPart, refGroup, actuator = null }) {
  const params = useMemo(
    () => [hinge.anchorPart, hinge.anchorGroup, hinge.axis ?? { x: 0, y: 1, z: 0 }],
    [hinge],
  )
  const joint = useRevoluteJoint(refPart, refGroup, params)
  const initialized = useRef(false)
  // Servo control belongs to the fixed physics clock, not the render clock.
  // On a slow GPU several Rapier steps can happen between rendered frames;
  // driving the joint from useFrame let gravity act while the motor slept.
  useBeforePhysicsStep(() => {
    if (!joint.current) return
    if (!initialized.current) {
      joint.current.setLimits(-Math.PI * 0.72, Math.PI * 0.72)
      initialized.current = true
    }
    if (!actuator) {
      rt.jointDebug[hinge.id] = { actuator: null, angle: joint.current.angle?.() ?? null }
      return
    }
    const angle = rt.servoAngle[actuator.pin]
    const raw = angle == null
      ? rt.motorSpeed[actuator.pin] ?? (rt.pinHigh[actuator.pin] ? 255 : 0)
      : (Math.max(0, Math.min(180, angle)) - 90) * 255 / 90
    const normalized = Math.max(-255, Math.min(255, raw)) / 255
    // Micro servos actively hold their commanded angle. The earlier gains
    // were weak enough for a long aluminium boom to win against the motor
    // before the student's program started, making the arm collapse on Run.
    const target = normalized * Math.PI * 0.62 * actuator.sign
    joint.current.configureMotorPosition(target, 560, 62)
    rt.jointDebug[hinge.id] = {
      actuator: actuator.servoId,
      pin: actuator.pin,
      target,
      angle: joint.current.angle?.() ?? null,
    }
  })
  useEffect(() => () => { delete rt.jointDebug[hinge.id] }, [hinge.id])
  return null
}
