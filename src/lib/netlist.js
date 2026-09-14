import { breadboardGroups, breadboardHoles } from './breadboard.js'

const keyOf = (partId, terminal) => JSON.stringify([partId, terminal])

class UnionFind {
  constructor() {
    this.parent = new Map()
    this.rank = new Map()
  }

  add(key) {
    if (!this.parent.has(key)) {
      this.parent.set(key, key)
      this.rank.set(key, 0)
    }
  }

  find(key) {
    if (!this.parent.has(key)) return null
    let root = key
    while (this.parent.get(root) !== root) root = this.parent.get(root)
    let node = key
    while (this.parent.get(node) !== node) {
      const next = this.parent.get(node)
      this.parent.set(node, root)
      node = next
    }
    return root
  }

  union(a, b) {
    this.add(a)
    this.add(b)
    let ra = this.find(a)
    let rb = this.find(b)
    if (ra === rb) return
    const rankA = this.rank.get(ra)
    const rankB = this.rank.get(rb)
    if (rankA < rankB) [ra, rb] = [rb, ra]
    this.parent.set(rb, ra)
    if (rankA === rankB) this.rank.set(ra, rankA + 1)
  }
}

let partsCache = new WeakMap()

const signatureOf = (parts, wires) => JSON.stringify({
  p: Object.values(parts ?? {}).map((part) => [part.id, part.kind, part.breadboardId, part.holes]),
  w: (Array.isArray(wires) ? wires : []).map((wire) => [
    wire?.a?.partId, wire?.a?.terminal, wire?.b?.partId, wire?.b?.terminal,
  ]),
})

/**
 * Collapse wires, breadboard bus strips and inserted component leads into
 * electrical nets. Components themselves are not collapsed: a resistor or
 * diode remains a device between two nets, never a copper short.
 */
export function buildElectricalNets(parts = {}, wires = []) {
  const signature = signatureOf(parts, wires)
  if (parts && typeof parts === 'object' && wires && typeof wires === 'object') {
    const byWires = partsCache.get(parts)
    const hit = byWires?.get(wires)
    if (hit?.signature === signature) return hit.graph
  }

  const uf = new UnionFind()
  const refs = new Map()

  for (const wire of Array.isArray(wires) ? wires : []) {
    const a = wire?.a
    const b = wire?.b
    if (!parts?.[a?.partId] || !parts?.[b?.partId] || !a?.terminal || !b?.terminal) continue
    const ak = keyOf(a.partId, a.terminal)
    const bk = keyOf(b.partId, b.terminal)
    uf.union(ak, bk)
    refs.set(ak, { id: a.terminal, partId: a.partId, partKind: parts[a.partId].kind })
    refs.set(bk, { id: b.terminal, partId: b.partId, partKind: parts[b.partId].kind })
  }

  // Copper clips under a breadboard join five terminal holes, or one half of
  // a power rail. The centre trench and rail breaks never get unioned.
  const bbGroups = breadboardGroups()
  for (const part of Object.values(parts ?? {})) {
    if (part.kind !== 'breadboard') continue
    for (const hole of breadboardHoles()) {
      const key = keyOf(part.id, hole.id)
      uf.add(key)
      refs.set(key, { id: hole.id, partId: part.id, partKind: part.kind })
    }
    for (const holeIds of bbGroups.values()) {
      const first = keyOf(part.id, holeIds[0])
      for (let i = 1; i < holeIds.length; i++) uf.union(first, keyOf(part.id, holeIds[i]))
    }
  }

  // The Uno's three GND header positions are one copper ground plane. Keeping
  // that fact in the net graph lets two breadboard rails share ground through
  // different physical GND pins, just as they do on the real board.
  for (const part of Object.values(parts ?? {})) {
    if (part.kind !== 'board') continue
    const grounds = ['GND1', 'GND2', 'GND3']
    grounds.forEach((id) => {
      const key = keyOf(part.id, id)
      uf.add(key)
      refs.set(key, { id, partId: part.id, partKind: part.kind })
    })
    for (let i = 1; i < grounds.length; i++) uf.union(keyOf(part.id, grounds[0]), keyOf(part.id, grounds[i]))
  }

  // A component inserted into a breadboard occupies one hole per lead. This
  // representation is introduced by save v4; old chassis-mounted parts simply
  // have no footprint and continue to work through ordinary wires.
  for (const part of Object.values(parts ?? {})) {
    if (!part.breadboardId || !part.holes || parts?.[part.breadboardId]?.kind !== 'breadboard') continue
    for (const [terminal, hole] of Object.entries(part.holes)) {
      const terminalKey = keyOf(part.id, terminal)
      const holeKey = keyOf(part.breadboardId, hole)
      uf.union(terminalKey, holeKey)
      refs.set(terminalKey, { id: terminal, partId: part.id, partKind: part.kind })
    }
  }

  const netByKey = new Map()
  const membersByNet = new Map()
  for (const [key, ref] of refs) {
    const net = uf.find(key)
    netByKey.set(key, net)
    if (!membersByNet.has(net)) membersByNet.set(net, [])
    membersByNet.get(net).push(ref)
  }

  const graph = {
    netOf(ref) {
      return ref ? netByKey.get(keyOf(ref.partId, ref.terminal ?? ref.id)) ?? null : null
    },
    peers(ref, { includeSelf = false } = {}) {
      const net = this.netOf(ref)
      if (!net) return []
      const members = membersByNet.get(net) ?? []
      return includeSelf ? members : members.filter((member) =>
        member.partId !== ref.partId || member.id !== (ref.terminal ?? ref.id))
    },
    same(a, b) {
      const an = this.netOf(a)
      return an != null && an === this.netOf(b)
    },
    membersByNet,
  }

  if (parts && typeof parts === 'object' && wires && typeof wires === 'object') {
    let byWires = partsCache.get(parts)
    if (!byWires) {
      byWires = new WeakMap()
      partsCache.set(parts, byWires)
    }
    byWires.set(wires, { signature, graph })
  }
  return graph
}

export const netPeers = (parts, wires, partId, terminal) =>
  buildElectricalNets(parts, wires).peers({ partId, terminal })

export const sameNet = (parts, wires, a, b) => buildElectricalNets(parts, wires).same(a, b)

/** Test helper: cache state is deliberately disposable. */
export function clearNetlistCache() {
  partsCache = new WeakMap()
}
