import * as THREE from 'three'

/**
 * DUPONT LEAD ROUTING.
 *
 * One place decides the shape of every cable, so the fixed harness and the
 * interactive layer cannot drift apart.
 *
 * Three things shape the curve, in this order:
 *
 * 1. VERTICAL EXIT. A Dupont connector is a rigid plastic head about 6 mm
 *    long. The wire leaves it along the pin axis and only then bends. Curves
 *    that ran straight from pin to pin left the lead entering the header at a
 *    shallow angle and reading as solder, not a plug — so both ends now get a
 *    control point lifted straight up before anything else happens.
 *
 * 2. AN ARCH OVER WHAT IS IN THE WAY. The board, the chassis strips and the
 *    motor bodies all sit between the two pins a lead usually joins. A curve
 *    that only sags dives straight through them. The middle of the span is
 *    therefore lifted clear of the highest obstacle the caller declares,
 *    rather than dropped.
 *
 * 3. SAG, ON WHAT IS LEFT. Slack still scales with the run, but it is applied
 *    to the arch rather than to a straight line: long spans hang, short hops
 *    stay taut, and neither passes through anything.
 */

/** Height of the rigid connector head — how far a lead runs before it bends. */
export const EXIT_RISE = 0.26

/**
 * Control points for one lead.
 *
 * `clearance` is the world Y the middle of the cable must stay above; callers
 * pass the top of whatever lies between the endpoints. Pass 0 and the lead
 * behaves like a plain hanging cable.
 */
export function wirePoints(from, to, clearance = 0) {
  const a = new THREE.Vector3(...from)
  const b = new THREE.Vector3(...to)

  // Both ends leave along +Y first: this is the plug, not the cable.
  const aOut = a.clone().setY(a.y + EXIT_RISE)
  const bOut = b.clone().setY(b.y + EXIT_RISE)

  const span = aOut.distanceTo(bOut)

  // Slack grows with the run and is capped, so a long lead hangs without
  // touching the floor and a short one stays taut instead of looping.
  const sag = Math.min(0.34, Math.max(0, (span - 0.5) * 0.16))

  // The mid-span must clear both the exits and anything declared in the way.
  const ridge = Math.max(aOut.y, bOut.y, clearance + EXIT_RISE * 0.6)

  const at = (t) => {
    const p = aOut.clone().lerp(bOut, t)
    // Lift to the ridge across the middle of the span, easing in and out so
    // the join at each end stays smooth, then let gravity take some back.
    const lift = Math.sin(Math.PI * t)
    p.y = p.y * (1 - lift) + ridge * lift - sag * lift
    return p
  }

  return [a, aOut, at(0.35), at(0.65), bOut, b]
}

/** The finished curve. Centripetal keeps it from overshooting at the corners. */
export function wireCurve(from, to, clearance = 0) {
  return new THREE.CatmullRomCurve3(wirePoints(from, to, clearance), false, 'centripetal', 0.5)
}

/**
 * Moving-machine variant: the endpoints stay plugged in while the flexible
 * middle hangs under gravity. Unlike bench wiring it does not arch above the
 * tallest endpoint — that made a tall robot arm wear a crown of floating
 * cables. The floor clamp keeps generous slack from clipping underground.
 */
export function flexibleWireCurve(from, to) {
  const a = new THREE.Vector3(...from)
  const b = new THREE.Vector3(...to)
  const aOut = a.clone().add(new THREE.Vector3(0, EXIT_RISE * 0.75, 0))
  const bOut = b.clone().add(new THREE.Vector3(0, EXIT_RISE * 0.75, 0))
  const horizontal = Math.hypot(b.x - a.x, b.z - a.z)
  const sag = Math.min(2.4, 0.18 + horizontal * 0.12 + Math.abs(b.y - a.y) * 0.035)
  const hanging = (t) => {
    const p = aOut.clone().lerp(bOut, t)
    p.y = Math.max(0.22, p.y - Math.sin(Math.PI * t) * sag)
    return p
  }
  return new THREE.CatmullRomCurve3([a, aOut, hanging(0.28), hanging(0.5), hanging(0.72), bOut, b], false, 'centripetal', 0.5)
}

/**
 * Tube geometry for a lead.
 *
 * Segment count scales with length so a short hop is not over-tessellated and
 * a long one does not go faceted.
 */
export function wireGeometry(from, to, { clearance = 0, radius = 0.035 } = {}) {
  const curve = wireCurve(from, to, clearance)
  const span = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2])
  const segments = Math.max(20, Math.min(48, Math.round(span * 14)))
  return new THREE.TubeGeometry(curve, segments, radius, 6, false)
}
