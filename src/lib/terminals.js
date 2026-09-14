import {
  DIGITAL_HEADER,
  HEADER_TOP,
  HEADER_Z,
  MOUNT,
  POWER_HEADER,
  POWER_Z,
  WIRE_COLOUR,
} from './config.js'
import { SENSOR_SPECS } from './sensors.js'
import { componentTerminals, isKitComponent, isLed } from './electronics.js'
import { partTransform } from './geometry.js'
import { ID, apply as applyOrient } from './orient.js'
import { breadboardHole, breadboardHoles } from './breadboard.js'

/**
 * ELECTRICAL TERMINALS.
 *
 * Structure in this project connects through the snap matrix in parts.js;
 * electricity connects here. The two are deliberately separate — a sensor
 * bolts to the chassis for mechanical reasons and reaches the Arduino for
 * electrical ones, and those are different questions with different answers.
 *
 * A terminal is addressed as { partId, terminal }, where `terminal` is a
 * stable string. Positions are declared in the part's own local frame and
 * resolved to build space through the same partTransform every mesh uses, so a
 * terminal is wherever its part currently is — no second copy to keep in sync.
 *
 * Types drive both colour and what may legally join to what:
 *
 *   vcc     supply       red
 *   gnd     ground       black
 *   signal  data / PWM   yellow on the board, orange on a motor
 */

export const TERMINAL_TYPE = {
  VCC: 'vcc', GND: 'gnd', SIGNAL: 'signal', PASSIVE: 'passive',
  INPUT: 'input', OUTPUT: 'output', MOTOR: 'motor', POWER_IN: 'powerIn',
}

/** Colour a lead takes, decided by the pair it joins. */
export function wireColour(a, b) {
  // Supply and ground win over signal: a lead from 5V to a sensor's VCC is a
  // power lead and should read red even though the far end is a sensor.
  const types = [a?.type, b?.type]
  if (types.includes(TERMINAL_TYPE.VCC)) return WIRE_COLOUR.vcc
  if (types.includes(TERMINAL_TYPE.GND)) return WIRE_COLOUR.gnd
  // Motor leads keep the orange the harness already used, so the two ways a
  // motor can be wired do not end up different colours.
  if (['motor', 'motorDriver'].includes(a?.partKind) || ['motor', 'motorDriver'].includes(b?.partKind)) return WIRE_COLOUR.motor
  if (isLed(a?.partKind) || isLed(b?.partKind)) return WIRE_COLOUR.led
  return WIRE_COLOUR.sensor
}

/**
 * A rail's electrical type. Pads with no rail (NC, IOREF, RESET, AREF, the
 * analog inputs) are signals as far as wiring is concerned.
 */
const railType = (rail) =>
  rail === 'vcc' ? TERMINAL_TYPE.VCC : rail === 'gnd' ? TERMINAL_TYPE.GND : TERMINAL_TYPE.SIGNAL

/**
 * Terminals a part offers, in its own local frame.
 *
 * Returns [] for parts that carry no electrical connection, which is most of
 * them — strips, brackets, wheels and standoffs are structure only.
 */
export function terminalsOf(part) {
  if (part?.kind === 'breadboard') {
    return breadboardHoles().map((hole) => ({
      id: hole.id,
      label: hole.label,
      type: TERMINAL_TYPE.PASSIVE,
      local: [...hole.local],
      group: hole.group,
      capacity: 1,
      breadboard: true,
    }))
  }
  if (SENSOR_SPECS[part?.kind]) return SENSOR_SPECS[part.kind].terminals.map((t) => ({ ...t, local: [...t.local] }))
  if (isKitComponent(part?.kind)) return componentTerminals(part.kind)
  switch (part?.kind) {
    case 'board':
      // The full Rev3 pinout, both edges, in the order the official diagram
      // prints them. Positions come from config, where each block is fitted to
      // the header body measured on the model.
      return [
        ...DIGITAL_HEADER.map((p) => ({
          id: p.id,
          label: p.label,
          pin: p.pin ?? null,
          type: railType(p.rail),
          local: [p.x, HEADER_TOP + 0.03, HEADER_Z],
        })),
        ...POWER_HEADER.map((p) => ({
          id: p.id,
          label: p.label,
          // A0–A5 carry their digital aliases (14–19, set in config); the
          // supply block genuinely has no pin and stays null.
          pin: p.pin ?? null,
          analog: p.analog ?? null,
          type: railType(p.rail),
          local: [p.x, HEADER_TOP + 0.03, POWER_Z],
        })),
      ]

    case 'motor':
      /*
       * On the rear solder tags, not the midsection of the can.
       *
       * MotorMesh already draws two gold tabs behind the end cap at
       * (-motorLength/2 - 0.1, 0.1, ±0.09); these are the same coordinates, so
       * a lead now leaves the tag you can see rather than sprouting from the
       * middle of the body.
       */
      return [
        { id: 'M+', label: 'M+', type: TERMINAL_TYPE.MOTOR, local: [-MOUNT.motorLength / 2 - 0.1, 0.1, 0.09] },
        { id: 'M-', label: 'M-', type: TERMINAL_TYPE.MOTOR, local: [-MOUNT.motorLength / 2 - 0.1, 0.1, -0.09] },
      ]

    default:
      if (!isLed(part?.kind)) return []
      /*
       * The two leg tips.
       *
       * LedMesh draws its legs as cylinders at x = ±0.07, running from y = 0
       * to y = 0.22; these anchor at the bottom of each, which is the end that
       * goes into the board. Long leg is the anode by convention, so +x is A.
       *
       * The LED is a separate chassis-mounted part. Its anode and cathode are
       * electrically meaningful only after the learner draws both leads.
       */
      return LED_TERMINALS(part.kind)
  }
}

const LED_TERMINALS = (kind) => kind === 'rgbLed' ? [
  { id: 'R', label: 'R', type: TERMINAL_TYPE.SIGNAL, local: [-0.12, 0.02, 0] },
  { id: 'K', label: 'K', type: TERMINAL_TYPE.GND, local: [-0.04, 0.02, 0] },
  { id: 'G', label: 'G', type: TERMINAL_TYPE.SIGNAL, local: [0.04, 0.02, 0] },
  { id: 'B', label: 'B', type: TERMINAL_TYPE.SIGNAL, local: [0.12, 0.02, 0] },
] : [
  { id: 'A', label: 'A', type: TERMINAL_TYPE.SIGNAL, local: [0.07, 0.02, 0] },
  { id: 'K', label: 'K', type: TERMINAL_TYPE.GND, local: [-0.07, 0.02, 0] },
]

/** One terminal by id, or null. */
export function terminalOf(part, id) {
  if (part?.kind === 'breadboard') {
    const hole = breadboardHole(id)
    return hole ? {
      id: hole.id,
      label: hole.label,
      type: TERMINAL_TYPE.PASSIVE,
      local: [...hole.local],
      group: hole.group,
      capacity: 1,
      breadboard: true,
    } : null
  }
  return terminalsOf(part).find((t) => t.id === id) ?? null
}

/**
 * Terminal position in build space.
 *
 * The part's full orientation is applied to the local offset, so a board or a
 * sensor turned — or tilted — on the chassis carries its pins around with it.
 * (This used to yaw only the X/Z of the offset and add local Y straight to
 * world Y, which broke the moment a part could stand on its side.)
 */
export function terminalWorld(part, terminalId, parts) {
  if (part?.breadboardId && part.holes?.[terminalId]) {
    return terminalWorld(parts?.[part.breadboardId], part.holes[terminalId], parts)
  }
  const t = terminalOf(part, terminalId)
  if (!t) return null
  const tr = partTransform(part, parts)
  if (!tr) return null
  const d = applyOrient(tr.orient ?? ID, t.local)
  return [tr.pos[0] + d[0], tr.pos[1] + d[1], tr.pos[2] + d[2]]
}

/** Every terminal in the build, resolved to build space. Used by the pin layer. */
export function allTerminals(parts) {
  const out = []
  const occupiedBreadboardHoles = new Set(Object.values(parts ?? {}).flatMap((part) =>
    part.breadboardId ? Object.values(part.holes ?? {}).map((hole) => `${part.breadboardId}/${hole}`) : []))
  for (const part of Object.values(parts)) {
    for (const t of terminalsOf(part)) {
      if (part.kind === 'breadboard' && occupiedBreadboardHoles.has(`${part.id}/${t.id}`)) continue
      const pos = terminalWorld(part, t.id, parts)
      if (pos) out.push({ ...t, partId: part.id, partKind: part.kind, pos })
    }
  }
  return out
}

/**
 * May these two terminals be joined?
 *
 * The rules are the ones that keep a student out of trouble without turning
 * wiring into a puzzle: no lead from a part back to itself, no two supply
 * rails shorted together, and no supply straight to ground — that last one is
 * the classic short, and refusing it here is cheaper than simulating the smoke.
 */
export function canConnect(a, b) {
  if (!a || !b) return false
  if (a.partId === b.partId && a.id === b.id) return false
  // Two different sockets on one breadboard may be bridged by a jumper. Other
  // parts still cannot be wired back into themselves.
  if (a.partId === b.partId && a.partKind !== 'breadboard') return false
  if (a.type === TERMINAL_TYPE.VCC && b.type === TERMINAL_TYPE.GND) return false
  if (a.type === TERMINAL_TYPE.GND && b.type === TERMINAL_TYPE.VCC) return false
  const directLedSignal = (isLed(a.partKind) && b.partKind === 'board' && b.type === TERMINAL_TYPE.SIGNAL) ||
    (isLed(b.partKind) && a.partKind === 'board' && a.type === TERMINAL_TYPE.SIGNAL)
  if (directLedSignal) return false
  if (a.type === TERMINAL_TYPE.VCC && b.type === TERMINAL_TYPE.VCC) {
    // One Uno supply feeding a device's labelled VCC is not two power sources
    // shorted. This covers sensors, servos and the 16×2 LCD alike.
    const [source, input] = a.partKind === 'board' ? [a, b] : [b, a]
    return source.partKind === 'board' && input.partKind !== 'board' && input.id === 'VCC' &&
      (!SENSOR_SPECS[input.partKind] || SENSOR_SPECS[input.partKind].supply.includes(source.id))
  }
  const pair = new Set([a.type, b.type])
  if (pair.has(TERMINAL_TYPE.PASSIVE)) return true
  if (pair.has(TERMINAL_TYPE.MOTOR)) return pair.has(TERMINAL_TYPE.OUTPUT)
  if (pair.has(TERMINAL_TYPE.OUTPUT)) return pair.has(TERMINAL_TYPE.INPUT) || pair.has(TERMINAL_TYPE.SIGNAL)
  if (pair.has(TERMINAL_TYPE.INPUT)) return pair.has(TERMINAL_TYPE.SIGNAL) || pair.has(TERMINAL_TYPE.VCC) || pair.has(TERMINAL_TYPE.GND)
  if (pair.has(TERMINAL_TYPE.POWER_IN)) return pair.has(TERMINAL_TYPE.VCC)
  return a.type === b.type
}

/** Why a connection was refused, for the toast. */
export function refusalReason(a, b) {
  if (!a || !b) return 'wireNeedsTwo'
  if (a.partId === b.partId && a.partKind !== 'breadboard') return 'wireSamePart'
  if (
    (a.type === TERMINAL_TYPE.VCC && b.type === TERMINAL_TYPE.GND) ||
    (a.type === TERMINAL_TYPE.GND && b.type === TERMINAL_TYPE.VCC)
  )
    return 'wireShort'
  if (a.type === TERMINAL_TYPE.VCC && b.type === TERMINAL_TYPE.VCC) return 'wireTwoSupplies'
  if ((isLed(a.partKind) && b.partKind === 'board') || (isLed(b.partKind) && a.partKind === 'board')) return 'wireLedResistor'
  return 'wireNeedsTwo'
}
