/**
 * Shared line-following geometry.
 *
 * The renderer and the sensor both consume these exact samples.  That keeps a
 * black tape segment from becoming decorative while the sensor secretly tests
 * a different mathematical curve.
 */
const TAU = Math.PI * 2
// The dedicated starter replaces the rover's ultrasonic module with a
// downward line sensor on the centre of its leading cross-member.  All three
// courses begin beneath that real sensor, not merely beneath the chassis COM.
const START = [1.5, 0]

const close = (points) => [...points, points[0]]

const ellipse = () => close(Array.from({ length: 128 }, (_, i) => {
  const t = -Math.PI / 2 + (i / 128) * TAU
  return [START[0] + 8.5 * Math.cos(t), 13 + 13 * Math.sin(t)]
}))

const figure8 = () => close(Array.from({ length: 176 }, (_, i) => {
  const t = (i / 176) * TAU
  return [START[0] + 9.5 * Math.sin(t * 2), 13 - 13 * Math.cos(t)]
}))

const SWITCHBACK_NODES = [
  [1.5, 0], [8.2, 0], [10, 4.2], [6.2, 8], [-5.8, 8], [-9.2, 12.4],
  [-5.5, 17], [6.8, 17], [10, 21.5], [6.2, 26], [1.5, 26],
]

const roundedPolyline = (nodes, steps = 12) => {
  const points = []
  for (let i = 0; i < nodes.length - 1; i++) {
    const p0 = nodes[Math.max(0, i - 1)]
    const p1 = nodes[i]
    const p2 = nodes[i + 1]
    const p3 = nodes[Math.min(nodes.length - 1, i + 2)]
    for (let j = 0; j < steps; j++) {
      const t = j / steps
      const t2 = t * t
      const t3 = t2 * t
      const sample = (axis) => 0.5 * (
        2 * p1[axis] +
        (-p0[axis] + p2[axis]) * t +
        (2 * p0[axis] - 5 * p1[axis] + 4 * p2[axis] - p3[axis]) * t2 +
        (-p0[axis] + 3 * p1[axis] - 3 * p2[axis] + p3[axis]) * t3
      )
      points.push([sample(0), sample(1)])
    }
  }
  points.push(nodes[nodes.length - 1])
  return points
}

const atFractions = (points, fractions) => fractions.map((fraction) =>
  points[Math.min(points.length - 1, Math.round((points.length - 1) * fraction))])

const ovalPoints = ellipse()
const figure8Points = figure8()
const switchbackPoints = roundedPolyline(SWITCHBACK_NODES)

export const LINE_TRACKS = {
  oval: {
    id: 'oval',
    width: 0.82,
    points: ovalPoints,
    checkpoints: atFractions(ovalPoints, [0.23, 0.48, 0.73, 0.96]),
  },
  figure8: {
    id: 'figure8',
    width: 0.82,
    points: figure8Points,
    checkpoints: atFractions(figure8Points, [0.22, 0.47, 0.72, 0.96]),
  },
  switchback: {
    id: 'switchback',
    width: 0.86,
    points: switchbackPoints,
    checkpoints: atFractions(switchbackPoints, [0.22, 0.48, 0.72, 0.97]),
  },
}

export const getLineTrack = (id) => LINE_TRACKS[id] ?? LINE_TRACKS.oval

const segmentDistanceSq = (px, pz, a, b) => {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const lengthSq = dx * dx + dz * dz
  const t = lengthSq > 0
    ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / lengthSq))
    : 0
  const x = a[0] + dx * t
  const z = a[1] + dz * t
  return (px - x) ** 2 + (pz - z) ** 2
}

/** True when a world-space floor point lies on the rendered tape. */
export function isPointOnTrack(trackId, x, z, margin = 0) {
  const track = getLineTrack(trackId)
  const radiusSq = (track.width / 2 + margin) ** 2
  for (let i = 1; i < track.points.length; i++) {
    if (segmentDistanceSq(x, z, track.points[i - 1], track.points[i]) <= radiusSq) return true
  }
  return false
}

/** Backwards-compatible circular tape used by the proving-ground mission. */
export const isPointOnLegacyRing = (x, z) => {
  const radius = Math.hypot(x, z)
  return radius >= 9.2 && radius <= 9.7
}
