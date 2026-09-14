import { Suspense, useEffect } from 'react'
import * as THREE from 'three'
import { Canvas, useThree } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { PHYSICS } from '../lib/config.js'
import { useBuildStore } from '../store/useBuildStore.js'
import { useUiStore } from '../store/useUiStore.js'
import Terrain from './Terrain.jsx'
import { StaticBuild, PhysicsBuild } from './Build.jsx'
import Placement from './Placement.jsx'
import Runtime from './Runtime.jsx'
import SensorRay from './SensorRay.jsx'
import { CameraRig, FpsGuard, Puffs, SceneProbe } from './Effects.jsx'
import { getMap } from '../lib/maps.js'

/**
 * The 3D stage.
 *
 * The important structural decision is the two-mode build:
 *
 *   not running -> `StaticBuild`, plain meshes at exactly the stored numbers.
 *                  Nothing settles, drifts or falls over while you work.
 *   running     -> `PhysicsBuild`, real Rapier bodies and joints, dropped onto
 *                  the terrain.
 *
 * `<Physics>` is recreated on each Run so restart begins with a clean world.
 */
/** Space each drawer takes out of the view, open and closed. */
const INSET = { left: [270, 46], right: [348, 46], top: [66, 66], bottom: [330, 62] }

/**
 * Keep the robot in the part of the window you can actually see.
 *
 * The canvas fills the whole window and the panels float over it, so the
 * geometric centre of the canvas is often underneath a drawer. Rather than
 * shrinking the canvas — which would put a hard edge back around the scene —
 * the camera's frustum is shifted so that "centre" means the centre of the
 * *uncovered* area. Open a panel and the robot slides politely out from under
 * it.
 */
function ViewportOffset() {
  const camera = useThree((s) => s.camera)
  const width = useThree((s) => s.size.width)
  const height = useThree((s) => s.size.height)
  const drawers = useUiStore((s) => s.drawers)

  useEffect(() => {
    const left = INSET.left[drawers.left ? 0 : 1]
    const right = INSET.right[drawers.right ? 0 : 1]
    const bottom = INSET.bottom[drawers.bottom ? 0 : 1]
    const dx = (left - right) / 2
    const dy = (INSET.top[0] - bottom) / 2
    camera.setViewOffset(width, height, -dx, -dy, width, height)
    camera.updateProjectionMatrix()
    return () => {
      camera.clearViewOffset()
      camera.updateProjectionMatrix()
    }
  }, [camera, width, height, drawers.left, drawers.right, drawers.bottom])

  return null
}

export default function Scene() {
  const running = useBuildStore((s) => s.running)
  const select = useBuildStore((s) => s.select)
  const quality = useUiStore((s) => s.quality)
  const map = getMap(useUiStore((s) => s.map))
  const shadowSize = quality === 'high' ? 2048 : 512

  return (
    <div className="stage">
      <Canvas
        shadows="percentage"
        // Never let adaptive quality turn thin tape, bolt holes and leads into
        // a 1× blurry image. Low mode sheds shadows/outlines; it retains enough
        // pixel density for small engineering detail to stay legible.
        dpr={[1.35, quality === 'high' ? 2 : 1.5]}
        gl={{ antialias: true, toneMapping: THREE.NoToneMapping, powerPreference: 'high-performance' }}
        camera={{ position: [9.5, 7.5, 11.5], fov: 34, near: 0.1, far: 260 }}
        onPointerMissed={() => select(null)}
      >
        <color attach="background" args={[map.sky]} />
        <fog attach="fog" args={map.fog} />

        {/* One key light with shadows, one soft fill. Cel shading wants a
            single clear light direction — more lights muddy the bands. */}
        <directionalLight
          position={[10, 15, 8]}
          intensity={2.5}
          castShadow
          shadow-mapSize-width={shadowSize}
          shadow-mapSize-height={shadowSize}
          shadow-radius={4}
          shadow-camera-left={-36}
          shadow-camera-right={36}
          shadow-camera-top={36}
          shadow-camera-bottom={-36}
          shadow-bias={-0.0006}
        />
        <ambientLight intensity={0.85} />
        <hemisphereLight args={['#e2f0fb', '#8a7d5f', 0.6]} />
        {/* A cool back-light so silhouettes separate from the ground instead
            of melting into it. Cheap, and it does most of the work of making
            the render look considered rather than flat. */}
        <directionalLight position={[-9, 6, -8]} intensity={0.55} color="#bcd6ec" />

        <Suspense fallback={null}>
          {running ? (
            // The physics world is created fresh on every Run and thrown away
            // on Stop. Keeping a paused world alive between runs sounds
            // cheaper, but it carries a time accumulator across the pause and
            // dumps it into the first step — which detonated the robot every
            // time. A fresh world always starts from a clean, zero-energy state.
            <Physics
              gravity={PHYSICS.gravity}
              numSolverIterations={PHYSICS.solverIterations}
              timeStep={1 / 60}
              // Physics runs on its own fixed clock rather than the render
              // loop, so a slow frame can never hand the solver a huge delta.
              updateLoop="independent"
            >
              <Terrain physics />
              <PhysicsBuild />
              {/* Inside <Physics> on purpose: the sensor raycast needs the
                  Rapier world, which Runtime (mounted outside) cannot reach. */}
              <SensorRay />
            </Physics>
          ) : (
            <>
              <Terrain />
              <StaticBuild />
            </>
          )}
        </Suspense>

        <ViewportOffset />
        <Placement />
        <Runtime />
        <Puffs />
        <CameraRig />
        <FpsGuard />
        <SceneProbe />
      </Canvas>
    </div>
  )
}
