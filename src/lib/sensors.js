import { DIGITAL_HEADER, POWER_HEADER } from './config.js'
import { componentTerminals } from './electronics.js'
import { netPeers } from './netlist.js'

// Shared by wiring, simulation and teaching UI; no React/store/geometry imports.
export const SENSOR_KINDS = [
  'sensor', 'lineSensor', 'lightSensor', 'temperatureSensor', 'touchSensor', 'tiltSensor', 'encoderSensor',
  'photoTransistor', 'tmp36', 'tiltSwitch', 'potentiometer', 'pushButton',
]
export const SENSOR_MODULE_SIZE = [0.6, 0.12, 0.4]
const moduleTerminals = () => [
  { id: 'VCC', label: 'VCC', type: 'vcc', local: [-0.18, 0.06, -0.15] },
  { id: 'OUT', label: 'OUT', type: 'signal', local: [0, 0.06, -0.15] },
  { id: 'GND', label: 'GND', type: 'gnd', local: [0.18, 0.06, -0.15] },
]

// Literal model/simulation text is localization source material, not UI copy.
// Values are educational engineering units, not raw ADC voltages.
export const SENSOR_SPECS = {
  sensor: {
    model: 'HC-SR04 ultrasonic module', unit: 'cm', range: [2, 400], defaultPin: 7,
    supply: ['5V'], output: 'ECHO', signals: ['TRIG', 'ECHO'],
    simulation: 'Single physics ray along the transducers; no echo is 400 cm. Acoustic beam spread and material response are not modelled.',
    origin: [0, 0.2, 0.26], direction: [0, 0, 1],
    terminals: [
      { id: 'VCC', label: 'VCC', type: 'vcc', local: [-0.24, -0.12, 0] },
      { id: 'TRIG', label: 'TRIG', type: 'signal', local: [-0.08, -0.12, 0] },
      { id: 'ECHO', label: 'ECHO', type: 'signal', local: [0.08, -0.12, 0] },
      { id: 'GND', label: 'GND', type: 'gnd', local: [0.24, -0.12, 0] },
    ],
  },
  lineSensor: {
    model: 'Reflective IR line module', unit: '%', range: [0, 100], defaultPin: 14,
    supply: ['5V', '3V3'], output: 'OUT', signals: ['OUT'], terminals: moduleTerminals(),
    origin: [0, -0.06, 0.12], direction: [0, -1, 0],
    simulation: 'Downward physics probe, maximum 6 cm. Darkness is 100 on the painted 9.2–9.7 unit floor ring and 0 elsewhere. Raised obstacles occlude the floor.',
  },
  lightSensor: {
    model: 'Photoresistor light module', unit: '%', range: [0, 100], defaultPin: 15,
    supply: ['5V', '3V3'], output: 'OUT', signals: ['OUT'], terminals: moduleTerminals(),
    origin: [0, 0.06, 0], direction: [0, 1, 0],
    simulation: 'Controlled simulated ambient light from the experiment slider; not measured from rendered pixels or shadows.',
  },
  temperatureSensor: {
    model: 'Analogue temperature module', unit: '°C', range: [-40, 125], defaultPin: 16,
    supply: ['5V', '3V3'], output: 'OUT', signals: ['OUT'], terminals: moduleTerminals(),
    origin: [0, 0.06, 0], direction: [0, 1, 0],
    simulation: 'Controlled simulated ambient temperature from the experiment slider; no heat transfer or motor heating is modelled.',
  },
  touchSensor: {
    model: 'Lever microswitch module', unit: '0/1', range: [0, 1], defaultPin: 2,
    supply: ['5V', '3V3'], output: 'OUT', signals: ['OUT'], terminals: moduleTerminals(),
    origin: [0, 0, 0.2], direction: [0, 0, 1],
    simulation: 'Contact-probe approximation: a front-facing physics ray detects obstacles within 0.15 cm of the lever. It is not a force or pressure sensor.',
  },
  tiltSensor: {
    model: 'Gravity tilt module', unit: '°', range: [0, 180], defaultPin: 3,
    supply: ['5V', '3V3'], output: 'OUT', signals: ['OUT'], terminals: moduleTerminals(),
    origin: [0, 0, 0], direction: [0, 1, 0],
    simulation: 'Module normal versus opposite gravity: level 0°, side 90°, upside down 180°. Includes mounting orientation and live rigid-body tilt.',
  },
  encoderSensor: {
    model: 'Optical wheel encoder module', unit: '°', range: [-36000, 36000], defaultPin: 4,
    supply: ['5V', '3V3'], output: 'OUT', signals: ['OUT'], terminals: moduleTerminals(),
    origin: [0, 0, 0], direction: [0, 0, 1],
    simulation: 'Signed cumulative wheel degrees since connection/Run, using the nearest wheel on the same rigid assembly or explicit wheelId. Rotation comes from contact-point travel, matching the simulated wheels; independent shaft slip is not modelled. Range is a display scale, not a clamp.',
  },
  photoTransistor: {
    model: 'Starter Kit phototransistor', unit: '%', range: [0, 100], defaultPin: 15,
    supply: ['5V', '3V3'], output: 'OUT', signals: ['OUT'], terminals: componentTerminals('photoTransistor'),
    origin: [0, 0.15, 0], direction: [0, 1, 0],
    simulation: 'The exposed phototransistor follows the controlled ambient-light level in the experiment panel.',
  },
  tmp36: {
    model: 'TMP36 analogue temperature sensor', unit: '°C', range: [-40, 125], defaultPin: 16,
    supply: ['5V', '3V3'], output: 'OUT', signals: ['OUT'], terminals: componentTerminals('tmp36'),
    origin: [0, 0.12, 0], direction: [0, 1, 0],
    simulation: 'TMP36 output follows the controlled ambient temperature and is reported in degrees Celsius.',
  },
  tiltSwitch: {
    model: 'Starter Kit ball tilt switch', unit: '0/1', range: [0, 1], defaultPin: 3,
    supply: ['5V', '3V3'], output: 'OUT', signals: ['OUT'], terminals: componentTerminals('tiltSwitch'),
    origin: [0, 0.12, 0], direction: [0, 1, 0],
    simulation: 'The internal ball closes the switch once the holder tilts beyond 45 degrees.',
  },
  potentiometer: {
    model: '10 kΩ rotary potentiometer', unit: '%', range: [0, 100], defaultPin: 17,
    supply: ['5V', '3V3'], output: 'OUT', signals: ['OUT'], terminals: componentTerminals('potentiometer'),
    origin: [0, 0.12, 0], direction: [0, 1, 0],
    simulation: 'The experiment control turns the shaft from 0 to 100 percent.',
  },
  pushButton: {
    model: 'Starter Kit tactile pushbutton', unit: '0/1', range: [0, 1], defaultPin: 2,
    supply: [], ground: 'COM', output: 'NO', signals: ['NO'], terminals: componentTerminals('pushButton'),
    origin: [0, 0.12, 0], direction: [0, 1, 0],
    simulation: 'The experiment button closes NO to ground while it is pressed.',
  },
}

export const isSensor = (kind) => SENSOR_KINDS.includes(kind)
const boardPins = [...DIGITAL_HEADER, ...POWER_HEADER]
const pinAt = (terminal) => boardPins.find((p) => p.id === terminal)?.pin ?? null
const groundAt = (terminal) => boardPins.some((p) => p.id === terminal && p.rail === 'gnd')

/**
 * Electrical readiness, separate from pinMap's legacy TRIG/ECHO claims.
 * Direct leads to one Uno are required. A0–A5 are valid digital aliases.
 * Missing: terminal IDs, SIGNAL_CONFLICT, BOARD_MISMATCH, WHEEL, SENSOR.
 * The measurement layer additionally reports PHYSICS or ENVIRONMENT.
 */
export function sensorConnection(part, parts = {}, wires = []) {
  const spec = SENSOR_SPECS[part?.kind]
  if (!spec) return { ready: false, pin: null, missing: ['SENSOR'] }
  const leads = Array.isArray(wires) ? wires : []
  const peers = (terminal) => netPeers(parts, wires, part.id, terminal)
    .map((peer) => ({ partId: peer.partId, terminal: peer.id }))
  const missing = []
  const boardIds = new Set()
  const validPeer = (terminal, valid) => {
    const directCount = leads.filter((wire) =>
      (wire?.a?.partId === part.id && wire.a.terminal === terminal) ||
      (wire?.b?.partId === part.id && wire.b.terminal === terminal)).length
    const ends = [...new Map(peers(terminal)
      .filter((peer) => parts[peer?.partId]?.kind === 'board' && valid(peer.terminal))
      .map((peer) => [`${peer.partId}:${pinAt(peer.terminal) ?? (groundAt(peer.terminal) ? 'gnd' : peer.terminal)}`, peer])).values()]
    const peer = ends[0]
    if (ends.length !== 1 || directCount > 1) {
      missing.push(terminal)
      return null
    }
    boardIds.add(peer.partId)
    return peer
  }
  if (spec.supply.length) validPeer('VCC', (id) => spec.supply.includes(id))
  validPeer(spec.ground ?? 'GND', groundAt)
  const signals = spec.signals.map((id) => ({ id, peer: validPeer(id, (term) => pinAt(term) !== null) }))
  const output = signals.find((s) => s.id === spec.output)?.peer
  const pin = output ? pinAt(output.terminal) : null
  if (boardIds.size > 1) missing.push('BOARD_MISMATCH')

  // Claims include unpowered devices; detect both sides of each conflict.
  // Runtime indexes by pin, so duplicate numbers on different Unos conflict too.
  for (const signal of signals) {
    if (!signal.peer) continue
    const signalPin = pinAt(signal.peer.terminal)
    const owners = new Set()
    for (const board of Object.values(parts).filter((candidate) => candidate.kind === 'board')) {
      for (const boardPin of boardPins.filter((candidate) => candidate.pin === signalPin)) {
        for (const peer of netPeers(parts, wires, board.id, boardPin.id)) {
          if (!parts[peer.partId] || ['board', 'breadboard'].includes(parts[peer.partId].kind)) continue
          owners.add(peer.partId + ':' + peer.id)
        }
      }
    }
    if (owners.size > 1) missing.push('SIGNAL_CONFLICT')
  }
  if (part.kind === 'encoderSensor') {
    const wheel = part.wheelId ? parts[part.wheelId] : Object.values(parts).find((p) => p.kind === 'wheel')
    if (wheel?.kind !== 'wheel') missing.push('WHEEL')
  }
  const unique = [...new Set(missing)]
  return { ready: unique.length === 0, pin, missing: unique }
}

export const CM_PER_UNIT = 2.54
export const LINE_RING = { inner: 9.2, outer: 9.7 }
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const round = (value) => Math.round(value * 10) / 10

/**
 * Measurement model with an injected real physics cast. Rays must be normalized
 * and WORLD-filtered, transformed through both mount and rigid-body orientation.
 * Tests can therefore use the exact model with real Rapier worlds without React.
 */
export function sampleSensor(kind, { cast, origin, up, gravity = { x: 0, y: -9.81, z: 0 }, environment, wheelRadians, lineTest } = {}) {
  const spec = SENSOR_SPECS[kind]
  if (!spec) return { value: null, missing: ['SENSOR'] }
  if (['lightSensor', 'photoTransistor', 'temperatureSensor', 'tmp36', 'potentiometer', 'pushButton'].includes(kind)) {
    const key = kind === 'lightSensor' || kind === 'photoTransistor' ? 'light'
      : kind === 'temperatureSensor' || kind === 'tmp36' ? 'temperature'
        : kind === 'potentiometer' ? 'potentiometer' : 'button'
    const value = environment?.[key]
    return Number.isFinite(value)
      ? { value: round(clamp(value, ...spec.range)), missing: [] }
      : { value: null, missing: ['ENVIRONMENT'] }
  }
  if (kind === 'encoderSensor') return Number.isFinite(wheelRadians)
    ? { value: round(wheelRadians * 180 / Math.PI), missing: [] }
    : { value: null, missing: ['WHEEL'] }
  if (kind === 'tiltSensor' || kind === 'tiltSwitch') {
    const length = Math.hypot(gravity.x, gravity.y, gravity.z) * Math.hypot(up?.x ?? 0, up?.y ?? 0, up?.z ?? 0)
    if (!length) return { value: null, missing: ['PHYSICS'] }
    const degrees = round(Math.acos(clamp(-(up.x * gravity.x + up.y * gravity.y + up.z * gravity.z) / length, -1, 1)) * 180 / Math.PI)
    return { value: kind === 'tiltSwitch' ? (degrees >= 45 ? 1 : 0) : degrees, missing: [] }
  }
  if (!cast) return { value: null, missing: ['PHYSICS'] }
  const maxCm = kind === 'sensor' ? spec.range[1] : kind === 'lineSensor' ? 6 : 0.15
  const hit = cast(maxCm / CM_PER_UNIT)
  const toi = hit?.timeOfImpact
  if (hit && (!Number.isFinite(toi) || toi < 0)) return { value: null, missing: ['PHYSICS'] }
  if (kind === 'sensor') return { value: round(hit ? clamp(toi * CM_PER_UNIT, ...spec.range) : spec.range[1]), missing: [], hit }
  if (kind === 'touchSensor') return { value: hit ? 1 : 0, missing: [], hit }
  // Only a floor hit carries tape. Crates at the same radius must occlude it.
  const point = hit?.point
  const radius = point ? Math.hypot(point.x, point.z) : -1
  const defaultLineTest = (p) => {
    const r = Math.hypot(p.x, p.z)
    return r >= LINE_RING.inner && r <= LINE_RING.outer
  }
  const onTape = point && origin?.y > 0 && Math.abs(point.y) < 0.08 &&
    (lineTest ?? defaultLineTest)(point)
  return { value: onTape ? 100 : 0, missing: [], hit }
}
