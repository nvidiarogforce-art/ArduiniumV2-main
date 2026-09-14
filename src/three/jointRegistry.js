/**
 * Where the physics layer publishes the driven wheels it created, so the
 * program runner can push the robot around.
 *
 * A plain Map rather than React state on purpose: these are read every frame
 * inside `useFrame`, and pushing them through React would re-render the scene
 * sixty times a second.
 */
export const driveWheels = new Map()

/**
 * sensorId -> { kind, body, groupId, localPos, localDir, localUp, wheelId }, registered by GroupBody alongside
 * the wheels. SensorRay.jsx samples at 10 Hz; encoder entries also publish
 * wheelRadians and wheelVelocity. Ray-based sensors query the physics world;
 * light and temperature read the controlled simulated environment.
 * localPos/localDir are in the body's local frame (== build space).
 */
export const sensorRays = new Map()
// wheelId -> {
//   pin, groupId, body: RefObject<RapierRigidBody>,
//   localPos: [x,y,z],   // wheel centre in the chassis body's own frame
//   forward: [x,y,z],    // rolling direction, in that same frame
//   spin: number,        // accumulated visual rotation, radians
// }

/** Every live rigid body in the current run, for telemetry and diagnostics. */
export const bodyRegistry = new Map()

/**
 * Resolve a build-space point through the live Rapier body that owns it.
 * Compound bodies deliberately use build space as their local frame, so the
 * conversion is exact: body rotation, then body translation.  Wiring and
 * diagnostics share this instead of keeping a second, visual-only pose model.
 */
export function liveBodyPoint(groupId, point) {
  const body = bodyRegistry.get(groupId)?.current
  if (!body) return null
  const t = body.translation()
  const q = body.rotation()
  const x = point[0], y = point[1], z = point[2]
  const ix = q.w * x + q.y * z - q.z * y
  const iy = q.w * y + q.z * x - q.x * z
  const iz = q.w * z + q.x * y - q.y * x
  const iw = -q.x * x - q.y * y - q.z * z
  return [
    ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y + t.x,
    iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z + t.y,
    iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x + t.z,
  ]
}
