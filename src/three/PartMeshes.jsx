import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Toon } from '../lib/toon.jsx'
import { getStripGeometry, getDeckGeometry } from '../lib/stripGeometry.js'
import { holeCount, localHole } from '../lib/geometry.js'
import { mountHoles } from '../lib/parts.js'
import { rt } from './runtime.js'
import { LED_SPECS } from '../lib/electronics.js'
import { BOLT, C, CASTER, LBRACKET, MOUNT, STANDOFF, STRIP_T, UPRIGHT, WHEEL } from '../lib/config.js'
import {
  getGearGeometry,
  getGripperJawGeometry,
  getGripperPalmGeometry,
  getPlate3x5Geometry,
  getTurntableGeometry,
} from '../lib/mechanicalGeometry.js'

/* ============================================================ construction */

/** A perforated metal strip. Geometry is cut once and shared (see stripGeometry). */
export function StripMesh({ kind, selected }) {
  const geometry = useMemo(() => getStripGeometry(holeCount(kind)), [kind])
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <Toon
        color={selected ? '#6ea8f0' : C.strip}
        xray
        emissive={selected ? '#2f6fd9' : '#000000'}
        emissiveIntensity={selected ? 0.5 : 0}
      />
    </mesh>
  )
}

export function Plate3x5Mesh({ selected }) {
  return <mesh geometry={getPlate3x5Geometry()} castShadow receiveShadow>
    <Toon color={selected ? '#6ea8f0' : C.strip} xray />
  </mesh>
}

export function TurntableMesh({ kind, selected }) {
  const base = kind === 'turntableBase'
  return <group>
    <mesh geometry={getTurntableGeometry(kind)} castShadow receiveShadow>
      <Toon color={selected ? '#f3bd62' : base ? '#2f6fd9' : '#e5a62f'} xray />
    </mesh>
    <mesh position={[0, STRIP_T * 0.75, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[base ? 0.76 : 0.62, 0.035, 8, 32]} />
      <Toon color="#aeb8c2" outline={false} />
    </mesh>
  </group>
}

export function GearMesh({ kind, selected }) {
  return <mesh geometry={getGearGeometry(kind)} castShadow receiveShadow>
    <Toon color={selected ? '#ffe08a' : kind === 'gearLarge' ? '#e7b13c' : '#394550'} xray />
  </mesh>
}

export function GripperPalmMesh({ selected }) {
  return <mesh geometry={getGripperPalmGeometry()} castShadow receiveShadow>
    <Toon color={selected ? '#6ea8f0' : '#3d7fd5'} xray />
  </mesh>
}

export function GripperJawMesh({ kind, selected }) {
  return <mesh geometry={getGripperJawGeometry(kind)} castShadow receiveShadow>
    <Toon color={selected ? '#f7d37b' : '#d2a23c'} xray />
  </mesh>
}

/** Bolt head above, nut below — drawn at every occupied hole. */
export function BoltMesh({ y = 0 }) {
  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, STRIP_T / 2 + BOLT.headH / 2, 0]}>
        <cylinderGeometry args={[BOLT.headR, BOLT.headR, BOLT.headH, 6]} />
        <Toon color={C.bolt} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[BOLT.shaftR, BOLT.shaftR, STRIP_T * 2.4, 10]} />
        <Toon color={C.bolt} outline={false} />
      </mesh>
      <mesh position={[0, -STRIP_T / 2 - BOLT.nutH / 2 - 0.04, 0]}>
        <cylinderGeometry args={[BOLT.nutR, BOLT.nutR, BOLT.nutH, 6]} />
        <Toon color={C.nut} />
      </mesh>
    </group>
  )
}

/**
 * A wheel: rubber tyre plus a bright hub so its rotation is obvious.
 * Its axle runs along local X, which is what the revolute joint expects.
 */
export function WheelMesh({ selected, driven }) {
  return (
    <group rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow>
        <cylinderGeometry args={[WHEEL.radius, WHEEL.radius, WHEEL.width, 28]} />
        <Toon color={selected ? '#4a545f' : C.tyre} />
      </mesh>
      {/* tread ribs — without these a spinning wheel looks completely still */}
      {Array.from({ length: 10 }, (_, i) => (
        <mesh
          key={i}
          rotation={[0, (i / 10) * Math.PI * 2, 0]}
          position={[
            Math.cos((i / 10) * Math.PI * 2) * WHEEL.radius * 0.99,
            0,
            -Math.sin((i / 10) * Math.PI * 2) * WHEEL.radius * 0.99,
          ]}
        >
          <boxGeometry args={[0.09, WHEEL.width * 1.02, 0.16]} />
          <Toon color="#454c56" outline={false} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, (s * WHEEL.width) / 2 + s * 0.01, 0]}>
          <cylinderGeometry args={[WHEEL.hubR, WHEEL.hubR, 0.06, 16]} />
          <Toon color={driven ? '#f2a03d' : C.hub} />
        </mesh>
      ))}
      {/* one painted spoke, so you can see it turn */}
      <mesh position={[0, WHEEL.width / 2 + 0.02, WHEEL.radius * 0.45]}>
        <boxGeometry args={[0.08, 0.03, WHEEL.radius * 0.7]} />
        <Toon color="#e8e2d3" outline={false} />
      </mesh>
    </group>
  )
}

/* ============================================================= electronics */

/** 5 mm LED, revolved from a real profile, lit by whatever its pin is doing. */
export function LedMesh({ kind = 'ledRed', pins = {}, selected }) {
  const material = useRef()
  const light = useRef()
  const definition = LED_SPECS[kind] ?? LED_SPECS.ledRed

  const profile = useMemo(() => {
    const p = [new THREE.Vector2(0, 0), new THREE.Vector2(0.19, 0)]
    p.push(new THREE.Vector2(0.19, 0.05), new THREE.Vector2(0.15, 0.07))
    p.push(new THREE.Vector2(0.15, 0.3))
    for (let i = 1; i <= 8; i++) {
      const a = (i / 8) * (Math.PI / 2)
      p.push(new THREE.Vector2(Math.cos(a) * 0.15, 0.3 + Math.sin(a) * 0.15))
    }
    return p
  }, [])

  useFrame(() => {
    const m = material.current
    if (!m) return
    const level = (pin) => pin == null ? 0 : Math.max(rt.pinHigh[pin] ? 1 : 0, Math.abs(rt.motorSpeed[pin] ?? 0) / 255)
    const channels = definition.rgb
      ? [level(pins.R), level(pins.G), level(pins.B)]
      : [level(pins.A), 0, 0]
    const brightness = definition.rgb ? Math.max(...channels) : channels[0]
    if (definition.rgb) {
      m.color.setRGB(0.45 + channels[0] * 0.35, 0.45 + channels[1] * 0.35, 0.45 + channels[2] * 0.35)
      m.emissive.setRGB(channels[0], channels[1], channels[2])
      if (light.current) light.current.color.setRGB(channels[0], channels[1], channels[2])
    }
    m.emissiveIntensity += ((brightness ? 2.2 : 0) - m.emissiveIntensity) * 0.3
    if (light.current) light.current.intensity = m.emissiveIntensity * 1.6
  })

  return (
    <group>
      {(definition.rgb ? [-0.12, -0.04, 0.04, 0.12] : [-0.07, 0.07]).map((x) => (
        <mesh key={x} position={[x, 0.11, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.22, 6]} />
          <Toon color="#b9bfc7" outline={false} />
        </mesh>
      ))}
      <mesh position={[0, 0.22, 0]}>
        <latheGeometry args={[profile, 20]} />
        <Toon
          materialRef={material}
          color={selected ? '#ff8b7f' : definition.colour}
          emissive={definition.emissive}
          emissiveIntensity={0}
        />
      </mesh>
      <pointLight ref={light} position={[0, 0.5, 0]} color={definition.light} intensity={0} distance={2.6} decay={2} />
    </group>
  )
}

/** Ultrasonic module: the twin-can silhouette is what makes it readable. */
export function SensorMesh({ selected }) {
  const ping = useRef()
  useFrame(({ clock }) => {
    if (!ping.current) return
    const t = (clock.elapsedTime * 1.4) % 1
    ping.current.scale.setScalar(0.2 + t * 1.6)
    ping.current.material.opacity = rt.distance > 0 ? 0.28 * (1 - t) : 0
  })

  return (
    <group>
      <mesh position={[0, 0.16, 0]}>
        <boxGeometry args={[0.72, 0.32, 0.09]} />
        <Toon color={selected ? '#3f95dd' : C.sensorBlue} />
      </mesh>
      {[-0.15, 0.15].map((x) => (
        <group key={x} position={[x, 0.2, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[0.12, 0.12, 0.12, 18]} />
            <Toon color={C.sensorCan} />
          </mesh>
          <mesh position={[0, 0.07, 0]}>
            <cylinderGeometry args={[0.093, 0.093, 0.02, 18]} />
            <Toon color="#20242b" outline={false} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.31, 0.07]}>
        <boxGeometry args={[0.16, 0.045, 0.04]} />
        <Toon color="#bcc6ce" outline={false} />
      </mesh>
      {[-0.27, 0.27].map((x) => (
        <mesh key={x} position={[x, 0.31, 0.07]}>
          <boxGeometry args={[0.07, 0.035, 0.04]} />
          <Toon color="#202831" outline={false} />
        </mesh>
      ))}
      {/* the ping ripple — pure showmanship, but it explains what a sensor does */}
      <mesh ref={ping} position={[0, 0.2, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.16, 0.2, 24]} />
        <meshBasicMaterial color="#7fd6ff" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

/**
 * DC motor. It is a structural part now: it bolts into a motor mount with its
 * shaft horizontal, and whatever wheel goes on that shaft is driven by this
 * motor's pin. Local +X is the shaft direction for the whole chain.
 */
export function MotorMesh({ pin, selected }) {
  const shaft = useRef()
  useFrame((_, delta) => {
    const speed = rt.motorSpeed[pin] ?? 0
    if (shaft.current) shaft.current.rotation.x += speed * 0.0007 * 60 * delta
  })

  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[MOUNT.motorRadius, MOUNT.motorRadius, MOUNT.motorLength, 20]} />
        <Toon color={selected ? '#b3bcc8' : C.motorBody} xray />
      </mesh>
      <mesh position={[-MOUNT.motorLength / 2 - 0.03, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[MOUNT.motorRadius * 0.96, MOUNT.motorRadius * 0.96, 0.07, 20]} />
        <Toon color={C.motorCap} />
      </mesh>
      {/* terminals, so it reads as a motor and not a tin can */}
      {[-0.09, 0.09].map((z) => (
        <mesh key={z} position={[-MOUNT.motorLength / 2 - 0.1, 0.1, z]}>
          <boxGeometry args={[0.14, 0.05, 0.05]} />
          <Toon color={C.pinGold} outline={false} />
        </mesh>
      ))}
      <group ref={shaft} position={[MOUNT.motorLength / 2 + MOUNT.shaftLength / 2, 0, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[MOUNT.shaftRadius, MOUNT.shaftRadius, MOUNT.shaftLength, 12]} />
          <Toon color="#cfd5dc" outline={false} />
        </mesh>
        <mesh position={[0.02, 0, 0]}>
          <boxGeometry args={[0.05, MOUNT.shaftRadius * 2.6, 0.05]} />
          <Toon color="#e08a3c" outline={false} />
        </mesh>
      </group>
    </group>
  )
}

/** Curved, sagging jumper wire from a component to its header pin. */
export function WireMesh({ from, to, color }) {
  const geometry = useMemo(() => {
    const a = new THREE.Vector3(...from)
    const b = new THREE.Vector3(...to)
    const bow = 0.3
    const at = (t) => {
      const p = a.clone().lerp(b, t)
      p.y += bow * Math.sin(Math.PI * t)
      return p
    }
    const curve = new THREE.CatmullRomCurve3([a, at(0.3), at(0.65), b], false, 'catmullrom', 0.4)
    return new THREE.TubeGeometry(curve, 26, 0.032, 6, false)
  }, [from, to])

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  )
}

export const COMPONENT_MESH = {
  led: LedMesh,
  sensor: SensorMesh,
}

/* ==================================================== new structural parts */

/** Perforated deck plate — a flat mounting surface with a hole grid. */
export function DeckMesh({ selected }) {
  const geometry = useMemo(() => getDeckGeometry(), [])
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <Toon color={selected ? '#6ea8f0' : C.strip} xray />
    </mesh>
  )
}

/** L-bracket: the piece that lets a flat build become a three-dimensional one. */
export function LBracketMesh({ selected }) {
  const colour = selected ? '#6ea8f0' : C.stripDark
  return (
    <group>
      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={[LBRACKET.arm, LBRACKET.thickness, LBRACKET.width]} />
        <Toon color={colour} xray />
      </mesh>
      <mesh position={[LBRACKET.arm / 2 - LBRACKET.thickness / 2, LBRACKET.arm / 2, 0]} castShadow>
        <boxGeometry args={[LBRACKET.thickness, LBRACKET.arm, LBRACKET.width]} />
        <Toon color={colour} xray />
      </mesh>
      <mesh position={[LBRACKET.arm / 2 - LBRACKET.thickness / 2, LBRACKET.arm, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, LBRACKET.thickness * 1.4, 10]} />
        <Toon color="#2b5794" outline={false} />
      </mesh>
    </group>
  )
}

/**
 * Upright post — a vertical column with a hole every PITCH up its face.
 *
 * The holes are drawn from the same `mountHoles('upright')` the snap matrix
 * reads, so the ring a student aims at and the place a part lands are the same
 * number rather than two numbers that agree until someone edits one. That is
 * exactly the mistake the L-bracket made.
 */
export function UprightMesh({ selected }) {
  const colour = selected ? '#6ea8f0' : C.stripDark
  const holes = mountHoles('upright')
  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[UPRIGHT.post, UPRIGHT.height, UPRIGHT.post]} />
        <Toon color={colour} xray />
      </mesh>
      {/* A foot, so the post reads as standing on the strip rather than
          growing out of it. */}
      <mesh position={[0, -UPRIGHT.height / 2, 0]} castShadow>
        <boxGeometry args={[UPRIGHT.post * 1.6, STRIP_T, UPRIGHT.post * 1.6]} />
        <Toon color={colour} xray />
      </mesh>
      {holes.map(([, dy], i) => (
        <mesh key={i} position={[0, dy, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.1, UPRIGHT.post * 1.3, 10]} />
          <Toon color="#2b5794" outline={false} />
        </mesh>
      ))}
    </group>
  )
}

/** Hex standoff — raises a deck or a board onto a second level. */
export function StandoffMesh({ selected }) {
  return (
    <group>
      <mesh castShadow>
        <cylinderGeometry args={[STANDOFF.radius, STANDOFF.radius, STANDOFF.height, 6]} />
        <Toon color={selected ? '#c7d2de' : '#9aa5b1'} xray />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, (s * STANDOFF.height) / 2, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.12, 8]} />
          <Toon color={C.bolt} outline={false} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * Caster ball — the free pivot that keeps a two-wheel rover upright.
 *
 * It hangs *below* the hole it bolts into, and its total drop is sized in
 * config to match a driven wheel's radius, so a rover with two wheels at the
 * back and two casters at the front stands perfectly level.
 */
export function CasterMesh({ selected }) {
  const drop = CASTER.stem + CASTER.ball
  return (
    <group>
      {/* mounting plate, flush with the underside of the strip */}
      <mesh position={[0, -0.05, 0]} castShadow>
        <boxGeometry args={[0.42, 0.1, 0.42]} />
        <Toon color={selected ? '#c7d2de' : '#8d97a3'} />
      </mesh>
      {/* stem down to the ball */}
      <mesh position={[0, -CASTER.stem / 2 - 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.13, CASTER.stem, 12]} />
        <Toon color={selected ? '#c7d2de' : '#8d97a3'} />
      </mesh>
      {/* socket cup */}
      <mesh position={[0, -CASTER.stem - 0.02, 0]} castShadow>
        <sphereGeometry args={[CASTER.ball * 1.06, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Toon color={selected ? '#c7d2de' : '#7f8994'} />
      </mesh>
      <mesh position={[0, -(drop - CASTER.ball), 0]} castShadow>
        <sphereGeometry args={[CASTER.ball, 18, 14]} />
        <Toon color="#3c444e" />
      </mesh>
    </group>
  )
}

/**
 * Motor mount (U-bracket). It bolts flat to the chassis and holds the motor
 * with its shaft horizontal — which is the whole reason a wheel ends up
 * upright and clear of the ground instead of buried in a strip.
 */
export function MotorMountMesh({ selected }) {
  const colour = selected ? '#6ea8f0' : '#4d5a68'
  const { bracketDepth: d, bracketWidth: w, bracketHeight: h } = MOUNT
  return (
    <group>
      <mesh position={[-d / 2, 0, 0]} castShadow>
        <boxGeometry args={[0.1, h, w]} />
        <Toon color={colour} xray />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 0, (s * w) / 2]} castShadow>
          <boxGeometry args={[d, h, 0.09]} />
          <Toon color={colour} xray />
        </mesh>
      ))}
      {/* the flange that laps onto the strip and takes the bolt */}
      <mesh position={[-d / 2 - 0.16, 0, 0]}>
        <boxGeometry args={[0.32, 0.11, w * 0.8]} />
        <Toon color={colour} outline={false} />
      </mesh>
    </group>
  )
}
