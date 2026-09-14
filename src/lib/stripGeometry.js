import * as THREE from 'three'
import { Brush, Evaluator, ADDITION, SUBTRACTION } from 'three-bvh-csg'
import {
  PITCH,
  STRIP_W,
  STRIP_T,
  HOLE_R,
  stripHoles,
  stripLength,
} from './config.js'
import { deckHoles, deckSize } from './parts.js'

/**
 * Perforated construction strips, cut with real boolean geometry.
 *
 * The important discipline here is *precompute once, reuse forever*: CSG is
 * expensive, so each hole-count is built a single time at startup and the
 * resulting BufferGeometry is shared by every strip of that length in the
 * scene. Nothing is ever re-cut while the student is building.
 */

const cache = new Map()
const evaluator = new Evaluator()
evaluator.useGroups = false

function makeStrip(holes) {
  const len = stripLength(holes)
  const bodyLen = len - STRIP_W // the straight part; ends are half-rounds

  // Straight middle section.
  let result = new Brush(new THREE.BoxGeometry(bodyLen, STRIP_T, STRIP_W))
  result.updateMatrixWorld()

  // Rounded ends — real strips are stamped with radiused tips, and the
  // silhouette is what makes them read as "metal part" instead of "grey box".
  for (const sign of [-1, 1]) {
    const cap = new Brush(
      new THREE.CylinderGeometry(STRIP_W / 2, STRIP_W / 2, STRIP_T, 20),
    )
    cap.position.set((sign * bodyLen) / 2, 0, 0)
    cap.updateMatrixWorld()
    result = evaluator.evaluate(result, cap, ADDITION)
  }

  // Punch the holes.
  for (const x of stripHoles(holes)) {
    const hole = new Brush(
      new THREE.CylinderGeometry(HOLE_R, HOLE_R, STRIP_T * 3, 18),
    )
    hole.position.set(x, 0, 0)
    hole.updateMatrixWorld()
    result = evaluator.evaluate(result, hole, SUBTRACTION)
  }

  const geometry = result.geometry
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

/** Shared, cut-once geometry for a strip with `holes` holes. */
export function getStripGeometry(holes) {
  if (!cache.has(holes)) cache.set(holes, makeStrip(holes))
  return cache.get(holes)
}

/**
 * A cheap convex box collider per hole-span rather than a trimesh of the
 * perforated shape: colliders should match the *silhouette* the student sees,
 * and holes are not something anything can fall into at this scale.
 */
export function stripColliderArgs(holes) {
  return [stripLength(holes) / 2, STRIP_T / 2, STRIP_W / 2]
}

export { PITCH, STRIP_W, STRIP_T, stripHoles, stripLength }

/**
 * The perforated deck plate: same cut-once discipline as the strips, one
 * shared geometry for every deck in the scene.
 */
let deckGeometry = null
export function getDeckGeometry() {
  if (deckGeometry) return deckGeometry
  const [w, d] = deckSize()
  let result = new Brush(new THREE.BoxGeometry(w, STRIP_T, d))
  result.updateMatrixWorld()
  for (const [x, , z] of deckHoles()) {
    const hole = new Brush(new THREE.CylinderGeometry(HOLE_R, HOLE_R, STRIP_T * 3, 14))
    hole.position.set(x, 0, z)
    hole.updateMatrixWorld()
    result = evaluator.evaluate(result, hole, SUBTRACTION)
  }
  deckGeometry = result.geometry
  deckGeometry.computeVertexNormals()
  deckGeometry.computeBoundingBox()
  deckGeometry.computeBoundingSphere()
  return deckGeometry
}

export const deckColliderArgs = () => {
  const [w, d] = deckSize()
  return [w / 2, STRIP_T / 2, d / 2]
}
