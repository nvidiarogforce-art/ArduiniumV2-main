import { boltEndpoints, isElectronic, isFlat } from './geometry.js'

/**
 * Turning a bolted build into something a physics engine can actually solve.
 *
 * The naive approach — one joint per bolt — looks right and behaves terribly.
 * Bolt a board to two rails that are already bolted to each other and you have
 * a closed loop of rigid constraints. Solvers hate closed rigid loops: the
 * constraints fight, the residual error feeds back as energy, and the robot
 * launches itself into the sky. (It did exactly that here before this file
 * existed.)
 *
 * So instead we use the rule the app already teaches:
 *
 *     one bolt  = a hinge
 *     two bolts = rigid
 *
 * Anything rigidly attached is welded into a single compound rigid body, and
 * only genuine hinges become joints. A part with exactly one bolt is a leaf,
 * so the joint graph is always a forest — no loops, nothing to fight, and the
 * physical behaviour matches what the student was told.
 */

/** Number of bolts touching a part, whoever they connect to. */
function boltCounts(bolts) {
  const counts = {}
  for (const b of bolts) {
    counts[b.aId] = (counts[b.aId] ?? 0) + 1
    counts[b.bId] = (counts[b.bId] ?? 0) + 1
  }
  return counts
}

function makeUnionFind(ids) {
  const parent = new Map(ids.map((id) => [id, id]))
  const find = (x) => {
    if (!parent.has(x)) return null
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)))
      x = parent.get(x)
    }
    return x
  }
  const union = (a, b) => {
    const ra = find(a)
    const rb = find(b)
    if (ra != null && rb != null && ra !== rb) {
      parent.set(ra, rb)
      return true
    }
    return false
  }
  return { find, union }
}

/**
 * @returns {{
 *   groups: Array<{ id: string, members: object[] }>,
 *   hinges: Array<{ id, partId, groupId, anchorPart, anchorGroup }>,
 *   groupOf: (partId: string) => string
 * }}
 */
export function planAssembly(parts, bolts) {
  // Only the flat, boltable slabs take part in the welding pass. Electronics
  // ride on the board, and every mounted fitting — bracket, motor, wheel,
  // caster — is carried by whichever welded group its chain is rooted in, so
  // none of them needs a body of its own.
  const structural = Object.values(parts).filter((p) => isFlat(p.kind) && !isElectronic(p.kind))
  const ids = structural.map((p) => p.id)
  // Keep physical endpoints for pivots; collapse only body ownership to roots.
  const valid = []
  const used = new Set()
  for (const bolt of Array.isArray(bolts) ? bolts : []) {
    const ends = boltEndpoints(parts, bolt)
    if (!ends) continue
    const key = JSON.stringify([[bolt.aId, bolt.aHole], [bolt.bId, bolt.bHole]].sort())
    if (used.has(key)) continue
    used.add(key)
    const servoFor = (partId) => {
      const endpoint = parts[partId]
      if (endpoint?.kind === 'servo') return endpoint.id
      if (endpoint?.kind === 'servoHorn' && parts[endpoint.hostId]?.kind === 'servo') return endpoint.hostId
      return null
    }
    // A bolt through a servo horn carries the identity of the motor on the
    // other side of the spline. This makes actuation structural data, not a
    // nearest-neighbour guess made later by the renderer.
    const actuatorId = servoFor(bolt.aId) ?? servoFor(bolt.bId)
    valid.push({ ...bolt, aId: ends.a.rootId, bId: ends.b.rootId, ends, actuatorId })
  }
  const counts = boltCounts(valid)
  const { find, union } = makeUnionFind(ids)

  // Bolts grouped by the unordered pair they join.
  const pairs = new Map()
  for (const b of valid) {
    if (!parts[b.aId] || !parts[b.bId]) continue
    const key = [b.aId, b.bId].sort().join('~')
    if (!pairs.has(key)) pairs.set(key, [])
    pairs.get(key).push(b)
  }

  /*
   * Weld rigid connections to a fixed point.
   *
   * Two bolts directly between the same bodies are rigid. After those unions,
   * two different one-bolt links may also connect the same two *groups* (for
   * example a cross-member bolted once to each of two rails that are already
   * one chassis). Collapse those too, then repeat because that new weld can
   * make another pair rigid.
   *
   * The old `degree >= 2 on both ends` shortcut mistook a serial robot arm for
   * a welded frame: its middle boom has a shoulder bolt and an elbow bolt, but
   * they are different joints and it must still move. Group-pair counting is
   * the actual mechanical rule and handles both cases without that ambiguity.
   */
  let changed = true
  while (changed) {
    changed = false
    const between = new Map()
    for (const bolt of valid) {
      const a = find(bolt.aId)
      const b = find(bolt.bId)
      if (a == null || b == null || a === b) continue
      const key = [a, b].sort().join('~')
      if (!between.has(key)) between.set(key, { a, b, bolts: [] })
      between.get(key).bolts.push(bolt)
    }
    for (const edge of between.values()) {
      if (edge.bolts.length < 2) continue
      changed = union(edge.a, edge.b) || changed
    }
    if (changed) continue

    // A closed contour of one-bolt joints is the workshop's braced frame
    // rule (the rover's two rails plus two cross-members are the canonical
    // example). Collapse every non-bridge edge in that contour, but leave an
    // open shoulder → elbow → wrist chain articulated.
    const single = [...between.entries()].filter(([, edge]) => edge.bolts.length === 1)
    const connectedWithout = (start, goal, omitted) => {
      const adjacency = new Map()
      for (const [key, edge] of single) {
        if (key === omitted) continue
        if (!adjacency.has(edge.a)) adjacency.set(edge.a, [])
        if (!adjacency.has(edge.b)) adjacency.set(edge.b, [])
        adjacency.get(edge.a).push(edge.b)
        adjacency.get(edge.b).push(edge.a)
      }
      const queue = [start]
      const seen = new Set(queue)
      while (queue.length) {
        const node = queue.shift()
        if (node === goal) return true
        for (const next of adjacency.get(node) ?? []) {
          if (seen.has(next)) continue
          seen.add(next)
          queue.push(next)
        }
      }
      return false
    }
    for (const [key, edge] of single) {
      if (connectedWithout(edge.a, edge.b, key)) changed = union(edge.a, edge.b) || changed
    }
  }

  const grouped = new Map()
  for (const part of structural) {
    const root = find(part.id)
    if (!grouped.has(root)) grouped.set(root, [])
    grouped.get(root).push(part)
  }
  const groups = [...grouped.entries()].map(([id, members]) => ({ id: `grp-${id}`, members }))

  // Whatever is left un-welded is a real hinge.
  const hinges = []
  for (const [, list] of pairs) {
    const bolt = list[0]
    const a = parts[bolt.aId]
    const b = parts[bolt.bId]
    if (find(a.id) === find(b.id)) continue // already welded together

    // The single-bolt side is always the leaf that swings.
    const leaf = (counts[a.id] ?? 0) <= (counts[b.id] ?? 0) ? a : b
    const anchorPartOnA = leaf.id === a.id
    const other = anchorPartOnA ? b : a
    const self = anchorPartOnA ? bolt.ends.a : bolt.ends.b
    const contact = anchorPartOnA ? bolt.ends.b : bolt.ends.a
    const n = contact.axis
    const side = self.pos.reduce((sum, v, i) => sum + (v - contact.pos[i]) * n[i], 0) < 0 ? -1 : 1
    // Both compound bodies use build-space local frames. Offset the full
    // contact position along the actual bolt normal, including sideways holes.
    const pivot = Object.fromEntries(['x', 'y', 'z'].map((key, i) =>
      [key, contact.pos[i] + n[i] * contact.thickness * side]))

    hinges.push({
      id: bolt.id,
      actuatorId: bolt.actuatorId,
      partId: leaf.id,
      groupId: `grp-${find(other.id)}`,
      anchorPart: pivot,
      anchorGroup: pivot,
      axis: { x: n[0], y: n[1], z: n[2] },
    })
  }

  return {
    groups,
    hinges,
    groupOf: (partId) => `grp-${find(partId)}`,
  }
}
