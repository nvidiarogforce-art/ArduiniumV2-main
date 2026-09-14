/**
 * Tiny vector helpers shared by the per-frame physics readers (Runtime.jsx,
 * SensorRay.jsx). Plain objects in Rapier's {x,y,z} shape, no three.js — these
 * run inside useFrame and must not allocate through a math library.
 */

export const addVec = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })

/** Rotate a [x,y,z] tuple by a Rapier quaternion. */
export function rotateByQuat([x, y, z], q) {
  const ix = q.w * x + q.y * z - q.z * y
  const iy = q.w * y + q.z * x - q.x * z
  const iz = q.w * z + q.x * y - q.y * x
  const iw = -q.x * x - q.y * y - q.z * z
  return {
    x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,
    y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,
    z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x,
  }
}
