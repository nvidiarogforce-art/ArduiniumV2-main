import { SENSOR_KINDS } from './sensors.js'
import { COMPONENT_KINDS, COMPONENT_SPECS, LED_KINDS, isKitComponent } from './electronics.js'
import { BOARD, DECK, LBRACKET, MECCANO, MOUNT, PITCH, STANDOFF, STRIP_W, UPRIGHT, WHEEL } from './config.js'

/**
 * THE PART CATALOGUE AND THE SNAP MATRIX.
 *
 * Every part declares two things:
 *
 *   `accepts` — the node categories this part can plug INTO
 *   `offers`  — the node categories this part exposes for others
 *
 * Snapping then reduces to matching one against the other, and a whole class
 * of bugs disappears with it. A wheel used to be allowed to bolt into any hole
 * in a metal strip, which is why wheels ended up buried in the chassis or
 * scraping the terrain: nothing in the code said "a wheel goes on a shaft".
 * Now it does, and nothing else will accept one.
 *
 * Categories:
 *   CHASSIS_HOLE  a bolt hole in a strip, deck plate or bracket
 *   MOTOR_SEAT    the cradle of a motor mount, axis horizontal
 *   MOTOR_SHAFT   the output shaft tip of a DC motor
 */

export const CATEGORY = {
  HOLE: 'CHASSIS_HOLE',
  SEAT: 'MOTOR_SEAT',
  SHAFT: 'MOTOR_SHAFT',
  SERVO_SHAFT: 'SERVO_OUTPUT_SHAFT',
}

/**
 * `mount` parts derive their whole transform from the thing they are attached
 * to (a chain of them, in the drivetrain's case). `flat` parts lie on the
 * build plane with a yaw of their own.
 */
export const PART_SPECS = {
  // ------------------------------------------------------------- flat frame
  strip5: { group: 'structure', form: 'strip', holes: 5, place: 'flat', accepts: [CATEGORY.HOLE], offers: [CATEGORY.HOLE] },
  strip7: { group: 'structure', form: 'strip', holes: 7, place: 'flat', accepts: [CATEGORY.HOLE], offers: [CATEGORY.HOLE] },
  strip11: { group: 'structure', form: 'strip', holes: 11, place: 'flat', accepts: [CATEGORY.HOLE], offers: [CATEGORY.HOLE] },
  strip15: { group: 'structure', form: 'strip', holes: 15, place: 'flat', accepts: [CATEGORY.HOLE], offers: [CATEGORY.HOLE] },
  deck: { group: 'structure', form: 'deck', place: 'flat', accepts: [CATEGORY.HOLE], offers: [CATEGORY.HOLE] },
  plate3x5: { group: 'structure', form: 'plate3x5', place: 'flat', accepts: [CATEGORY.HOLE], offers: [CATEGORY.HOLE] },
  turntableBase: { group: 'structure', form: 'turntableBase', place: 'flat', accepts: [CATEGORY.HOLE], offers: [CATEGORY.HOLE] },
  turntableTop: { group: 'structure', form: 'turntableTop', place: 'flat', accepts: [CATEGORY.HOLE], offers: [CATEGORY.HOLE] },
  gearSmall: { group: 'structure', form: 'gearSmall', place: 'flat', accepts: [CATEGORY.HOLE], offers: [CATEGORY.HOLE] },
  gearLarge: { group: 'structure', form: 'gearLarge', place: 'flat', accepts: [CATEGORY.HOLE], offers: [CATEGORY.HOLE] },
  gripperPalm: { group: 'structure', form: 'gripperPalm', place: 'flat', accepts: [CATEGORY.HOLE], offers: [CATEGORY.HOLE] },
  gripperJawL: { group: 'structure', form: 'gripperJaw', place: 'flat', accepts: [CATEGORY.HOLE], offers: [CATEGORY.HOLE] },
  gripperJawR: { group: 'structure', form: 'gripperJaw', place: 'flat', accepts: [CATEGORY.HOLE], offers: [CATEGORY.HOLE] },
  board: { group: 'structure', form: 'board', place: 'flat', accepts: [CATEGORY.HOLE], offers: [CATEGORY.HOLE] },
  breadboard: { group: 'components', form: 'breadboard', place: 'flat', accepts: [], offers: [] },

  // -------------------------------------------------------- bolt-on fittings
  lbracket: { group: 'structure', form: 'lbracket', place: 'mount', mountTo: CATEGORY.HOLE, accepts: [CATEGORY.HOLE], offers: [CATEGORY.HOLE] },
  standoff: { group: 'structure', form: 'standoff', place: 'mount', mountTo: CATEGORY.HOLE, accepts: [CATEGORY.HOLE], offers: [CATEGORY.HOLE] },
  upright: { group: 'structure', form: 'upright', place: 'mount', mountTo: CATEGORY.HOLE, accepts: [CATEGORY.HOLE], offers: [CATEGORY.HOLE] },
  caster: { group: 'structure', form: 'caster', place: 'mount', mountTo: CATEGORY.HOLE, accepts: [CATEGORY.HOLE], offers: [] },
  motormount: { group: 'structure', form: 'motormount', place: 'mount', mountTo: CATEGORY.HOLE, accepts: [CATEGORY.HOLE], offers: [CATEGORY.SEAT] },

  // ------------------------------------------------------------- drivetrain
  motor: { group: 'structure', form: 'motor', place: 'mount', mountTo: CATEGORY.SEAT, accepts: [CATEGORY.SEAT], offers: [CATEGORY.SHAFT] },
  wheel: { group: 'structure', form: 'wheel', place: 'mount', mountTo: CATEGORY.SHAFT, accepts: [CATEGORY.SHAFT], offers: [] },

  // ------------------------------------------------------------- electronics
  ...Object.fromEntries(LED_KINDS.map((kind) => [kind, {
    group: 'electronics', form: 'led', place: 'mount', mountTo: CATEGORY.HOLE,
    accepts: [CATEGORY.HOLE], offers: [],
  }])),
  /**
   * The HC-SR04 bolts to the chassis, not into the board.
   *
   * It used to seat in a PCB socket, which made it electrically part of the
   * Arduino by construction — a sensor could not be anywhere else, and its pin
   * was decided by which socket it landed in. On real hardware it is a module
   * on the front of the robot with four flying leads, and Module 3 wants that:
   * mechanically it takes a chassis hole like any other fitting, electrically
   * it reaches the board only through wires the student draws.
   */
  sensor: { group: 'electronics', form: 'sensor', place: 'mount', mountTo: CATEGORY.HOLE, accepts: [CATEGORY.HOLE], offers: [] },
  ...Object.fromEntries(SENSOR_KINDS.filter((kind) => kind !== 'sensor').map((kind) => [kind, {
    group: 'electronics', form: isKitComponent(kind) ? 'kitComponent' : 'sensorModule', place: 'mount', mountTo: CATEGORY.HOLE,
    accepts: [CATEGORY.HOLE], offers: [],
  }])),
  ...Object.fromEntries(COMPONENT_KINDS.filter((kind) => !SENSOR_KINDS.includes(kind)).map((kind) => [kind, {
    group: 'components', form: 'kitComponent', place: 'mount', mountTo: CATEGORY.HOLE,
    accepts: [CATEGORY.HOLE], offers: [],
  }])),
  // A servo body bolts to the fixed side of a mechanism. Its keyed output is
  // deliberately a different node from an ordinary hole: only a horn can go
  // onto the spline, and the horn hands a real chassis hole to the moving arm.
  servo: {
    group: 'components', form: 'kitComponent', place: 'mount', mountTo: CATEGORY.HOLE,
    accepts: [CATEGORY.HOLE], offers: [CATEGORY.SERVO_SHAFT],
  },
  servoHorn: {
    group: 'structure', form: 'servoHorn', place: 'mount', mountTo: CATEGORY.SERVO_SHAFT,
    accepts: [CATEGORY.SERVO_SHAFT], offers: [CATEGORY.HOLE], clockable: true,
  },
}

export const spec = (kind) => PART_SPECS[kind] ?? PART_SPECS.strip5
export const isFlat = (kind) => spec(kind).place === 'flat'
export const isMount = (kind) => spec(kind).place === 'mount'
export const isSocket = (kind) => spec(kind).place === 'socket'
export const accepts = (kind) => spec(kind).accepts ?? []

export const CATALOGUE = {
  electronics: [...LED_KINDS.filter((kind) => kind !== 'led'), ...SENSOR_KINDS],
  components: ['breadboard', ...COMPONENT_KINDS.filter((kind) => !SENSOR_KINDS.includes(kind))],
  structure: [
    'board',
    'strip5',
    'strip7',
    'strip11',
    'strip15',
    'deck',
    'plate3x5',
    'turntableBase',
    'turntableTop',
    'gearSmall',
    'gearLarge',
    'gripperPalm',
    'gripperJawL',
    'gripperJawR',
    'servoHorn',
    'lbracket',
    'motormount',
    'motor',
    'wheel',
    'caster',
    'standoff',
    'upright',
  ],
}

/** How far along the mount axis each link in the chain sits from its host. */
export const CHAIN_OFFSET = {
  motormount: MOUNT.bracketDepth / 2 + STRIP_W / 2,
  motor: MOUNT.bracketDepth / 2 + MOUNT.motorLength / 2,
  wheel: MOUNT.motorLength / 2 + MOUNT.shaftLength + WHEEL.width / 2,
  caster: 0, // hangs straight down from the hole it bolts into
  standoff: 0,
  ...Object.fromEntries(LED_KINDS.map((kind) => [kind, 0])),
  ...Object.fromEntries(SENSOR_KINDS.map((kind) => [kind, 0])),
  ...Object.fromEntries(COMPONENT_KINDS.map((kind) => [kind, 0])),
  servoHorn: 0,
  lbracket: 0,
  upright: 0,
}

/**
 * The holes a MOUNTED fitting raises above itself, in its own local frame.
 *
 * This is the vertical half of the snap matrix. `CHAIN_OFFSET` says how far a
 * fitting sits ALONG the chain axis; this says where it hands out new holes,
 * which is how a build gains height at all.
 *
 * The frame is the fitting's own: +X runs along the chain axis (see `mountYaw`
 * in Build.jsx), +Y is up, +Z is across. Returning [] means the part offers no
 * holes and ends its branch.
 *
 * The L-bracket entry is the reason this function exists. Its node used to be
 * hard-coded as "straight up by one arm", but the mesh draws that hole at the
 * top of the UPRIGHT arm, which is offset along +X — so the green ring a
 * student aimed at and the place the part actually landed were about half an
 * arm apart. Reading both the node and the mesh off one number fixes that by
 * construction.
 */
export function mountHoles(kind) {
  switch (kind) {
    case 'servo':
      return [[...(COMPONENT_SPECS.servo.mechanical?.shaft ?? [0, -0.28, 0])]]
    case 'servoHorn':
      // Central spline screw: a beam mounted here rotates about the actual
      // servo axis instead of a nearby guessed hinge.
      return [[0, 0, 0]]
    case 'standoff':
      return [[0, STANDOFF.height / 2, 0]]
    case 'lbracket':
      return [[LBRACKET.arm / 2 - LBRACKET.thickness / 2, LBRACKET.arm, 0]]
    case 'upright':
      // One hole per PITCH up the post, so a second storey lands on the same
      // grid as the strips it will be built from.
      return Array.from({ length: UPRIGHT.levels }, (_, i) => [
        0,
        (i + 1) * PITCH - UPRIGHT.height / 2,
        0,
      ])
    default:
      return []
  }
}

/**
 * Axis of a raised mounting hole in the fitting's local frame.
 *
 * A standoff is drilled through its top (+Y). The visible holes in the
 * upright face and in the standing leg of an L-bracket are drilled across
 * that face (+Z). Keeping this beside mountHoles makes the rendered hole,
 * snap preview, bolt validation and Rapier joint agree exactly.
 */
export function mountHoleAxis(kind, _index = 0) {
  return kind === 'lbracket' || kind === 'upright' ? [0, 0, 1] : [0, 1, 0]
}

/** Local hole grid for the perforated deck plate. */
export function deckHoles() {
  const out = []
  for (let r = 0; r < DECK.rows; r++) {
    for (let c = 0; c < DECK.cols; c++) {
      out.push([
        -((DECK.cols - 1) * PITCH) / 2 + c * PITCH,
        0,
        -((DECK.rows - 1) * PITCH) / 2 + r * PITCH,
      ])
    }
  }
  return out
}

export const deckSize = () => [
  (DECK.cols - 1) * PITCH + STRIP_W,
  (DECK.rows - 1) * PITCH + STRIP_W,
]

/** The L-bracket's two foot holes (it bolts down through these). */
export const lbracketHoles = () => [
  [-PITCH / 2, 0, 0],
  [PITCH / 2, 0, 0],
]

export function plate3x5Holes() {
  const out = []
  for (let row = 0; row < MECCANO.plateRows; row++) {
    for (let col = 0; col < MECCANO.plateCols; col++) {
      out.push([(col - 2) * PITCH, 0, (row - 1) * PITCH])
    }
  }
  return out
}

export const turntableHoles = () => [
  [0, 0, 0],
  [PITCH, 0, 0], [-PITCH, 0, 0], [0, 0, PITCH], [0, 0, -PITCH],
]

export const gearHoles = (kind) => kind === 'gearLarge'
  ? [[0, 0, 0], [PITCH, 0, 0], [-PITCH, 0, 0], [0, 0, PITCH], [0, 0, -PITCH]]
  : [[0, 0, 0]]

export const gripperPalmHoles = () => [
  [-2 * PITCH, 0, 0], [-PITCH, 0, 0], [0, 0, 0], [PITCH, 0, 0], [2 * PITCH, 0, 0],
]

export const gripperJawHoles = () => [
  [-PITCH / 2, 0, 0], [PITCH / 2, 0, 0],
]

export const LB = LBRACKET
export const BOARD_SIZE = BOARD
