import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { BallCollider, CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { useFrame } from '@react-three/fiber'
import { Toon } from '../lib/toon.jsx'
import { useUiStore } from '../store/useUiStore.js'
import { getMission } from '../lib/missions.js'
import { getMap } from '../lib/maps.js'
import { getLineTrack } from '../lib/lineTracks.js'
import { rt } from './runtime.js'
import { ARENA, C } from '../lib/config.js'
import { WORLD_GROUP } from './Build.jsx'

export const terrainHeight = () => 0

const BLUE = '#3276d7'
const BLUE_DARK = '#263746'
const ORANGE = '#ee8738'
const TEAL = '#2aa58a'
const CREAM = '#efe6d2'

/** One deterministic environment is mounted at a time. */
export default function Terrain({ physics = false }) {
  const map = getMap(useUiStore((s) => s.map))
  const mission = getMission(useUiStore((s) => s.mission))

  return (
    <group userData={{ map: map.id }}>
      <WorldFloor map={map} physics={physics} />
      {map.id === 'circuitLab' && <CircuitBench physics={physics} />}
      {map.id === 'provingGround' && <ProvingGround physics={physics} mission={mission} />}
      {map.id === 'challengeArena' && <ChallengeArena physics={physics} />}
      {map.id === 'lineLab' && <LineLab map={map} physics={physics} mission={mission} />}
      <MissionProps mission={mission} physics={physics} />
    </group>
  )
}

function WorldFloor({ map, physics }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[map.size, map.size]} />
        <Toon color={map.floor} outline={false} />
      </mesh>
      {physics && (
        <RigidBody type="fixed" colliders={false}>
          <group position={[0, -0.5, 0]}>
            <CuboidCollider args={[map.size / 2, 0.5, map.size / 2]} friction={map.id === 'provingGround' ? 0.88 : ARENA.friction} collisionGroups={WORLD_GROUP} />
          </group>
        </RigidBody>
      )}
    </group>
  )
}

/* ======================================================= circuit workbench */

function CircuitBench({ physics }) {
  return (
    <group>
      <StaticBox physics={physics} pos={[0, -0.42, 0]} size={[19.4, 0.82, 12.8]} colour="#f8f7f2" />
      <StaticBox pos={[0, -0.96, -5.9]} size={[18.2, 0.22, 0.25]} colour="#d8d2c6" />
      {[-8.4, 8.4].flatMap((x) => [-5.3, 5.3].map((z) => <StaticBox key={`leg-${x}-${z}`} pos={[x, -2.3, z]} size={[0.42, 3.8, 0.42]} colour="#46515a" />))}
      <StaticBox physics={physics} pos={[0, 2.8, -10.4]} size={[22, 5.6, 0.35]} colour="#ead9bd" />
      <StaticBox physics={physics} pos={[-10.4, 2.8, 0]} size={[0.35, 5.6, 21]} colour="#ead9bd" />
      <WindowFrame />
      <Cabinet at={[-8.4, 1.15, -8.7]} />
      <Cabinet at={[7.7, 1.15, -8.7]} />
      <Instrument at={[7.4, 0.55, -4.6]} colour="#f2efe6" screen="#2bd6dd" />
      <Instrument at={[4.9, 0.42, -4.8]} colour="#ef9b3f" screen="#9caf85" small />
      <Lamp at={[-6.8, 0, -4.4]} />
      <PartsBin at={[-7.3, 0.36, 4.5]} colour={BLUE} />
      <PartsBin at={[7.2, 0.36, 4.6]} colour={BLUE} />
      <DecalRect pos={[0, 0.012, 0]} size={[12.4, 7.8]} colour="#ffffff" opacity={0.35} />
      <DecalRect pos={[0, 0.014, 0]} size={[12.1, 0.05]} colour="#cad3d7" opacity={0.55} />
    </group>
  )
}

function WindowFrame() {
  return (
    <group position={[-10.2, 3.2, -3.5]}>
      <mesh rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[6.4, 3.6]} /><meshBasicMaterial color="#c8e4ed" /></mesh>
      {[-3.2, 0, 3.2].map((z) => <mesh key={z} position={[0.03, 0, z]}><boxGeometry args={[0.18, 3.9, 0.16]} /><Toon color="#f5f0e6" /></mesh>)}
      <mesh position={[0.03, 0, 0]}><boxGeometry args={[0.18, 0.16, 6.6]} /><Toon color="#f5f0e6" /></mesh>
    </group>
  )
}

function Cabinet({ at }) {
  return <group position={at}><mesh castShadow receiveShadow><boxGeometry args={[3.2, 2.3, 1.5]} /><Toon color="#526272" /></mesh>{[-0.65, 0, 0.65].map((y) => <mesh key={y} position={[0, y, 0.77]}><boxGeometry args={[2.85, 0.05, 0.05]} /><Toon color="#b8c0c6" /></mesh>)}<mesh position={[0, 1.22, 0]}><boxGeometry args={[3.45, 0.18, 1.7]} /><Toon color="#c9a36e" /></mesh></group>
}

function Instrument({ at, colour, screen, small = false }) {
  const scale = small ? 0.78 : 1
  return <group position={at} scale={scale}><mesh castShadow><boxGeometry args={[2.2, 1.05, 0.7]} /><Toon color={colour} /></mesh><mesh position={[-0.35, 0.08, 0.365]}><planeGeometry args={[1.15, 0.55]} /><meshBasicMaterial color="#17232d" /></mesh><mesh position={[-0.35, 0.08, 0.372]}><planeGeometry args={[0.82, 0.05]} /><meshBasicMaterial color={screen} /></mesh>{[0.45, 0.75].map((x) => <mesh key={x} position={[x, 0.1, 0.4]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.12, 0.12, 0.09, 12]} /><Toon color={x < 0.6 ? ORANGE : BLUE} /></mesh>)}</group>
}

function Lamp({ at }) {
  return <group position={at}><mesh position={[0, 0.12, 0]}><cylinderGeometry args={[0.48, 0.58, 0.24, 18]} /><Toon color={BLUE_DARK} /></mesh><mesh position={[0, 1.2, 0]} rotation={[0, 0, -0.5]}><boxGeometry args={[0.18, 2.2, 0.18]} /><Toon color={BLUE_DARK} /></mesh><mesh position={[0.52, 2.06, 0]} rotation={[0, 0, -0.5]}><coneGeometry args={[0.5, 0.75, 18]} /><Toon color="#343e47" /></mesh><pointLight position={[0.75, 1.72, 0]} intensity={0.45} distance={8} color="#ffd69a" /></group>
}

function PartsBin({ at, colour }) {
  return <group position={at}><mesh castShadow><boxGeometry args={[2.8, 0.55, 1.45]} /><Toon color={colour} /></mesh>{[-0.75, 0, 0.75].map((x) => <mesh key={x} position={[x, 0.34, 0]}><boxGeometry args={[0.08, 0.3, 1.2]} /><Toon color="#245ca8" /></mesh>)}</group>
}

/* ====================================================== proving ground */

function ProvingGround({ physics, mission }) {
  return (
    <group>
      <BuildPad radius={6.5} />
      {mission.showRing && <LegacyLineLoop bright />}
      <Perimeter half={32.5} physics={physics} colour="#e7dcc4" posts />
      <CourseLoop />
      <ObstacleBay at={[-17, -2]} size={[10.5, 8]} />
      <ObstacleBay at={[-16, 12]} size={[13, 7]} />
      <ObstacleBay at={[16.5, -14]} size={[11, 7]} />
      <ObstacleBay at={[22.5, 12]} size={[7, 10]} />
      <StaticBox physics={physics} pos={[12.5, 0.62, 0]} rot={[0, 0, -ARENA.rampAngle]} size={[5.4, 0.3, 4.4]} colour={C.ramp} />
      <StaticBox physics={physics} pos={[16.4, 1, 0]} size={[3.2, 0.3, 4.4]} colour={C.ramp} />
      <CheckpointGate at={[7.5, 0]} />
      <CheckpointGate at={[17.8, 5.5]} yaw={Math.PI / 2} />
      <MudLane physics={physics} />
      <RockCrawl physics={physics} />
      <LogBridge physics={physics} />
      <BumpLane physics={physics} />
      <Slalom physics={physics} />
      <ServiceShed at={[-25, 0, -25]} yaw={Math.PI / 4} />
      <Container at={[26, 0, -26]} yaw={-Math.PI / 4} colour={BLUE} />
      <Container at={[20.5, 0, -28.2]} yaw={-Math.PI / 5} colour={ORANGE} />
      <ShrubRing />
    </group>
  )
}

function BuildPad({ radius }) {
  return <group><DecalRect pos={[0, 0.011, 0]} size={[radius * 2.25, radius * 1.45]} colour="#cfbd92" opacity={0.8} /><DecalFrame at={[0, 0]} size={[radius * 2.25, radius * 1.45]} colour={CREAM} /></group>
}

function CourseLoop() {
  const points = [[-24, -9], [-18, -18], [2, -21], [22, -17], [27, -4], [25, 16], [10, 23], [-11, 23], [-25, 14], [-24, -9]]
  return <group><TrackRibbon points={points} width={3.4} colour="#8f7c5e" /><TrackRibbon points={points} width={0.16} colour="#f3ead5" /></group>
}

function ObstacleBay({ at, size }) {
  return <group><DecalRect pos={[at[0], 0.009, at[1]]} size={size} colour="#9b8664" opacity={0.72} /><DecalFrame at={at} size={size} colour="#e9ddc3" /></group>
}

function LegacyLineLoop({ bright }) {
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.016, 0]}><ringGeometry args={[9.2, 9.7, 96]} /><meshBasicMaterial color="#23282f" transparent opacity={bright ? 1 : 0.82} /></mesh>
}

function MudLane({ physics }) {
  return <group><StaticBox physics={physics} friction={0.28} pos={[-17, 0.015, -2]} size={[8.5, 0.03, 6.2]} colour="#72513d" />{[-19.8, -17.2, -14.6].map((x) => <DecalRect key={x} pos={[x, 0.034, -2]} size={[0.38, 5.5]} colour="#4f372c" opacity={0.75} />)}{[[-20, -4.5], [-15.5, 0.2], [-13.4, -3.6]].map(([x, z], i) => <Puddle key={i} at={[x, z]} />)}</group>
}

function Puddle({ at }) {
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[at[0], 0.038, at[1]]}><circleGeometry args={[1.15, 20]} /><meshBasicMaterial color="#7b8990" transparent opacity={0.62} /></mesh>
}

function RockCrawl({ physics }) {
  const rocks = [[-21, 12, 0.65], [-18.5, 11.2, 0.8], [-16, 12.6, 0.62], [-13.6, 10.8, 0.9], [-11.2, 12.4, 0.68]]
  return <group>{rocks.map(([x, z, r], i) => <Rock key={i} at={[x, r * 0.72, z]} radius={r} physics={physics} />)}</group>
}

function Rock({ at, radius, physics }) {
  const visual = <mesh position={at} rotation={[0.1, at[0] * 0.17, -0.08]} castShadow receiveShadow><icosahedronGeometry args={[radius, 1]} /><Toon color="#77716b" /></mesh>
  if (!physics) return visual
  return <RigidBody type="fixed" colliders={false}>{visual}<group position={at}><BallCollider args={[radius * 0.72]} friction={1.05} collisionGroups={WORLD_GROUP} /></group></RigidBody>
}

function LogBridge({ physics }) {
  return <group>{Array.from({ length: 8 }, (_, i) => <StaticCylinder key={i} physics={physics} at={[14 + i * 0.72, 0.33, -14]} radius={0.32} height={5.2} rot={[0, 0, Math.PI / 2]} colour="#8b5d38" />)}<StaticBox physics={physics} pos={[16.5, 0.16, -16.8]} size={[7.8, 0.3, 0.28]} colour="#d6c6a8" /><StaticBox physics={physics} pos={[16.5, 0.16, -11.2]} size={[7.8, 0.3, 0.28]} colour="#d6c6a8" /></group>
}

function BumpLane({ physics }) {
  return <group>{[-2.2, 0, 2.2].map((z, i) => <StaticBox key={z} physics={physics} pos={[23, 0.24, z + 12]} rot={[0, 0, i % 2 ? -0.08 : 0.08]} size={[5.8, 0.48, 0.68]} colour={i % 2 ? ORANGE : BLUE_DARK} />)}</group>
}

function Slalom({ physics }) {
  return <group>{Array.from({ length: 7 }, (_, i) => <Cone key={i} physics={physics} at={[-9 - i * 2.05, 18 + (i % 2 ? 1.65 : -1.65)]} />)}</group>
}

function Cone({ at, physics }) {
  const visual = <group position={[at[0], 0, at[1]]}><mesh position={[0, 0.12, 0]}><cylinderGeometry args={[0.34, 0.42, 0.18, 12]} /><Toon color={BLUE_DARK} /></mesh><mesh position={[0, 0.56, 0]}><coneGeometry args={[0.3, 0.9, 14]} /><Toon color={ORANGE} /></mesh></group>
  if (!physics) return visual
  return <RigidBody type="fixed" colliders={false}>{visual}<group position={[at[0], 0.45, at[1]]}><CylinderCollider args={[0.45, 0.28]} collisionGroups={WORLD_GROUP} /></group></RigidBody>
}

/* ===================================================== challenge arena */

function ChallengeArena({ physics }) {
  return (
    <group>
      <Perimeter half={26.5} physics={physics} colour={BLUE} posts />
      <DecalRect pos={[0, 0.009, 4]} size={[13, 13]} colour="#d8c49a" opacity={0.95} />
      <DecalFrame at={[0, 4]} size={[13, 13]} colour="#eee2c9" />
      <Road points={[[-22, -15], [-8, -15], [-5, -8], [0, -4], [6, -2], [12, -4], [18, -7], [23, -7]]} width={3.4} />
      <Road points={[[0, -4], [0, 18]]} width={3.4} />
      <Road points={[[-20, 9], [-8, 9], [0, 5], [10, 7], [20, 12]]} width={3.4} />
      {[
        [-12, -15, 0], [-3, -7, 0.58], [4, -2.6, 0.32], [15, -5.4, 0.3],
        [0, 12, -Math.PI / 2], [-12, 9, 0], [12, 8, -0.46],
      ].map(([x, z, yaw], i) => <RoadArrow key={i} at={[x, z]} yaw={yaw} />)}
      <StaticBox physics={physics} pos={[10.4, 0.32, -2.5]} rot={[0, 0.4, -0.12]} size={[4.2, 0.28, 3.4]} colour={BLUE} />
      <StaticBox physics={physics} pos={[13.6, 0.56, -4.8]} rot={[0, 0.4, 0]} size={[2.6, 0.28, 3.4]} colour={BLUE} />
      <StaticBox physics={physics} pos={[16, 0.32, -6.2]} rot={[0, 0.4, 0.12]} size={[3.2, 0.28, 3.4]} colour={BLUE} />
      <PadMarker at={[6.4, -0.2]} colour={TEAL} shape="circle" />
      <PadMarker at={[18, -7]} colour="#df554b" shape="circle" />
      <ChallengeCell at={[-15.8, -7]} size={[11, 10]} colour="#e8b833" />
      <ChallengeWalls at={[-15.8, -7]} size={[11, 10]} physics={physics} opening="right" />
      <HeightGauge at={[-20, -10.2]} />
      <ChallengeCell at={[-15.8, 9]} size={[11, 8]} colour={TEAL} />
      <ChallengeWalls at={[-15.8, 9]} size={[11, 8]} physics={physics} opening="right" />
      <Road points={[[-20, 9], [-11, 9]]} width={3.2} />
      <PadMarker at={[-11, 9]} colour={TEAL} shape="square" />
      <ChallengeCell at={[15.5, 10.5]} size={[11, 8]} colour={BLUE} />
      <ChallengeWalls at={[15.5, 10.5]} size={[11, 8]} physics={physics} opening="left" />
      <CraneStation at={[18.5, 11.5]} />
      {[[-19.8, -4.4], [-11.8, -4.4], [-19.8, 4.4], [-11.8, 4.4]].map(([x, z], i) => <Bollard key={i} at={[x, z]} colour={ORANGE} />)}
      {[[11.2, 8], [11.2, 13], [19.8, 8], [19.8, 13]].map(([x, z], i) => <Bollard key={`p${i}`} at={[x, z]} colour={i % 2 ? TEAL : ORANGE} />)}
      <ServiceShed at={[-21.5, 0, 21.5]} yaw={Math.PI * 0.75} />
      <Container at={[22.5, 0, -21]} yaw={-Math.PI / 4} colour={BLUE} />
      <Container at={[17, 0, -23.5]} yaw={-Math.PI / 5} colour={ORANGE} />
    </group>
  )
}

function ChallengeCell({ at, size, colour }) {
  return <group><DecalRect pos={[at[0], 0.012, at[1]]} size={size} colour="#3d444a" opacity={0.88} /><DecalFrame at={at} size={size} colour={colour} /></group>
}

function ChallengeWalls({ at, size, physics, opening }) {
  const [w, d] = size
  const sideX = opening === 'left' ? at[0] + w / 2 : at[0] - w / 2
  return <group>
    <StaticBox physics={physics} pos={[at[0], 0.42, at[1] - d / 2]} size={[w, 0.84, 0.3]} colour={BLUE} />
    <StaticBox physics={physics} pos={[at[0], 0.42, at[1] + d / 2]} size={[w, 0.84, 0.3]} colour={BLUE} />
    <StaticBox physics={physics} pos={[sideX, 0.42, at[1]]} size={[0.3, 0.84, d]} colour={BLUE} />
  </group>
}

function HeightGauge({ at }) {
  return <group position={[at[0], 0, at[1]]}><mesh position={[0, 2.1, 0]}><boxGeometry args={[0.34, 4.2, 0.34]} /><Toon color={BLUE_DARK} /></mesh>{[0.8, 1.5, 2.2, 2.9, 3.6].map((y, i) => <mesh key={y} position={[0.28, y, 0]}><boxGeometry args={[0.42 + i * 0.08, 0.1, 0.12]} /><Toon color={i < 3 ? TEAL : ORANGE} /></mesh>)}</group>
}

function Bollard({ at, colour }) {
  return <group position={[at[0], 0, at[1]]}><mesh position={[0, 0.1, 0]}><cylinderGeometry args={[0.36, 0.42, 0.2, 14]} /><Toon color={BLUE_DARK} /></mesh><mesh position={[0, 0.65, 0]}><cylinderGeometry args={[0.22, 0.27, 1.1, 14]} /><Toon color={colour} /></mesh></group>
}

/* ===================================================== line follower lab */

function LineLab({ map, physics, mission }) {
  const track = getLineTrack(mission.track)
  const [surfaceX, surfaceZ] = map.surface.center
  const [surfaceWidth, surfaceDepth] = map.surface.size
  return (
    <group>
      <Perimeter half={map.half} physics={physics} colour="#b9c8cc" posts />
      {/* One generous, glare-free white calibration floor. Only the selected
          course is painted, so the downward sensor and the learner both see
          one unambiguous black target instead of three overlapping examples. */}
      <DecalRect pos={[surfaceX, 0.008, surfaceZ]} size={[surfaceWidth, surfaceDepth]} colour="#fbfbf7" opacity={1} />
      <DecalFrame at={[surfaceX, surfaceZ]} size={[surfaceWidth, surfaceDepth]} colour="#91a6ad" />
      <TrackRibbon points={track.points} width={track.width} colour="#23282f" />
      <StartBox />
      <TrackCheckpoints track={track} />
      <group position={[-20.5, 0, -9.2]}>{['#232323', '#fbfbf7', '#8d969a'].map((colour, i) => <DecalRect key={colour} pos={[i * 2.15, 0.014, 0]} size={[1.75, 2.25]} colour={colour} opacity={1} />)}</group>
      <Beacon at={[-27.5, -10.5]} colour={ORANGE} />
      <Beacon at={[27.5, -10.5]} colour="#36dfcf" />
      {[[-25.5, -12], [25.5, -12], [-25.5, 29.5], [25.5, 29.5]].map(([x, z], i) =>
        <StaticBox key={i} physics={physics} pos={[x, 0.24, z]} size={[3.8, 0.48, 0.34]} colour={i % 2 ? ORANGE : BLUE} />)}
    </group>
  )
}

function StartBox() {
  return <group><DecalRect pos={[1.5, 0.019, 0]} size={[2.1, 1.8]} colour="#f7f2e6" opacity={1} /><DecalRect pos={[1.5, 0.021, 0]} size={[0.62, 1.8]} colour="#23282f" opacity={1} /><mesh position={[1.5, 0.42, -1.4]}><boxGeometry args={[0.22, 0.84, 0.22]} /><Toon color={BLUE} /></mesh><mesh position={[1.5, 0.85, -1.4]}><sphereGeometry args={[0.22, 12, 8]} /><Toon color={TEAL} /></mesh></group>
}

function TrackCheckpoints({ track }) {
  return <group>{track.checkpoints.map(([x, z], i) =>
    <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.025, z]}>
      <ringGeometry args={[0.92, 1.06, 32]} />
      <meshBasicMaterial color={i === track.checkpoints.length - 1 ? TEAL : ORANGE} transparent opacity={0.72} />
    </mesh>)}</group>
}

function TrackRibbon({ points, width, colour }) {
  const geometry = useMemo(() => ribbonGeometry(points, width), [points, width])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} position={[0, 0.018, 0]}><meshBasicMaterial color={colour} side={THREE.DoubleSide} /></mesh>
}

function Road({ points, width }) {
  return <TrackRibbon points={points} width={width} colour="#3d444a" />
}

function RoadArrow({ at, yaw = 0 }) {
  return <group position={[at[0], 0.035, at[1]]} rotation={[0, yaw, 0]}>
    <mesh><boxGeometry args={[1.05, 0.025, 0.25]} /><meshBasicMaterial color="#f4efe4" /></mesh>
    <mesh position={[0.5, 0, -0.22]} rotation={[0, -0.55, 0]}><boxGeometry args={[0.72, 0.025, 0.24]} /><meshBasicMaterial color="#f4efe4" /></mesh>
    <mesh position={[0.5, 0, 0.22]} rotation={[0, 0.55, 0]}><boxGeometry args={[0.72, 0.025, 0.24]} /><meshBasicMaterial color="#f4efe4" /></mesh>
  </group>
}

function CraneStation({ at }) {
  return <group position={[at[0], 0, at[1]]}>
    <StaticBox pos={[0, 0.18, 0]} size={[2.2, 0.36, 2.2]} colour="#244f8f" />
    <StaticBox pos={[0, 1.75, 0]} size={[0.52, 3.2, 0.52]} colour="#e7b72f" />
    <StaticBox pos={[-1.25, 3.12, 0]} rot={[0, 0, -0.48]} size={[2.8, 0.42, 0.42]} colour="#e7b72f" />
    <mesh position={[-2.25, 1.85, 0]}><cylinderGeometry args={[0.055, 0.055, 2.1, 8]} /><Toon color="#30363d" /></mesh>
    <mesh position={[-2.25, 0.78, 0]} rotation={[0, 0, Math.PI]}><torusGeometry args={[0.24, 0.08, 8, 14, Math.PI * 1.45]} /><Toon color="#30363d" /></mesh>
  </group>
}

function ribbonGeometry(points, width) {
  const positions = []
  const indices = []
  const last = points.length - 1
  const closed = last > 1 && Math.hypot(points[0][0] - points[last][0], points[0][1] - points[last][1]) < 1e-5
  // One shared vertex pair per sample. Independent segment quads left tiny
  // floor-coloured wedges at every bend; averaged tangents create a continuous
  // tape surface that is also exactly what the line sensor tests.
  for (let i = 0; i < points.length; i++) {
    const prev = points[i === 0 ? (closed ? last - 1 : 0) : i - 1]
    const next = points[i === last ? (closed ? 1 : last) : i + 1]
    const dx = next[0] - prev[0]
    const dz = next[1] - prev[1]
    const len = Math.hypot(dx, dz) || 1
    const nx = (-dz / len) * width / 2
    const nz = (dx / len) * width / 2
    positions.push(points[i][0] + nx, 0, points[i][1] + nz, points[i][0] - nx, 0, points[i][1] - nz)
    if (i > 0) {
      const base = i * 2
      indices.push(base - 2, base - 1, base, base, base - 1, base + 1)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/* =========================================================== mission kit */

function MissionProps({ mission, physics }) {
  const { flag, props = {} } = mission
  const checkpoints = mission.kind === 'checkpoints' ? mission.checkpoints : []
  return <group>{flag && <Flag position={[flag[0], 0, flag[1]]} radius={mission.reachRadius} />}{checkpoints?.map((at, i) => <CheckpointMarker key={i} at={at} index={i} />)}{(props.rocks ?? []).map(([x, z], i) => <StaticBox key={`gate${i}`} physics={physics} pos={[x, 0.55, z]} size={[0.9, 1.1, 0.9]} colour={C.rock} />)}{props.square && <PadMarker at={props.square} radius={props.square[2]} colour={props.goalColour ?? '#f3c243'} shape="square" />}{props.liftZone && <LiftZone at={props.liftZone} />}{props.crate && <Crate at={props.crate} physics={physics} />}</group>
}

function CheckpointMarker({ at, index }) {
  const progress = useUiStore((s) => s.missionProgress.current)
  const active = index === progress
  const passed = index < progress
  return <PadMarker at={at} colour={passed ? TEAL : active ? ORANGE : '#8f969c'} shape={index % 2 ? 'square' : 'circle'} />
}

function LiftZone({ at }) {
  return <group><PadMarker at={at} radius={1.6} colour="#f3c243" shape="square" /><mesh position={[at[0], at[2], at[1]]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.25, 1.42, 4]} /><meshBasicMaterial color={TEAL} transparent opacity={0.65} /></mesh></group>
}

function Flag({ position, radius = 1.8 }) {
  const pole = useRef()
  const ring = useRef()
  useFrame(({ clock }) => {
    const tt = clock.elapsedTime
    if (pole.current) pole.current.rotation.y = tt * 0.8
    if (ring.current) { const k = (tt * 0.6) % 1; ring.current.scale.setScalar(0.6 + k * 0.8); ring.current.material.opacity = 0.5 * (1 - k) }
  })
  return <group position={position}><mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}><circleGeometry args={[radius, 40]} /><meshBasicMaterial color={TEAL} transparent opacity={0.22} depthWrite={false} /></mesh><mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}><ringGeometry args={[radius * 0.86, radius, 40]} /><meshBasicMaterial color={TEAL} transparent opacity={0.5} depthWrite={false} /></mesh><group ref={pole}><mesh position={[0, 0.75, 0]}><cylinderGeometry args={[0.06, 0.06, 1.5, 10]} /><Toon color="#e8e2d3" /></mesh><mesh position={[0.38, 1.28, 0]}><boxGeometry args={[0.72, 0.42, 0.05]} /><Toon color={TEAL} /></mesh></group></group>
}

function Crate({ at, physics }) {
  const body = useRef()
  useFrame(() => { if (body.current) { const p = body.current.translation(); rt.cratePos = [p.x, p.y, p.z] } })
  const mesh = <CrateMesh />
  if (!physics) return <group position={[at[0], 0.58, at[1]]}>{mesh}</group>
  return <RigidBody ref={body} type="dynamic" colliders={false} position={[at[0], 0.62, at[1]]} linearDamping={0.42} angularDamping={0.72} ccd><CuboidCollider args={[0.58, 0.58, 0.58]} friction={0.82} density={0.34} collisionGroups={WORLD_GROUP} />{mesh}</RigidBody>
}

function CrateMesh() {
  return <group><mesh castShadow receiveShadow><boxGeometry args={[1.16, 1.16, 1.16]} /><Toon color="#bd864e" /></mesh>{[-0.48, 0.48].flatMap((x) => [-0.48, 0.48].map((z) => <mesh key={`${x}-${z}`} position={[x, 0, z]}><boxGeometry args={[0.1, 1.2, 0.1]} /><Toon color="#725039" /></mesh>))}<mesh rotation={[0, 0, Math.PI / 4]}><boxGeometry args={[0.08, 1.58, 1.18]} /><Toon color="#8e603d" /></mesh></group>
}

/* =========================================================== shared props */

function StaticBox({ physics = false, pos, size, rot = [0, 0, 0], colour, friction = ARENA.friction }) {
  const visual = <group position={pos} rotation={rot}><mesh castShadow receiveShadow><boxGeometry args={size} /><Toon color={colour} /></mesh></group>
  if (!physics) return visual
  return <RigidBody type="fixed" colliders={false}>{visual}<group position={pos} rotation={rot}><CuboidCollider args={size.map((v) => v / 2)} friction={friction} collisionGroups={WORLD_GROUP} /></group></RigidBody>
}

function StaticCylinder({ physics = false, at, radius, height, rot = [0, 0, 0], colour }) {
  const visual = <group position={at} rotation={rot}><mesh castShadow receiveShadow><cylinderGeometry args={[radius, radius, height, 14]} /><Toon color={colour} /></mesh></group>
  if (!physics) return visual
  return <RigidBody type="fixed" colliders={false}>{visual}<group position={at} rotation={rot}><CylinderCollider args={[height / 2, radius]} friction={1.05} collisionGroups={WORLD_GROUP} /></group></RigidBody>
}

function Perimeter({ half, physics, colour, posts = false }) {
  const thickness = 0.42
  return <group><StaticBox physics={physics} pos={[0, 0.48, half]} size={[half * 2, 0.96, thickness]} colour={colour} /><StaticBox physics={physics} pos={[0, 0.48, -half]} size={[half * 2, 0.96, thickness]} colour={colour} /><StaticBox physics={physics} pos={[half, 0.48, 0]} size={[thickness, 0.96, half * 2]} colour={colour} /><StaticBox physics={physics} pos={[-half, 0.48, 0]} size={[thickness, 0.96, half * 2]} colour={colour} />{posts && [-half, -half / 2, 0, half / 2, half].flatMap((offset) => [[offset, half], [offset, -half], [half, offset], [-half, offset]]).map(([x, z], i) => <mesh key={`${x}-${z}-${i}`} position={[x, 0.75, z]}><boxGeometry args={[0.62, 1.5, 0.62]} /><Toon color={i % 2 ? ORANGE : BLUE_DARK} /></mesh>)}</group>
}

function CheckpointGate({ at, yaw = 0 }) {
  return <group position={[at[0], 0, at[1]]} rotation={[0, yaw, 0]}>{[-3.9, 3.9].map((x) => <mesh key={x} position={[x, 1.1, 0]}><boxGeometry args={[0.42, 2.2, 0.42]} /><Toon color={BLUE_DARK} /></mesh>)}<mesh position={[0, 2.05, 0]}><boxGeometry args={[8.2, 0.34, 0.42]} /><Toon color={ORANGE} /></mesh></group>
}

function ServiceShed({ at, yaw = 0 }) {
  return <group position={at} rotation={[0, yaw, 0]}><mesh position={[0, 1.45, 0]} castShadow receiveShadow><boxGeometry args={[7.2, 2.9, 4.8]} /><Toon color="#66737c" /></mesh><mesh position={[0, 3.02, 0]}><boxGeometry args={[7.8, 0.22, 5.35]} /><Toon color={BLUE} /></mesh><mesh position={[0, 1.35, 2.43]}><boxGeometry args={[3.2, 2.45, 0.08]} /><Toon color="#263746" /></mesh></group>
}

function Container({ at, yaw = 0, colour }) {
  return <group position={at} rotation={[0, yaw, 0]}><mesh position={[0, 1.25, 0]} castShadow receiveShadow><boxGeometry args={[5.2, 2.5, 2.6]} /><Toon color={colour} /></mesh>{[-2, -1, 0, 1, 2].map((x) => <mesh key={x} position={[x, 1.25, 1.315]}><boxGeometry args={[0.07, 2.2, 0.06]} /><Toon color="#244b79" /></mesh>)}</group>
}

function ShrubRing() {
  const shrubs = [[-26, -17], [-25, 18], [-8, 27], [8, -27], [26, 18], [27, -8]]
  return <group>{shrubs.map(([x, z], i) => <group key={i} position={[x, 0, z]}>{[[0, 0, 0.9], [0.7, 0.2, 0.62], [-0.6, 0.3, 0.7]].map(([dx, dz, r], j) => <mesh key={j} position={[dx, r * 0.72, dz]}><dodecahedronGeometry args={[r, 0]} /><Toon color={j % 2 ? '#6b8650' : '#537343'} /></mesh>)}</group>)}</group>
}

function Beacon({ at, colour }) {
  return <group position={[at[0], 0, at[1]]}><mesh position={[0, 0.65, 0]}><boxGeometry args={[0.3, 1.3, 0.3]} /><Toon color={BLUE_DARK} /></mesh><mesh position={[0, 1.4, 0]}><sphereGeometry args={[0.28, 14, 10]} /><Toon color={colour} /></mesh><pointLight position={[0, 1.4, 0]} color={colour} intensity={0.45} distance={5} /></group>
}

function PadMarker({ at, radius = 1.5, colour, shape = 'circle', subtle = false }) {
  return <mesh rotation={[-Math.PI / 2, 0, shape === 'square' ? Math.PI / 4 : 0]} position={[at[0], 0.026, at[1]]}>{shape === 'square' ? <ringGeometry args={[radius * 0.72, radius, 4]} /> : <ringGeometry args={[radius * 0.72, radius, 36]} />}<meshBasicMaterial color={colour} transparent opacity={subtle ? 0.38 : 0.82} side={THREE.DoubleSide} /></mesh>
}

function DecalRect({ pos, size, colour, opacity = 1 }) {
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={pos}><planeGeometry args={size} /><meshBasicMaterial color={colour} transparent={opacity < 1} opacity={opacity} depthWrite={opacity === 1} /></mesh>
}

function DecalFrame({ at, size, colour }) {
  const [w, d] = size
  return <group>{[[at[0], at[1] - d / 2, w, 0.18], [at[0], at[1] + d / 2, w, 0.18], [at[0] - w / 2, at[1], 0.18, d], [at[0] + w / 2, at[1], 0.18, d]].map(([x, z, rw, rd], i) => <DecalRect key={i} pos={[x, 0.02, z]} size={[rw, rd]} colour={colour} />)}</group>
}
