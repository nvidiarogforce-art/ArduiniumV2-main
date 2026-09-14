import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Toon } from '../lib/toon.jsx'
import { COMPONENT_SPECS } from '../lib/electronics.js'
import { lcdConnection, outputConnection } from '../lib/circuits.js'
import { rt } from './runtime.js'

const GOLD = '#d9b85a'
const METAL = '#bdc7cf'
const DARK = '#202831'
const HOLDER = '#2d6ab5'

function Box({ position = [0, 0, 0], size, color, rotation, selected = false }) {
  return <mesh position={position} rotation={rotation} castShadow>
    <boxGeometry args={size} />
    <Toon color={color} outline={false} emissive={selected ? '#755d21' : '#000000'} emissiveIntensity={selected ? 0.32 : 0} />
  </mesh>
}

function Cyl({ position = [0, 0, 0], radius, height, color, rotation, sides = 12 }) {
  return <mesh position={position} rotation={rotation} castShadow>
    <cylinderGeometry args={[radius, radius, height, sides]} />
    <Toon color={color} outline={false} />
  </mesh>
}

function Holder({ kind, selected }) {
  const [w, , d] = COMPONENT_SPECS[kind]?.size ?? [0.5, 0.2, 0.38]
  return <group>
    <Box position={[0, -0.055, 0]} size={[w, 0.055, d]} color={selected ? '#4389da' : HOLDER} />
    <Cyl position={[0, -0.082, d * 0.28]} radius={0.045} height={0.06} color={GOLD} sides={10} />
  </group>
}

function Pins({ kind }) {
  return <group>{(COMPONENT_SPECS[kind]?.terminals ?? []).map((terminal) =>
    <group key={terminal.id} position={terminal.local}>
      <Box size={[0.034, 0.075, 0.034]} color={GOLD} />
      <Box position={[0, 0.044, 0]} size={[0.058, 0.02, 0.058]} color={DARK} />
    </group>)}</group>
}

function Axial({ kind, bodyColor, bandColor, selected, embedded = false }) {
  return <group>{!embedded && <Holder kind={kind} selected={selected} />}
    <Cyl position={[0, 0.055, 0]} radius={0.07} height={0.28} color={bodyColor} rotation={[0, 0, Math.PI / 2]} />
    <Box position={[-0.075, 0.055, 0]} size={[0.025, 0.145, 0.145]} color={bandColor} />
    <Box position={[0, 0.055, 0]} size={[0.018, 0.145, 0.145]} color="#7a4d2d" />
    <Box position={[0.075, 0.055, 0]} size={[0.018, 0.145, 0.145]} color="#ba3c38" />
    {[-1, 1].map((side) => <Box key={side} position={[side * 0.21, 0.055, 0]} size={[0.14, 0.025, 0.025]} color={METAL} />)}
    {!embedded && <Pins kind={kind} />}
  </group>
}

function Dip({ kind, selected, pins = 8, notch = true, embedded = false }) {
  const rows = pins / 2
  return <group>{!embedded && <Holder kind={kind} selected={selected} />}
    <Box position={[0, 0.07, 0]} size={[0.48 + Math.max(0, rows - 4) * 0.09, 0.17, 0.25]} color={DARK} />
    {[-1, 1].flatMap((side) => Array.from({ length: rows }, (_, i) =>
      <Box key={`${side}-${i}`} position={[-0.18 - (rows - 4) * 0.045 + i * 0.12, 0.025, side * 0.17]} size={[0.045, 0.025, 0.13]} color={METAL} />))}
    {notch && <Cyl position={[-0.18 - (rows - 4) * 0.045, 0.16, 0]} radius={0.035} height={0.012} color="#68727b" />}
    {!embedded && <Pins kind={kind} />}
  </group>
}

function Servo({ part, parts, wires, selected }) {
  return <group><Holder kind="servo" selected={selected} />
    <Box position={[0, 0.16, 0]} size={[0.52, 0.35, 0.32]} color="#2765a8" />
    <Cyl position={[0, -0.285, 0]} radius={0.09} height={0.07} color={METAL} />
    <Cyl position={[0, -0.325, 0]} radius={0.045} height={0.035} color="#d5dce0" />
    <Pins kind="servo" />
  </group>
}

/**
 * A separate, physical horn adapter. The servo owns the keyed spline node;
 * this part snaps onto it and exposes the central construction hole used by
 * the moving beam. Its visible angle follows the same wired output as Rapier.
 */
export function ServoHornMesh({ part, parts, wires, selected }) {
  const horn = useRef()
  const servo = parts?.[part.hostId]
  const connection = servo?.kind === 'servo' ? outputConnection(servo, parts, wires) : { ready: false }
  useFrame(() => {
    if (!horn.current) return
    const angle = connection.ready && rt.servoAngle[connection.pin] != null
      ? rt.servoAngle[connection.pin]
      : 90
    const target = (Math.max(0, Math.min(180, angle)) / 180 - 0.5) * Math.PI
    horn.current.rotation.y += (target - horn.current.rotation.y) * 0.2
  })
  return <group ref={horn}>
    <Box size={[1.18, 0.07, 0.16]} color={selected ? '#ffffff' : '#eef1eb'} />
    <Box size={[0.16, 0.07, 1.18]} color={selected ? '#ffffff' : '#eef1eb'} />
    <Cyl radius={0.16} height={0.1} color="#d5dce0" />
    {[[-0.42, 0], [0.42, 0], [0, -0.42], [0, 0.42]].map(([x, z]) =>
      <Cyl key={x + '-' + z} position={[x, 0, z]} radius={0.035} height={0.09} color={DARK} sides={10} />)}
  </group>
}

function Piezo({ part, parts, wires, selected, embedded = false }) {
  const top = useRef()
  const connection = outputConnection(part, parts, wires)
  useFrame(({ clock }) => {
    if (!top.current) return
    const on = connection.ready && (rt.pinHigh[connection.pin] || Math.abs(rt.motorSpeed[connection.pin] ?? 0) > 0)
    top.current.scale.y = on ? 1 + Math.sin(clock.elapsedTime * 90) * 0.06 : 1
  })
  return <group>{!embedded && <Holder kind="piezo" selected={selected} />}
    <group ref={top}><Cyl position={[0, 0.08, 0]} radius={0.22} height={0.12} color={DARK} sides={20} />
      <Cyl position={[0, 0.145, 0]} radius={0.055} height={0.025} color="#0d1217" sides={18} /></group>
    {!embedded && <Pins kind="piezo" />}
  </group>
}

function LcdScreen({ active }) {
  const canvas = useMemo(() => {
    const node = document.createElement('canvas')
    node.width = 512
    node.height = 128
    return node
  }, [])
  const texture = useMemo(() => {
    const value = new THREE.CanvasTexture(canvas)
    value.colorSpace = THREE.SRGBColorSpace
    value.minFilter = THREE.NearestFilter
    value.magFilter = THREE.NearestFilter
    return value
  }, [canvas])
  const last = useRef()
  useFrame(() => {
    const text = active ? (rt.displayText || 'ARDUINIUM READY') : 'CHECK WIRING'
    if (last.current === text) return
    last.current = text
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = active ? '#b8cf69' : '#82925c'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#314737'
    ctx.font = 'bold 40px monospace'
    ctx.textBaseline = 'top'
    const clean = String(text).replace(/[^\x20-\x7E]/g, '?').slice(0, 32)
    ctx.fillText(clean.slice(0, 16), 18, 13)
    ctx.fillText(clean.slice(16), 18, 68)
    texture.needsUpdate = true
  })
  return <mesh position={[0, 0.184, 0.03]} rotation={[-Math.PI / 2, 0, 0]}>
    <planeGeometry args={[0.8, 0.25]} />
    <meshBasicMaterial map={texture} toneMapped={false} />
  </mesh>
}

function Lcd({ part, parts, wires, selected }) {
  const connection = lcdConnection(part, parts, wires)
  return <group><Holder kind="lcd" selected={selected} />
    <Box position={[0, 0.09, 0.03]} size={[1.08, 0.12, 0.48]} color="#176b78" />
    <Box position={[0, 0.16, 0.03]} size={[0.84, 0.035, 0.29]} color="#b8cf69" />
    <LcdScreen active={connection.ready} />
    <Pins kind="lcd" />
  </group>
}

function Battery({ selected }) {
  return <group><Holder kind="battery9v" selected={selected} />
    <Box position={[0, 0.34, 0]} size={[0.62, 0.72, 0.34]} color="#353a40" />
    <Box position={[0, 0.5, 0.176]} size={[0.62, 0.22, 0.015]} color="#d99a32" />
    <Cyl position={[-0.1, 0.73, 0]} radius={0.055} height={0.06} color={METAL} />
    <Cyl position={[0.1, 0.73, 0]} radius={0.075} height={0.06} color={METAL} />
    <Pins kind="battery9v" />
  </group>
}

export default function KitPartMesh({ part, parts, wires, selected }) {
  const kind = part.kind
  const embedded = Boolean(part.breadboardId)
  if (kind === 'resistor') return <Axial kind={kind} bodyColor="#d8b17a" bandColor="#24262a" selected={selected} embedded={embedded} />
  if (kind === 'diode') return <Axial kind={kind} bodyColor="#252b31" bandColor="#d6dce0" selected={selected} embedded={embedded} />
  if (kind === 'motorDriver') return <Dip kind={kind} selected={selected} pins={16} embedded={embedded} />
  if (kind === 'optocoupler') return <Dip kind={kind} selected={selected} pins={6} embedded={embedded} />
  if (kind === 'servo') return <Servo part={part} parts={parts} wires={wires} selected={selected} />
  if (kind === 'piezo') return <Piezo part={part} parts={parts} wires={wires} selected={selected} embedded={embedded} />
  if (kind === 'lcd') return <Lcd part={part} parts={parts} wires={wires} selected={selected} />
  if (kind === 'battery9v') return <Battery selected={selected} />

  return <group>{!embedded && <Holder kind={kind} selected={selected} />}{!embedded && <Pins kind={kind} />}
    {kind === 'capacitor' && <><Cyl position={[0, 0.13, 0]} radius={0.11} height={0.28} color="#334c78" sides={16} /><Box position={[0.075, 0.13, 0.1]} size={[0.025, 0.22, 0.015]} color="#d8dde2" /></>}
    {kind === 'transistor' && <><Cyl position={[0, 0.12, 0]} radius={0.1} height={0.24} color={DARK} sides={12} /><Box position={[0, 0.12, -0.075]} size={[0.2, 0.24, 0.05]} color="#151b21" /></>}
    {kind === 'mosfet' && <><Box position={[0, 0.17, 0]} size={[0.25, 0.34, 0.08]} color={DARK} /><Box position={[0, 0.27, 0.055]} size={[0.13, 0.09, 0.03]} color={METAL} /></>}
    {kind === 'photoTransistor' && <><Cyl position={[0, 0.15, 0]} radius={0.105} height={0.26} color="#202b38" sides={16} /><Cyl position={[0, 0.29, 0]} radius={0.078} height={0.03} color="#657e9a" sides={16} /></>}
    {kind === 'tmp36' && <><Cyl position={[0, 0.13, 0]} radius={0.1} height={0.25} color={DARK} sides={12} /><Box position={[0, 0.13, -0.075]} size={[0.2, 0.25, 0.05]} color="#13191e" /></>}
    {kind === 'tiltSwitch' && <><Cyl position={[0, 0.14, 0]} radius={0.075} height={0.29} color="#b68b43" sides={12} /><Cyl position={[0, 0.29, 0]} radius={0.075} height={0.02} color="#d1ad62" sides={12} /></>}
    {kind === 'potentiometer' && <><Box position={[0, 0.1, 0]} size={[0.3, 0.18, 0.26]} color="#2b71bd" /><Cyl position={[0, 0.28, 0]} radius={0.1} height={0.25} color={METAL} sides={18} /></>}
    {kind === 'pushButton' && <><Box position={[0, 0.07, 0]} size={[0.25, 0.12, 0.25]} color={METAL} /><Box position={[0, rt.environment.button ? 0.105 : 0.15, 0]} size={[0.13, 0.09, 0.13]} color="#343a40" /></>}
  </group>
}
