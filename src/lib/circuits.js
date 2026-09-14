import { terminalOf } from './terminals.js'
import { isLed } from './electronics.js'
import { netPeers } from './netlist.js'

const endsFor = (wires, parts, partId, terminal) =>
  netPeers(parts, wires, partId, terminal).map((peer) => ({ partId: peer.partId, terminal: peer.id }))

const boardTerminal = (ref, parts) => {
  const part = parts?.[ref?.partId]
  if (part?.kind !== 'board') return null
  const terminal = terminalOf(part, ref.terminal)
  return terminal ? { ...terminal, partId: part.id } : null
}

const oneBoard = (wires, parts, partId, terminal, predicate) => {
  const matches = endsFor(wires, parts, partId, terminal).map((ref) => boardTerminal(ref, parts)).filter((t) => t && predicate(t))
  const unique = [...new Map(matches.map((match) => [
    `${match.partId}:${match.pin ?? match.type}`,
    match,
  ])).values()]
  return unique.length === 1 ? unique[0] : null
}

const isGround = (terminal) => terminal?.type === 'gnd'
const isFiveVolt = (terminal) => terminal?.id === '5V'
const isSignal = (terminal) => terminal?.type === 'signal' && terminal.pin != null

/** A board signal reached through exactly one series resistor. */
function pinThroughResistor(partId, terminal, parts, wires) {
  const first = endsFor(wires, parts, partId, terminal).filter((ref) => parts?.[ref.partId]?.kind === 'resistor')
  if (first.length !== 1) return null
  const resistor = parts[first[0].partId]
  const near = first[0].terminal
  if (!['1', '2'].includes(near)) return null
  const far = near === '1' ? '2' : '1'
  const board = endsFor(wires, parts, resistor.id, far).map((ref) => boardTerminal(ref, parts)).filter(isSignal)
  return board.length === 1 ? board[0].pin : null
}

/**
 * A real LED circuit: cathode to ground and every illuminated channel through
 * its own current-limiting resistor.  Direct Uno→LED wiring deliberately does
 * not count as ready.
 */
export function ledConnection(part, parts = {}, wires = []) {
  if (!isLed(part?.kind)) return { ready: false, pins: {}, missing: ['LED'] }
  const ground = oneBoard(wires, parts, part.id, 'K', isGround)
  const ids = part.kind === 'rgbLed' ? ['R', 'G', 'B'] : ['A']
  const pins = Object.fromEntries(ids.map((id) => [id, pinThroughResistor(part.id, id, parts, wires)]))
  const missing = []
  if (!ground) missing.push('K→GND')
  for (const id of ids) if (pins[id] == null) missing.push(`${id}→RESISTOR→PIN`)
  return { ready: missing.length === 0, pins, boardId: ground?.partId ?? null, missing }
}

const boardPeer = (wires, parts, partId, terminal, predicate) =>
  oneBoard(wires, parts, partId, terminal, predicate)

const driverPowered = (driver, channel, parts, wires) => {
  const logic = boardPeer(wires, parts, driver.id, 'VCC', isFiveVolt)
  const enable = boardPeer(wires, parts, driver.id, channel.enable, isFiveVolt)
  const grounds = channel.grounds.map((id) => boardPeer(wires, parts, driver.id, id, isGround))
  const motorSupply = endsFor(wires, parts, driver.id, 'VMOT')
    .filter((ref) => parts?.[ref.partId]?.kind === 'battery9v' && ref.terminal === '+')
  const batteryRef = motorSupply.length === 1 ? motorSupply[0] : null
  const battery = parts?.[batteryRef?.partId]
  const batteryPlus = battery?.kind === 'battery9v' && batteryRef.terminal === '+'
  const batteryGround = batteryPlus ? boardPeer(wires, parts, battery.id, '-', isGround) : null
  const boardId = logic?.partId
  return !!(logic && enable && grounds.every(Boolean) && batteryGround &&
    [enable, ...grounds, batteryGround].every((terminal) => terminal.partId === boardId))
}

const CHANNELS = [
  { outputs: ['OUT1', 'OUT2'], inputs: ['IN1', 'IN2'], enable: 'EN12', grounds: ['GND4', 'GND5'] },
  { outputs: ['OUT3', 'OUT4'], inputs: ['IN3', 'IN4'], enable: 'EN34', grounds: ['GND12', 'GND13'] },
]

/**
 * Resolve a motor only through a complete L293D channel. Both motor leads,
 * both direction inputs, enable, logic supply, motor battery and the channel's
 * two ground pins must be present on one common Uno ground.
 */
export function motorConnection(motor, parts = {}, wires = []) {
  if (motor?.kind !== 'motor') return { ready: false, pin: null, reversePin: null, missing: ['MOTOR'] }
  const mPlus = endsFor(wires, parts, motor.id, 'M+')
    .filter((ref) => parts?.[ref.partId]?.kind === 'motorDriver')
  const mMinus = endsFor(wires, parts, motor.id, 'M-')
    .filter((ref) => parts?.[ref.partId]?.kind === 'motorDriver')
  if (mPlus.length !== 1 || mMinus.length !== 1) return { ready: false, pin: null, reversePin: null, missing: ['M+', 'M-'] }
  if (mPlus[0].partId !== mMinus[0].partId) return { ready: false, pin: null, reversePin: null, missing: ['ONE_DRIVER'] }
  const driver = parts?.[mPlus[0].partId]
  if (driver?.kind !== 'motorDriver') return { ready: false, pin: null, reversePin: null, missing: ['L293D'] }

  for (const channel of CHANNELS) {
    const forward = mPlus[0].terminal === channel.outputs[0] && mMinus[0].terminal === channel.outputs[1]
    const reverse = mPlus[0].terminal === channel.outputs[1] && mMinus[0].terminal === channel.outputs[0]
    if (!forward && !reverse) continue
    const inputs = channel.inputs.map((id) => boardPeer(wires, parts, driver.id, id, isSignal))
    const powered = driverPowered(driver, channel, parts, wires)
    const missing = []
    if (!powered) missing.push('POWER')
    if (!inputs[0]) missing.push(channel.inputs[0])
    if (!inputs[1]) missing.push(channel.inputs[1])
    return {
      ready: missing.length === 0,
      pin: inputs[forward ? 0 : 1]?.pin ?? null,
      reversePin: inputs[forward ? 1 : 0]?.pin ?? null,
      driverId: driver.id,
      missing,
    }
  }
  return { ready: false, pin: null, reversePin: null, missing: ['OUTPUT_PAIR'] }
}

/** Directly wired three-pin output such as a servo. */
export function outputConnection(part, parts = {}, wires = []) {
  if (!part) return { ready: false, pin: null, missing: ['DEVICE'] }
  const layout = part.kind === 'servo' ? { signal: 'SIG', vcc: 'VCC', gnd: 'GND' }
    : part.kind === 'piezo' ? { signal: '+', gnd: '-' }
      : null
  if (!layout) return { ready: false, pin: null, missing: ['DEVICE'] }
  const signal = boardPeer(wires, parts, part.id, layout.signal, isSignal)
  const power = layout.vcc ? boardPeer(wires, parts, part.id, layout.vcc, isFiveVolt) : true
  const ground = boardPeer(wires, parts, part.id, layout.gnd, isGround)
  const missing = []
  if (!signal) missing.push(layout.signal)
  if (!power) missing.push(layout.vcc)
  if (!ground) missing.push(layout.gnd)
  return { ready: missing.length === 0, pin: signal?.pin ?? null, missing }
}

/**
 * HD44780 in the familiar four-bit mode used by the Arduino LiquidCrystal
 * examples.  The display is considered live only when power, common ground,
 * RS, enable and all four data lines reach one Uno.
 */
export function lcdConnection(part, parts = {}, wires = []) {
  if (part?.kind !== 'lcd') return { ready: false, pins: {}, missing: ['LCD'] }
  const power = boardPeer(wires, parts, part.id, 'VCC', isFiveVolt)
  const ground = boardPeer(wires, parts, part.id, 'GND', isGround)
  const ids = ['RS', 'EN', 'D4', 'D5', 'D6', 'D7']
  const terminals = Object.fromEntries(ids.map((id) => [id, boardPeer(wires, parts, part.id, id, isSignal)]))
  const boardId = power?.partId ?? ground?.partId
  const missing = []
  if (!power) missing.push('VCC')
  if (!ground) missing.push('GND')
  for (const id of ids) if (!terminals[id]) missing.push(id)
  const all = [power, ground, ...Object.values(terminals)].filter(Boolean)
  if (boardId && all.some((terminal) => terminal.partId !== boardId)) missing.push('BOARD_MISMATCH')
  return {
    ready: missing.length === 0,
    pins: Object.fromEntries(ids.map((id) => [id, terminals[id]?.pin ?? null])),
    missing: [...new Set(missing)],
  }
}

export function devicePinClaims(parts = {}, wires = []) {
  const claims = {}
  for (const part of Object.values(parts)) {
    if (isLed(part.kind)) {
      const connection = ledConnection(part, parts, wires)
      for (const pin of Object.values(connection.pins)) if (pin != null) claims[pin] = { id: part.id, kind: part.kind }
    } else if (part.kind === 'motor') {
      const connection = motorConnection(part, parts, wires)
      if (connection.ready) {
        claims[connection.pin] = { id: part.id, kind: part.kind }
        claims[connection.reversePin] = { id: part.id, kind: part.kind }
      }
    } else if (part.kind === 'servo' || part.kind === 'piezo') {
      const connection = outputConnection(part, parts, wires)
      if (connection.ready) claims[connection.pin] = { id: part.id, kind: part.kind }
    } else if (part.kind === 'lcd') {
      const connection = lcdConnection(part, parts, wires)
      if (connection.ready) for (const pin of Object.values(connection.pins)) claims[pin] = { id: part.id, kind: part.kind }
    }
  }
  return claims
}
