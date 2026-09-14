import { Toon } from '../lib/toon.jsx'
import { SENSOR_SPECS, SENSOR_MODULE_SIZE } from '../lib/sensors.js'

const PCB = { lineSensor: '#1766aa', lightSensor: '#1766aa', temperatureSensor: '#1766aa', touchSensor: '#1766aa', tiltSensor: '#1766aa', encoderSensor: '#20262d' }
const GOLD = '#dcba56'
const DARK = '#202833'

function Box({ position, size, color, selected = false }) {
  return <mesh position={position} castShadow>
    <boxGeometry args={size} />
    <Toon color={color} outline={false} emissive={selected ? '#8e6921' : '#000000'} emissiveIntensity={selected ? 0.35 : 0} />
  </mesh>
}

function Disc({ position, radius, height, color, rotation }) {
  return <mesh position={position} rotation={rotation} castShadow>
    <cylinderGeometry args={[radius, radius, height, 16]} />
    <Toon color={color} outline={false} />
  </mesh>
}

function Trimmer({ position }) {
  return <group position={position}>
    <Box position={[0, 0.025, 0]} size={[0.115, 0.06, 0.11]} color="#2c72b8" />
    <Disc position={[0, 0.06, 0]} radius={0.035} height={0.025} color="#d8e0e5" />
    <Box position={[0, 0.075, 0]} size={[0.055, 0.008, 0.012]} color="#53616d" />
  </group>
}

/** Colour-coded sockets use the SAME coordinates as the actual wire targets. */
export function SensorPinMarkers({ kind }) {
  return <group>{SENSOR_SPECS[kind].terminals.map((terminal) => {
    const color = terminal.type === 'vcc' ? '#db443c' : terminal.type === 'gnd' ? '#20252b' : '#f4c952'
    return <group key={terminal.id} position={terminal.local}>
      <Box position={[0, -0.018, 0]} size={[0.065, 0.026, 0.065]} color={color} />
      <Box position={[0, -0.004, 0]} size={[0.024, 0.008, 0.024]} color={GOLD} />
    </group>
  })}</group>
}

/**
 * Authored compact educational PCBs; every visible feature fits the centered
 * 0.6 x 0.12 x 0.4 module envelope used by snapping and physics.
 * No network textures, fonts or suspense-producing in-scene text.
 */
export default function SensorModuleMesh({ kind, selected }) {
  return <group>
    <Box position={[0, -0.035, 0]} size={[SENSOR_MODULE_SIZE[0], 0.04, SENSOR_MODULE_SIZE[2]]} color={PCB[kind]} selected={selected} />
    {[-0.26, 0.26].map((x) => <group key={x}>
      <Disc position={[x, -0.01, 0.145]} radius={0.027} height={0.008} color={GOLD} />
      <Disc position={[x, -0.004, 0.145]} radius={0.013} height={0.009} color={DARK} />
    </group>)}
    {/* Copper routes and component solder pads. */}
    {[-0.18, 0, 0.18].map((x) => <Box key={x} position={[x, -0.012, -0.07]} size={[0.012, 0.005, 0.1]} color={GOLD} />)}
    <SensorPinMarkers kind={kind} />
    {kind === 'lineSensor' && <group>
      <Box position={[0, 0.006, 0.11]} size={[0.26, 0.045, 0.13]} color={DARK} />
      {[-0.074, 0.074].map((x, i) => <group key={x}>
        <Disc position={[x, 0.036, 0.11]} radius={0.037} height={0.034} color={i ? '#171224' : '#93bbc4'} />
        <Disc position={[x, -0.054, 0.11]} radius={0.037} height={0.012} color={i ? '#171224' : '#93bbc4'} />
      </group>)}
      <Trimmer position={[0.19, 0.01, 0.01]} />
      <Box position={[-0.19, 0.014, -0.01]} size={[0.09, 0.035, 0.09]} color="#202831" />
    </group>}
    {kind === 'lightSensor' && <group>
      <Disc position={[0, 0.015, 0.065]} radius={0.105} height={0.045} color="#dca77b" />
      {[-1, 0, 1].map((n) => <Box key={n} position={[n * 0.045, 0.042, 0.065]} size={[0.012, 0.007, 0.13]} color="#7f3f30" />)}
      <Box position={[-0.023, 0.042, 0.005]} size={[0.05, 0.007, 0.014]} color="#7f3f30" />
      <Box position={[0.023, 0.042, 0.125]} size={[0.05, 0.007, 0.014]} color="#7f3f30" />
      <Trimmer position={[0.19, 0.01, 0.06]} />
      <Box position={[-0.19, 0.012, 0.07]} size={[0.08, 0.04, 0.12]} color="#202831" />
    </group>}
    {kind === 'temperatureSensor' && <group>
      {[-0.055, 0, 0.055].map((x) => <Box key={x} position={[x, 0, 0.025]} size={[0.014, 0.015, 0.11]} color={GOLD} />)}
      <Disc position={[0, 0.018, 0.085]} radius={0.08} height={0.064} color={DARK} />
      <Box position={[0, 0.03, 0.135]} size={[0.13, 0.04, 0.03]} color="#2f3842" />
      <Box position={[0, 0.053, 0.08]} size={[0.018, 0.008, 0.07]} color="#d96140" />
      <Trimmer position={[0.19, 0.01, 0.06]} />
    </group>}
    {kind === 'touchSensor' && <group>
      <Box position={[0, 0.003, 0.04]} size={[0.22, 0.044, 0.19]} color={DARK} />
      <Box position={[0.01, 0.04, 0.06]} size={[0.095, 0.028, 0.085]} color="#e24b43" />
      <Box position={[-0.055, 0.044, 0.115]} size={[0.035, 0.01, 0.17]} color="#cad2d7" />
      <Disc position={[-0.055, 0.043, 0.184]} radius={0.016} height={0.014} color="#dce0e4" rotation={[Math.PI / 2, 0, 0]} />
    </group>}
    {kind === 'tiltSensor' && <group>
      <Disc position={[-0.08, 0.08, 0.07]} radius={0.065} height={0.2} color="#b68b43" />
      <Trimmer position={[0.17, 0.01, 0.06]} />
      <Box position={[0.02, 0.015, 0.13]} size={[0.1, 0.035, 0.055]} color={DARK} />
    </group>}
    {kind === 'encoderSensor' && <group>
      <Disc position={[0, 0.015, 0.055]} radius={0.105} height={0.025} color="#e2b74b" />
      {Array.from({ length: 8 }, (_, i) => {
        const angle = i * Math.PI / 4
        return <Box key={i} position={[Math.cos(angle) * 0.075, 0.03, 0.055 + Math.sin(angle) * 0.075]} size={[0.022, 0.005, 0.022]} color={DARK} />
      })}
      <Disc position={[0, 0.035, 0.055]} radius={0.025} height={0.025} color="#c5cbd0" />
      {[-0.115, 0.115].map((x) => <Box key={x} position={[x, 0.016, 0.04]} size={[0.035, 0.072, 0.1]} color={DARK} />)}
    </group>}
  </group>
}
