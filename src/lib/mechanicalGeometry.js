import * as THREE from 'three'
import { ADDITION, Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg'
import { HOLE_R, MECCANO, PITCH, STRIP_T, STRIP_W } from './config.js'
import {
  gearHoles,
  gripperJawHoles,
  gripperPalmHoles,
  plate3x5Holes,
  turntableHoles,
} from './parts.js'

const cache = new Map()
const evaluator = new Evaluator()
evaluator.useGroups = false

function finish(key, brush) {
  const geometry = brush.geometry
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  cache.set(key, geometry)
  return geometry
}

function subtractHoles(body, holes, thickness, radius = HOLE_R) {
  let result = body
  for (const [x, , z] of holes) {
    const hole = new Brush(new THREE.CylinderGeometry(radius, radius, thickness * 3, 16))
    hole.position.set(x, 0, z)
    hole.updateMatrixWorld()
    result = evaluator.evaluate(result, hole, SUBTRACTION)
  }
  return result
}

export function getPlate3x5Geometry() {
  const key = 'plate3x5'
  if (cache.has(key)) return cache.get(key)
  const width = (MECCANO.plateCols - 1) * PITCH + STRIP_W
  const depth = (MECCANO.plateRows - 1) * PITCH + STRIP_W
  const body = new Brush(new THREE.BoxGeometry(width, STRIP_T, depth))
  body.updateMatrixWorld()
  return finish(key, subtractHoles(body, plate3x5Holes(), STRIP_T))
}

export function getTurntableGeometry(kind) {
  if (cache.has(kind)) return cache.get(kind)
  const radius = kind === 'turntableBase' ? MECCANO.turntableBaseRadius : MECCANO.turntableTopRadius
  const body = new Brush(new THREE.CylinderGeometry(radius, radius, MECCANO.turntableThickness, 48))
  body.updateMatrixWorld()
  return finish(kind, subtractHoles(body, turntableHoles(), MECCANO.turntableThickness))
}

function gearShape(radius, teeth) {
  const shape = new THREE.Shape()
  const root = radius * 0.83
  for (let i = 0; i < teeth * 2; i++) {
    const angle = (i / (teeth * 2)) * Math.PI * 2
    const r = i % 2 === 0 ? radius : root
    const x = Math.cos(angle) * r
    const y = Math.sin(angle) * r
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  return shape
}

export function getGearGeometry(kind) {
  if (cache.has(kind)) return cache.get(kind)
  const large = kind === 'gearLarge'
  const radius = large ? MECCANO.gearLargeRadius : MECCANO.gearSmallRadius
  const teeth = large ? 28 : 16
  const geometry = new THREE.ExtrudeGeometry(gearShape(radius, teeth), {
    depth: MECCANO.gearThickness,
    bevelEnabled: false,
    curveSegments: 1,
  })
  geometry.translate(0, 0, -MECCANO.gearThickness / 2)
  geometry.rotateX(Math.PI / 2)
  const body = new Brush(geometry)
  body.updateMatrixWorld()
  return finish(kind, subtractHoles(body, gearHoles(kind), MECCANO.gearThickness, HOLE_R * 0.82))
}

export function getGripperPalmGeometry() {
  const key = 'gripperPalm'
  if (cache.has(key)) return cache.get(key)
  const [width, depth] = MECCANO.gripperPalm
  const body = new Brush(new THREE.BoxGeometry(width, STRIP_T, depth))
  body.updateMatrixWorld()
  return finish(key, subtractHoles(body, gripperPalmHoles(), STRIP_T))
}

export function getGripperJawGeometry(kind) {
  if (cache.has(kind)) return cache.get(kind)
  const length = MECCANO.gripperJawLength
  const width = MECCANO.gripperJawWidth
  let body = new Brush(new THREE.BoxGeometry(length, STRIP_T, width))
  body.updateMatrixWorld()
  const hook = new Brush(new THREE.BoxGeometry(width * 0.75, STRIP_T, width * 1.45))
  hook.position.set((kind === 'gripperJawL' ? -1 : 1) * (length / 2 - width * 0.15), 0, width * 0.45)
  hook.rotation.y = (kind === 'gripperJawL' ? -1 : 1) * 0.35
  hook.updateMatrixWorld()
  body = evaluator.evaluate(body, hook, ADDITION)
  return finish(kind, subtractHoles(body, gripperJawHoles(), STRIP_T))
}

