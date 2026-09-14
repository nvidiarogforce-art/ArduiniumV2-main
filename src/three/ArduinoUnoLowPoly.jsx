import { useMemo } from 'react'
import * as THREE from 'three'
import { Toon } from '../lib/toon.jsx'
import {
  BOARD,
  BOARD_HOLES,
  C,
  DIGITAL_HEADER,
  HEADER_Z,
  POWER_HEADER,
  POWER_Z,
} from '../lib/config.js'

const T = BOARD.thickness
const TOP = T / 2

/**
 * Authored low-poly Arduino Uno Rev3, based on the supplied top-view pinout.
 * Only hardware that belongs to the Uno is included. External LEDs and
 * sensors remain independent parts connected through the real header pins.
 */
export default function ArduinoUnoLowPoly({ selected = false }) {
  const geometry = useMemo(() => makeBoardGeometry(), [])

  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow>
        <Toon
          color={selected ? '#159aa5' : C.pcb}
          emissive={selected ? '#08727c' : '#000000'}
          emissiveIntensity={selected ? 0.42 : 0}
        />
      </mesh>

      <BoardSilkscreen />
      <UsbPort />
      <PowerJack />
      <HeaderBlock pins={DIGITAL_HEADER.slice(0, 10)} z={HEADER_Z} />
      <HeaderBlock pins={DIGITAL_HEADER.slice(10)} z={HEADER_Z} />
      <HeaderBlock pins={POWER_HEADER.slice(0, 8)} z={POWER_Z} />
      <HeaderBlock pins={POWER_HEADER.slice(8)} z={POWER_Z} />
      <DipChip />
      <UsbController />
      <Crystal />
      <ResetButton />
      <IcspHeader position={[0.95, TOP + 0.12, 0.42]} />
      <IcspHeader position={[0.72, TOP + 0.1, -0.68]} scale={0.82} />
      <PowerStage />
      <OnboardIndicators />

      {BOARD_HOLES.map((hole, index) => (
        <mesh
          key={index}
          position={[hole.x, TOP + 0.006, hole.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.1, 0.135, 8]} />
          <Toon color="#d6dee3" outline={false} />
        </mesh>
      ))}
    </group>
  )
}

/** Actual Uno outline with a clipped corner and four through-holes. */
function makeBoardGeometry() {
  const x = BOARD.width / 2
  const z = BOARD.depth / 2
  const cut = 0.22
  const shape = new THREE.Shape()
  shape.moveTo(-x + 0.08, -z)
  shape.lineTo(x - cut, -z)
  shape.lineTo(x, -z + cut)
  shape.lineTo(x, z - 0.08)
  shape.lineTo(x - 0.08, z)
  shape.lineTo(-x + 0.08, z)
  shape.lineTo(-x, z - 0.08)
  shape.lineTo(-x, -z + 0.08)
  shape.closePath()

  for (const hole of BOARD_HOLES) {
    const path = new THREE.Path()
    path.absarc(hole.x, hole.z, 0.1, 0, Math.PI * 2, false)
    shape.holes.push(path)
  }

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: T,
    bevelEnabled: false,
    curveSegments: 8,
    steps: 1,
  })
  geometry.rotateX(Math.PI / 2)
  geometry.translate(0, TOP, 0)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

function Box({ position, size, color, rotation, castShadow = true }) {
  return (
    <mesh position={position} rotation={rotation} castShadow={castShadow}>
      <boxGeometry args={size} />
      <Toon color={color} />
    </mesh>
  )
}

function UsbPort() {
  return (
    <group position={[-1.28, TOP + 0.17, 0.55]}>
      <Box position={[0, 0, 0]} size={[0.62, 0.34, 0.5]} color="#aeb7c1" />
      <Box position={[-0.315, 0.015, 0]} size={[0.025, 0.2, 0.32]} color="#333b44" />
      <Box position={[-0.33, 0.015, 0]} size={[0.02, 0.1, 0.2]} color="#151b21" />
      {[-1, 1].map((side) => (
        <Box key={side} position={[-0.05, 0.18, side * 0.2]} size={[0.36, 0.025, 0.035]} color="#d8dfe4" />
      ))}
    </group>
  )
}

function PowerJack() {
  return (
    <group position={[-1.23, TOP + 0.19, -0.55]} rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.23, 0.23, 0.52, 10]} />
        <Toon color="#171c22" />
      </mesh>
      <mesh position={[0, -0.27, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.025, 10]} />
        <Toon color="#06090c" outline={false} />
      </mesh>
      <mesh position={[0, -0.285, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 0.03, 8]} />
        <Toon color="#b8a267" outline={false} />
      </mesh>
    </group>
  )
}

function HeaderBlock({ pins, z }) {
  if (!pins.length) return null
  const first = pins[0].x
  const last = pins.at(-1).x
  const width = Math.abs(last - first) + 0.1
  const centre = (first + last) / 2
  return (
    <group>
      <Box position={[centre, TOP + 0.15, z]} size={[width, 0.3, 0.17]} color={C.header} />
      {pins.map((pin) => (
        <group key={pin.id} position={[pin.x, TOP + 0.325, z]}>
          <mesh>
            <boxGeometry args={[0.064, 0.018, 0.072]} />
            <Toon color="#10151a" outline={false} />
          </mesh>
          <mesh position={[0, 0.012, 0]}>
            <boxGeometry args={[0.025, 0.012, 0.028]} />
            <Toon color={C.pinGold} outline={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function DipChip() {
  const pins = Array.from({ length: 14 }, (_, i) => -0.55 + i * (1.1 / 13))
  return (
    <group position={[0.25, TOP, -0.28]}>
      <Box position={[0, 0.105, 0]} size={[1.18, 0.18, 0.36]} color="#20262d" />
      {pins.flatMap((x, i) => [-1, 1].map((side) => (
        <Box
          key={`${i}-${side}`}
          position={[x, 0.07, side * 0.225]}
          size={[0.045, 0.035, 0.13]}
          color="#b7bec5"
          castShadow={false}
        />
      )))}
      <mesh position={[-0.48, 0.205, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.045, 8]} />
        <Toon color="#69737d" outline={false} />
      </mesh>
    </group>
  )
}

function UsbController() {
  return (
    <group position={[-0.18, TOP, 0.47]}>
      <Box position={[0, 0.075, 0]} size={[0.34, 0.12, 0.34]} color="#252b32" />
      {[-1, 1].flatMap((side) => Array.from({ length: 6 }, (_, i) => (
        <Box
          key={`${side}-${i}`}
          position={[side * 0.205, 0.05, -0.125 + i * 0.05]}
          size={[0.09, 0.025, 0.025]}
          color="#c4cbd0"
          castShadow={false}
        />
      )))}
    </group>
  )
}

function Crystal() {
  return (
    <group position={[0.48, TOP, 0.22]}>
      <Box position={[0, 0.085, 0]} size={[0.16, 0.14, 0.42]} color="#aab4bd" />
      {[-1, 1].map((z) => (
        <Box key={z} position={[0, 0.035, z * 0.24]} size={[0.025, 0.025, 0.1]} color="#c8cfd5" castShadow={false} />
      ))}
    </group>
  )
}

function ResetButton() {
  return (
    <group position={[-0.7, TOP, 0.62]}>
      <Box position={[0, 0.07, 0]} size={[0.27, 0.1, 0.23]} color="#c6cdd2" />
      <Box position={[0, 0.135, 0]} size={[0.13, 0.05, 0.11]} color="#343b43" />
    </group>
  )
}

function IcspHeader({ position, scale = 1 }) {
  return (
    <group position={position} scale={scale}>
      <Box position={[0, 0, 0]} size={[0.34, 0.16, 0.2]} color={C.header} />
      {[-0.1, 0, 0.1].flatMap((x) => [-0.05, 0.05].map((z) => (
        <Box key={`${x}-${z}`} position={[x, 0.12, z]} size={[0.028, 0.16, 0.028]} color={C.pinGold} castShadow={false} />
      )))}
    </group>
  )
}

function PowerStage() {
  return (
    <group>
      <Box position={[-0.62, TOP + 0.09, -0.55]} size={[0.38, 0.16, 0.28]} color="#252b31" />
      <Box position={[-0.76, TOP + 0.06, -0.2]} size={[0.18, 0.1, 0.13]} color="#30373f" />
      {[-0.2, 0.02].map((x) => (
        <mesh key={x} position={[x, TOP + 0.12, 0.02]} castShadow>
          <cylinderGeometry args={[0.1, 0.1, 0.2, 10]} />
          <Toon color="#9ba5ae" />
        </mesh>
      ))}
      {[-0.78, -0.55, 0.62].map((x, i) => (
        <Box key={x} position={[x, TOP + 0.04, i === 2 ? -0.02 : 0.28]} size={[0.13, 0.06, 0.07]} color="#c3c9ce" castShadow={false} />
      ))}
    </group>
  )
}

function OnboardIndicators() {
  const leds = [
    [0.33, 0.53, '#e5b22e'],
    [0.48, 0.53, '#e5b22e'],
    [0.63, 0.53, '#e5b22e'],
    [0.78, 0.53, '#55b878'],
  ]
  return leds.map(([x, z, color], index) => (
    <Box key={index} position={[x, TOP + 0.035, z]} size={[0.065, 0.045, 0.055]} color={color} castShadow={false} />
  ))
}

function BoardSilkscreen() {
  const traces = [
    [-0.34, -0.67, 0.54, 0.018],
    [0.0, 0.72, 0.72, 0.018],
    [0.77, 0.0, 0.018, 0.72],
    [-0.86, 0.0, 0.018, 0.4],
  ]
  return (
    <group position={[0, TOP + 0.008, 0]}>
      {traces.map(([x, z, w, d], index) => (
        <Box key={index} position={[x, 0, z]} size={[w, 0.008, d]} color="#58abb2" castShadow={false} />
      ))}
      <Box position={[0.6, 0.002, -0.72]} size={[0.5, 0.01, 0.018]} color="#d8e8e8" castShadow={false} />
      <Box position={[0.84, 0.002, -0.61]} size={[0.018, 0.01, 0.22]} color="#d8e8e8" castShadow={false} />
    </group>
  )
}
