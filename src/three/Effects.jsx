import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import { useUiStore } from '../store/useUiStore.js'
import { useBuildStore } from '../store/useBuildStore.js'
import { partTransform } from '../lib/geometry.js'
import { rt } from './runtime.js'
import { getMap } from '../lib/maps.js'

/* ============================================================ camera (Part 6) */

const VIEWS = {
  default: [9.5, 7.5, 11.5, 0, 0.6, 0],
  front: [0.01, 3.4, 12.5, 0, 0.6, 0],
  top: [0.01, 15, 0.02, 0, 0, 0],
  side: [13.5, 3.8, 0.01, 0, 0.6, 0],
}

export function CameraRig() {
  const controls = useRef()
  const request = useUiStore((s) => s.cameraRequest)
  const mapId = useUiStore((s) => s.map)
  const workflowMode = useUiStore((s) => s.workflowMode)
  const clear = useUiStore((s) => s.clearCameraRequest)
  const parts = useBuildStore((s) => s.parts)
  const running = useBuildStore((s) => s.running)
  const follow = useRef(null)
  const hasAnchoredPart = Object.values(parts).some((part) => part.anchored)

  // While the simulation runs, the camera keeps the robot in shot. A rover
  // that drives out of frame is the fastest way to make a child think the
  // program did nothing. The orbit angle and zoom are untouched — only the
  // point the camera is looking at moves, and it moves smoothly.
  useFrame((_, delta) => {
    // Anchored mechanisms do not travel across the map. Following their root
    // would drag the target back down to the bench every frame and crop a tall
    // arm just after the wider Run framing above has centred it.
    if (!running || hasAnchoredPart || !controls.current) return
    const [x, y, z] = rt.robotPos
    if (x === 0 && y === 0 && z === 0) return
    if (!follow.current) follow.current = [x, y, z]
    const k = 1 - Math.exp(-3.4 * delta)
    follow.current[0] += (x - follow.current[0]) * k
    follow.current[1] += (y - follow.current[1]) * k
    follow.current[2] += (z - follow.current[2]) * k
    controls.current.moveTo(follow.current[0], follow.current[1], follow.current[2], false)
  })

  useEffect(() => {
    if (!running) follow.current = null
  }, [running])

  // A bench-anchored arm can more than double its vertical extent after a
  // servo command. Give mechanisms a wider engineering shot as Run begins;
  // rover maps retain their closer follow camera.
  useEffect(() => {
    if (!running || !hasAnchoredPart || !controls.current) return
    const box = buildBounds(parts)
    // Leave room for the Parts drawer and for a linkage that straightens past
    // its authored pose. The arm's live reach is ~1.55× its folded bounds.
    const size = Math.max(36, box.radius * 4.2)
    controls.current.setLookAt(
      box.cx + size * 0.62,
      box.cy + size * 0.48,
      box.cz + size * 0.78,
      box.cx,
      box.cy + Math.min(2.5, box.radius * 0.25),
      box.cz,
      true,
    )
  }, [running, hasAnchoredPart, parts])

  useEffect(() => {
    if (!request || !controls.current) return
    const c = controls.current

    if (request.view === 'focus' && request.focusId) {
      const part = parts[request.focusId]
      if (part) {
        const t = partTransform(part, parts) ?? { pos: [0, 0, 0] }
        c.setLookAt(t.pos[0] + 3.2, (t.pos[1] ?? 0) + 2.6, t.pos[2] + 3.2, t.pos[0], t.pos[1] ?? 0, t.pos[2], true)
      }
    } else if (request.view === 'frameAll') {
      const box = buildBounds(parts)
      const size = Math.max(4, box.radius * 2.0)
      c.setLookAt(
        box.cx + size * 0.62,
        box.cy + size * 0.58,
        box.cz + size * 0.78,
        box.cx,
        box.cy,
        box.cz,
        true,
      )
    } else if (request.view === 'mapHome') {
      const map = getMap(mapId)
      c.setLookAt(...map.camera, ...map.target, true)
    } else if (workflowMode === 'simulate' && ['top', 'front', 'side'].includes(request.view)) {
      const map = getMap(mapId)
      const [tx, ty, tz] = map.target
      const reach = map.size * 0.72
      const height = map.size * 0.32
      if (request.view === 'top') c.setLookAt(tx + 0.01, reach, tz + 0.02, tx, ty, tz, true)
      if (request.view === 'front') c.setLookAt(tx, height, tz + reach, tx, ty, tz, true)
      if (request.view === 'side') c.setLookAt(tx + reach, height, tz, tx, ty, tz, true)
    } else {
      const v = VIEWS[request.view] ?? VIEWS.default
      c.setLookAt(...v, true)
    }
    clear()
  }, [request, clear, parts, mapId, workflowMode])

  return (
    <CameraControls
      ref={controls}
      makeDefault
      minPolarAngle={0.18}
      maxPolarAngle={Math.PI / 2 - 0.06}
      minDistance={3}
      maxDistance={96}
      smoothTime={0.24}
      draggingSmoothTime={0.1}
    />
  )
}

function buildBounds(parts) {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const p of Object.values(parts)) {
    const pos = partTransform(p, parts)?.pos ?? null
    if (!pos) continue
    minX = Math.min(minX, pos[0])
    maxX = Math.max(maxX, pos[0])
    minZ = Math.min(minZ, pos[2])
    maxZ = Math.max(maxZ, pos[2])
    minY = Math.min(minY, pos[1])
    maxY = Math.max(maxY, pos[1])
  }
  if (!Number.isFinite(minX)) return { cx: 0, cy: 0.6, cz: 0, radius: 3 }
  const spanX = maxX - minX
  const spanY = maxY - minY
  const spanZ = maxZ - minZ
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    cz: (minZ + maxZ) / 2,
    radius: Math.max(1.5, Math.hypot(spanX, spanY, spanZ) / 2 + 1.5),
  }
}

/* ================================================= adaptive quality (Part 10) */

/**
 * Watches a rolling frame-rate average and quietly drops the expensive bits
 * (outlines, shadow resolution) if the machine can't keep up. Hysteresis is
 * asymmetric on purpose: quick to drop quality, slow to restore it, so the
 * setting can't oscillate every few frames on a borderline laptop.
 */
/**
 * Scene probe for the headless harnesses.
 *
 * Reports what is actually in the graph — mesh count, triangle totals and the
 * heaviest object — which is the only way to tell "the model rendered wrong"
 * apart from "the model is not there at all" from outside the canvas.
 */
export function SceneProbe() {
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)

  /*
   * The camera matrices as of the last rendered frame.
   *
   * project() below is called from outside the render loop, and the matrices
   * are not the same then as they are during it — this scene shifts the
   * frustum with setViewOffset (see ViewportOffset in Scene.jsx) and rebuilds
   * it whenever a drawer opens or closes. Reading them mid-frame and caching
   * meant the harness aimed the mouse ~45 px away from where the wiring layer
   * thought the pin was, so a drag onto D9 kept snapping to its neighbours.
   */
  const frameCam = useRef({ proj: new THREE.Matrix4(), view: new THREE.Matrix4() })
  useFrame(() => {
    frameCam.current.proj.copy(camera.projectionMatrix)
    frameCam.current.view.copy(camera.matrixWorldInverse)
  })

  useEffect(() => {
    window.__ARDUINIUM_SCENE__ = () => {
      let meshes = 0
      let tris = 0
      let heaviest = null
      const materials = new Set()
      const box = new THREE.Box3()
      scene.traverse((o) => {
        if (!o.isMesh || !o.geometry?.attributes?.position) return
        meshes++
        const g = o.geometry
        for (const material of Array.isArray(o.material) ? o.material : [o.material]) if (material) materials.add(material.uuid)
        const t = (g.index ? g.index.count : g.attributes.position.count) / 3
        tris += t
        if (!heaviest || t > heaviest.tris) {
          box.setFromObject(o)
          const size = box.getSize(new THREE.Vector3())
          heaviest = {
            tris: Math.round(t),
            verts: g.attributes.position.count,
            vertexColors: Boolean(g.attributes.color),
            material: o.material?.type,
            worldSize: [+size.x.toFixed(2), +size.y.toFixed(2), +size.z.toFixed(2)],
          }
        }
      })
      return {
        meshes,
        tris: Math.round(tris),
        heaviest,
        drawCalls: gl.info.render.calls,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        materials: materials.size,
        dpr: gl.getPixelRatio(),
        shadows: gl.shadowMap.enabled,
        /**
         * World point -> page pixels.
         *
         * Only the drag harness uses this: to press on a terminal with a real
         * mouse you have to know where on the page it landed, and that is a
         * question only the live camera and canvas rect can answer.
         */
        project: ([x, y, z]) => {
          const v = new THREE.Vector3(x, y, z)
            .applyMatrix4(frameCam.current.view)
            .applyMatrix4(frameCam.current.proj)
          const r = gl.domElement.getBoundingClientRect()
          return {
            x: Math.round(r.left + ((v.x + 1) / 2) * r.width),
            y: Math.round(r.top + ((1 - v.y) / 2) * r.height),
            behind: v.z > 1,
          }
        },
      }
    }
    return () => {
      delete window.__ARDUINIUM_SCENE__
    }
  }, [scene, gl, camera])

  return null
}

export function FpsGuard() {
  // Debug escape hatch for screenshots/tests on software renderers.
  const locked =
    typeof location !== 'undefined' && location.search.includes('quality=high')
  const setQuality = useUiStore((s) => s.setQuality)
  const gl = useThree((s) => s.gl)
  const avg = useRef(60)
  const lowFor = useRef(0)
  const highFor = useRef(0)
  const current = useRef('high')

  useFrame((_, delta) => {
    if (locked || delta <= 0) return
    const fps = 1 / delta
    avg.current += (fps - avg.current) * 0.05

    if (avg.current < 30) {
      lowFor.current += delta
      highFor.current = 0
    } else if (avg.current > 45) {
      highFor.current += delta
      lowFor.current = 0
    }

    if (current.current === 'high' && lowFor.current > 3) {
      current.current = 'low'
      setQuality('low')
      gl.shadowMap.enabled = false
      lowFor.current = 0
    } else if (current.current === 'low' && highFor.current > 6) {
      current.current = 'high'
      setQuality('high')
      gl.shadowMap.enabled = true
      highFor.current = 0
    }
  })

  return null
}

/* ================================================== magic smoke (Part 12) */

/** A short puff of grey particles wherever a motor jammed. */
export function Puffs() {
  const [puffs, setPuffs] = useState([])

  useFrame(() => {
    if (rt.puffs.length === 0) return
    const incoming = rt.puffs.splice(0, rt.puffs.length)
    setPuffs((prev) => [...prev, ...incoming].slice(-4))
  })

  return puffs.map((p) => (
    <Puff key={p.id} position={p.pos} onDone={() => setPuffs((prev) => prev.filter((x) => x.id !== p.id))} />
  ))
}

function Puff({ position, onDone }) {
  const group = useRef()
  const age = useRef(0)
  const dirs = useRef(
    Array.from({ length: 9 }, () => {
      const a = Math.random() * Math.PI * 2
      const r = 0.4 + Math.random() * 0.6
      return [Math.cos(a) * r, 0.5 + Math.random() * 0.9, Math.sin(a) * r]
    }),
  )

  useFrame((_, delta) => {
    age.current += delta
    const t = Math.min(1, age.current / 1.1)
    if (group.current) {
      group.current.children.forEach((child, i) => {
        const d = dirs.current[i]
        child.position.set(d[0] * t, d[1] * t, d[2] * t)
        child.scale.setScalar(0.12 + t * 0.34)
        child.material.opacity = 0.75 * (1 - t)
      })
    }
    if (t >= 1) onDone()
  })

  return (
    <group ref={group} position={position}>
      {dirs.current.map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshBasicMaterial
            color={i % 3 === 0 ? '#d9d4cc' : '#a9a49c'}
            transparent
            opacity={0.7}
            depthWrite={false}
            blending={THREE.NormalBlending}
          />
        </mesh>
      ))}
    </group>
  )
}
