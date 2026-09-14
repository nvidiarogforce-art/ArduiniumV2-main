import { buildElectricalNets } from './netlist.js'
import { terminalOf } from './terminals.js'
import { isLed } from './electronics.js'
import { ledConnection } from './circuits.js'

const EPSILON_V = 0.08

const ref = (partId, terminal) => ({ partId, terminal })

/**
 * Deterministic mixed-signal circuit analysis for the teaching sandbox.
 *
 * This is deliberately device-aware rather than pretending to be arbitrary
 * SPICE: it solves ideal supply constraints and GPIO levels on the net graph,
 * then applies the catalogue's component rules. The result is stable enough
 * for live diagnostics and explicit about every unsupported/floating state.
 */
export function solveCircuit(parts = {}, wires = [], { pinLevels = {} } = {}) {
  const graph = buildElectricalNets(parts, wires)
  const sources = new Map()
  const potentials = new Map()
  const issues = []

  const addIssue = (code, severity, data = {}) => {
    const key = JSON.stringify([code, severity, data.partId, data.net, data.terminals])
    if (!issues.some((issue) => issue.key === key)) issues.push({ key, code, severity, ...data })
  }

  const source = (net, voltage, label, partId) => {
    if (!net || !Number.isFinite(voltage)) return
    if (!sources.has(net)) sources.set(net, [])
    sources.get(net).push({ voltage, label, partId })
  }

  for (const part of Object.values(parts)) {
    if (part.kind !== 'board') continue
    for (const [id, voltage] of [['5V', 5], ['3V3', 3.3], ['GND1', 0], ['GND2', 0], ['GND3', 0]]) {
      source(graph.netOf(ref(part.id, id)), voltage, id, part.id)
    }
    for (const [pinText, level] of Object.entries(pinLevels ?? {})) {
      const pin = Number(pinText)
      if (!Number.isInteger(pin) || level == null) continue
      for (const terminal of ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5']) {
        const t = terminalOf(part, terminal)
        if (t?.pin === pin) source(graph.netOf(ref(part.id, terminal)), Number(level) > 0 ? 5 : 0, terminal, part.id)
      }
    }
  }

  for (const [net, entries] of sources) {
    const min = Math.min(...entries.map((entry) => entry.voltage))
    const max = Math.max(...entries.map((entry) => entry.voltage))
    if (max - min > EPSILON_V) {
      addIssue('POWER_SHORT', 'danger', { net, sources: entries })
    } else {
      potentials.set(net, entries.reduce((sum, entry) => sum + entry.voltage, 0) / entries.length)
    }
  }

  // Ideal 9 V batteries are voltage constraints. They become absolute when
  // either side is tied to a known rail, and conflict if both sides disagree.
  const constraints = []
  for (const part of Object.values(parts)) {
    if (part.kind !== 'battery9v') continue
    const minus = graph.netOf(ref(part.id, '-'))
    const plus = graph.netOf(ref(part.id, '+'))
    if (!minus || !plus) continue
    if (minus === plus) {
      addIssue('BATTERY_SHORT', 'danger', { partId: part.id, net: minus })
      continue
    }
    constraints.push({ low: minus, high: plus, delta: 9, partId: part.id })
  }

  for (let pass = 0; pass < constraints.length + 2; pass++) {
    let changed = false
    for (const c of constraints) {
      const low = potentials.get(c.low)
      const high = potentials.get(c.high)
      if (low != null && high == null) {
        potentials.set(c.high, low + c.delta)
        changed = true
      } else if (high != null && low == null) {
        potentials.set(c.low, high - c.delta)
        changed = true
      } else if (low != null && high != null && Math.abs((high - low) - c.delta) > EPSILON_V) {
        addIssue('SOURCE_CONFLICT', 'danger', { partId: c.partId, terminals: ['+', '-'] })
      }
    }
    if (!changed) break
  }

  const voltageAt = (partId, terminal) => potentials.get(graph.netOf(ref(partId, terminal))) ?? null
  const same = (partId, a, b) => {
    const an = graph.netOf(ref(partId, a))
    return an != null && an === graph.netOf(ref(partId, b))
  }

  for (const part of Object.values(parts)) {
    if (part.kind === 'resistor' && same(part.id, '1', '2')) {
      addIssue('COMPONENT_BYPASSED', 'warning', { partId: part.id, terminals: ['1', '2'] })
    }
    if (part.kind === 'diode' && same(part.id, 'A', 'K')) {
      addIssue('COMPONENT_BYPASSED', 'warning', { partId: part.id, terminals: ['A', 'K'] })
    }
    if (isLed(part.kind)) {
      const channelIds = part.kind === 'rgbLed' ? ['R', 'G', 'B'] : ['A']
      for (const channel of channelIds) {
        if (same(part.id, channel, 'K')) addIssue('LED_BYPASSED', 'warning', { partId: part.id, terminals: [channel, 'K'] })
        const anode = voltageAt(part.id, channel)
        const cathode = voltageAt(part.id, 'K')
        if (anode != null && cathode != null && anode < cathode - EPSILON_V) {
          addIssue('LED_REVERSED', 'warning', { partId: part.id, terminals: [channel, 'K'] })
        }
      }
      const connection = ledConnection(part, parts, wires)
      const anodeNet = graph.netOf(ref(part.id, channelIds[0]))
      const directSignal = (graph.membersByNet.get(anodeNet) ?? []).some((member) => {
        const sourcePart = parts[member.partId]
        const terminal = sourcePart?.kind === 'board' ? terminalOf(sourcePart, member.id) : null
        return terminal?.type === 'signal' && terminal.pin != null
      })
      if (!connection.ready && directSignal) addIssue('LED_NEEDS_RESISTOR', 'danger', { partId: part.id })
    }
    if (part.kind === 'capacitor') {
      const plus = voltageAt(part.id, '+')
      const minus = voltageAt(part.id, '-')
      if (plus != null && minus != null && plus < minus - EPSILON_V) {
        addIssue('POLARITY_REVERSED', 'danger', { partId: part.id, terminals: ['+', '-'] })
      }
    }
  }

  const severity = issues.some((issue) => issue.severity === 'danger') ? 'danger'
    : issues.some((issue) => issue.severity === 'warning') ? 'warning'
      : wires.length > 0 ? 'ok' : 'idle'

  return {
    severity,
    issues: issues.map(({ key, ...issue }) => issue),
    potentials,
    graph,
    stats: {
      contacts: [...graph.membersByNet.values()].reduce((sum, members) => sum + members.length, 0),
      nets: graph.membersByNet.size,
      poweredNets: potentials.size,
    },
    voltageAt,
  }
}

/** True when adding one wire would create a hard source conflict. */
export function wireCreatesShort(parts, wires, wire) {
  return solveCircuit(parts, [...wires, wire]).issues.some((issue) =>
    ['POWER_SHORT', 'BATTERY_SHORT', 'SOURCE_CONFLICT'].includes(issue.code))
}

