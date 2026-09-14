import { BREADBOARD } from './config.js'

/**
 * Canonical contact map for a full-size 830-point solderless breadboard.
 *
 * - 63 numbered terminal rows, A-E and F-J (630 contacts).
 * - Four 50-contact power rails (200 contacts).
 * - Each five-hole terminal strip is one conductor.
 * - The centre trench separates E from F.
 * - Every power rail is split at its visible centre break.
 *
 * IDs are part of the save format. Keep them stable.
 */
export const TERMINAL_COLUMNS = Object.freeze(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'])
export const RAIL_SIDES = Object.freeze(['top', 'bottom'])
export const RAIL_POLARITIES = Object.freeze(['+', '-'])

const terminalZ = Object.freeze({
  A: -0.57, B: -0.47, C: -0.37, D: -0.27, E: -0.17,
  F: 0.17, G: 0.27, H: 0.37, I: 0.47, J: 0.57,
})

const railZ = Object.freeze({
  'top:+': -0.98,
  'top:-': -0.84,
  'bottom:-': 0.84,
  'bottom:+': 0.98,
})

export const terminalHoleId = (column, row) => `t:${column}:${row}`
export const railHoleId = (side, polarity, index) => `r:${side}:${polarity}:${index}`

/** The two rail halves have a real, visible break and are not connected. */
function railX(index) {
  const local = (index - 1) % 25
  const half = index <= 25 ? -1 : 1
  const centre = half * 1.33
  return centre + (local - 12) * BREADBOARD.pitch
}

export function breadboardGroup(id) {
  const bits = String(id).split(':')
  if (bits[0] === 't' && TERMINAL_COLUMNS.includes(bits[1])) {
    const row = Number(bits[2])
    if (!Number.isInteger(row) || row < 1 || row > BREADBOARD.rows) return null
    return `terminal:${row}:${bits[1] <= 'E' ? 'left' : 'right'}`
  }
  if (bits[0] === 'r' && RAIL_SIDES.includes(bits[1]) && RAIL_POLARITIES.includes(bits[2])) {
    const index = Number(bits[3])
    if (!Number.isInteger(index) || index < 1 || index > BREADBOARD.railHoles) return null
    return `rail:${bits[1]}:${bits[2]}:${index <= 25 ? 'left' : 'right'}`
  }
  return null
}

export function breadboardHole(id) {
  const bits = String(id).split(':')
  if (bits[0] === 't' && TERMINAL_COLUMNS.includes(bits[1])) {
    const row = Number(bits[2])
    if (!Number.isInteger(row) || row < 1 || row > BREADBOARD.rows) return null
    return {
      id,
      label: `${bits[1]}${row}`,
      group: breadboardGroup(id),
      local: [(row - 32) * BREADBOARD.pitch, BREADBOARD.height / 2 + 0.025, terminalZ[bits[1]]],
      region: 'terminal',
    }
  }
  if (bits[0] === 'r' && RAIL_SIDES.includes(bits[1]) && RAIL_POLARITIES.includes(bits[2])) {
    const index = Number(bits[3])
    if (!Number.isInteger(index) || index < 1 || index > BREADBOARD.railHoles) return null
    return {
      id,
      label: `${bits[2]} ${bits[1] === 'top' ? 'T' : 'B'}${index}`,
      group: breadboardGroup(id),
      local: [railX(index), BREADBOARD.height / 2 + 0.025, railZ[`${bits[1]}:${bits[2]}`]],
      region: 'rail',
      polarity: bits[2],
    }
  }
  return null
}

let cachedHoles = null

export function breadboardHoles() {
  if (cachedHoles) return cachedHoles
  const holes = []
  for (let row = 1; row <= BREADBOARD.rows; row++) {
    for (const column of TERMINAL_COLUMNS) holes.push(breadboardHole(terminalHoleId(column, row)))
  }
  for (const side of RAIL_SIDES) {
    for (const polarity of RAIL_POLARITIES) {
      for (let index = 1; index <= BREADBOARD.railHoles; index++) {
        holes.push(breadboardHole(railHoleId(side, polarity, index)))
      }
    }
  }
  cachedHoles = Object.freeze(holes.map(Object.freeze))
  return cachedHoles
}

export const isBreadboardHole = (id) => breadboardGroup(id) != null

const linear = (...ids) => Object.fromEntries(ids.map((id, index) => [id, { row: index, col: 0 }]))

/**
 * Lead patterns measured in breadboard grid steps. `row` runs along the
 * numbered axis; `col` runs A..J across the centre trench.
 */
export const BREADBOARD_FOOTPRINTS = Object.freeze({
  resistor: { leads: { '1': { row: 0, col: 0 }, '2': { row: 5, col: 0 } } },
  diode: { leads: { A: { row: 0, col: 0 }, K: { row: 5, col: 0 } } },
  capacitor: { leads: { '+': { row: 0, col: 0 }, '-': { row: 2, col: 0 } } },
  transistor: { leads: linear('C', 'B', 'E') },
  mosfet: { leads: linear('G', 'D', 'S') },
  photoTransistor: { leads: linear('VCC', 'OUT', 'GND') },
  tmp36: { leads: linear('VCC', 'OUT', 'GND') },
  tiltSwitch: { leads: linear('VCC', 'OUT', 'GND') },
  potentiometer: { leads: linear('VCC', 'OUT', 'GND') },
  pushButton: { leads: { NO: { row: 0, col: 0 }, COM: { row: 2, col: 0 } } },
  piezo: { leads: { '+': { row: 0, col: 0 }, '-': { row: 2, col: 0 } } },
  led: { leads: { A: { row: 0, col: 0 }, K: { row: 2, col: 0 } } },
  ledRed: { leads: { A: { row: 0, col: 0 }, K: { row: 2, col: 0 } } },
  ledGreen: { leads: { A: { row: 0, col: 0 }, K: { row: 2, col: 0 } } },
  ledYellow: { leads: { A: { row: 0, col: 0 }, K: { row: 2, col: 0 } } },
  ledBlue: { leads: { A: { row: 0, col: 0 }, K: { row: 2, col: 0 } } },
  ledWhite: { leads: { A: { row: 0, col: 0 }, K: { row: 2, col: 0 } } },
  rgbLed: { leads: linear('R', 'K', 'G', 'B') },
  optocoupler: { leads: { A: { row: 0, col: 0 }, K: { row: 2, col: 0 }, E: { row: 2, col: 5 }, C: { row: 0, col: 5 } } },
  motorDriver: {
    leads: {
      EN12: { row: 0, col: 0 }, IN1: { row: 1, col: 0 }, OUT1: { row: 2, col: 0 }, GND4: { row: 3, col: 0 },
      GND5: { row: 4, col: 0 }, OUT2: { row: 5, col: 0 }, IN2: { row: 6, col: 0 }, VMOT: { row: 7, col: 0 },
      VCC: { row: 0, col: 5 }, IN4: { row: 1, col: 5 }, OUT4: { row: 2, col: 5 }, GND13: { row: 3, col: 5 },
      GND12: { row: 4, col: 5 }, OUT3: { row: 5, col: 5 }, IN3: { row: 6, col: 5 }, EN34: { row: 7, col: 5 },
    },
  },
})

export const canInsertOnBreadboard = (kind) => Object.hasOwn(BREADBOARD_FOOTPRINTS, kind)

/** Resolve a lead pattern from one anchor hole, or null if it falls off-grid. */
export function footprintAt(kind, anchorId) {
  const footprint = BREADBOARD_FOOTPRINTS[kind]
  const bits = String(anchorId).split(':')
  if (!footprint || bits[0] !== 't') return null
  const anchorCol = TERMINAL_COLUMNS.indexOf(bits[1])
  const anchorRow = Number(bits[2])
  if (anchorCol < 0 || !Number.isInteger(anchorRow)) return null
  const holes = {}
  for (const [terminal, offset] of Object.entries(footprint.leads)) {
    const row = anchorRow + offset.row
    const col = anchorCol + offset.col
    if (row < 1 || row > BREADBOARD.rows || col < 0 || col >= TERMINAL_COLUMNS.length) return null
    holes[terminal] = terminalHoleId(TERMINAL_COLUMNS[col], row)
  }
  return holes
}

/** Map each conductor to its member holes for unioning into electrical nets. */
export function breadboardGroups() {
  const groups = new Map()
  for (const hole of breadboardHoles()) {
    if (!groups.has(hole.group)) groups.set(hole.group, [])
    groups.get(hole.group).push(hole.id)
  }
  return groups
}
