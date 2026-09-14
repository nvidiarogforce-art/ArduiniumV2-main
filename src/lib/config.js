/**
 * Every dimension, colour and tuning number in one place.
 *
 * WORLD SCALE — 1 unit = 25.4 mm (one inch).
 * That is not arbitrary: real Meccano/Erector strips use a 12.7 mm (half-inch)
 * hole pitch, so one hole pitch is exactly 0.5 units and every other real
 * measurement falls out of it cleanly. The Arduino Uno's real 68.6 x 53.4 mm
 * outline becomes 2.70 x 2.10 units.
 *
 * Physics runs at this same scale with normal gravity, which makes the robot
 * behave like a large, heavy machine rather than a twitchy insect — much
 * easier for a 10-year-old to watch and understand.
 */

// ---------------------------------------------------------------- structure
export const PITCH = 0.5 // hole spacing (12.7 mm)
export const STRIP_W = 0.5 // strip width
export const STRIP_T = 0.09 // strip thickness (a little chunkier than real, for physics)
export const HOLE_R = 0.105 // hole radius
export const STRIP_LENGTHS = [5, 7, 11] // hole counts we offer

/** Overall length of a strip with `holes` holes. */
export const stripLength = (holes) => (holes - 1) * PITCH + STRIP_W

/** Local-space hole centres for a strip, along its long (X) axis. */
export function stripHoles(holes) {
  const span = (holes - 1) * PITCH
  return Array.from({ length: holes }, (_, i) => -span / 2 + i * PITCH)
}

export const BOLT = {
  headR: 0.15,
  headH: 0.07,
  shaftR: 0.095,
  nutR: 0.14,
  nutH: 0.08,
}

// -------------------------------------------------------------------- wheel
export const WHEEL = {
  radius: 0.62,
  width: 0.3,
  hubR: 0.22,
  gap: 0.08, // clearance between strip face and wheel face
}

// -------------------------------------------------------------------- board
export const BOARD = {
  width: 2.7, // 68.6 mm
  depth: 2.1, // 53.4 mm
  thickness: 0.07,
  pinPitch: 0.1, // 2.54 mm header pitch
}

/** Dimension set shared by the Meccano robotics expansion. */
export const MECCANO = {
  plateCols: 5,
  plateRows: 3,
  turntableBaseRadius: 1.18,
  turntableTopRadius: 0.98,
  turntableThickness: 0.12,
  gearSmallRadius: 0.46,
  gearLargeRadius: 0.82,
  gearThickness: 0.14,
  axleRadius: 0.075,
  axleLength: 1.5,
  gripperPalm: [2.5, 0.52],
  gripperJawLength: 1.35,
  gripperJawWidth: 0.34,
}

/**
 * Full-size solderless breadboard (the common 830-contact Arduino-kit board).
 *
 * The outside dimensions are the real 165 x 55 x 10 mm converted through the
 * workshop's 1 unit = 25.4 mm scale. Contact pitch is the standard 2.54 mm.
 * Electrical grouping lives in breadboard.js; this object is dimensions only
 * so renderers, colliders and bounding boxes cannot drift apart.
 */
export const BREADBOARD = {
  width: 165 / 25.4,
  depth: 55 / 25.4,
  height: 10 / 25.4,
  pitch: 2.54 / 25.4,
  rows: 63,
  railHoles: 50,
  holeRadius: 0.026,
}

/**
 * Six shield-style sockets along the front of the board. A component dropped
 * into a socket takes that socket's Arduino pin number — this is what makes
 * the pin map (Part 1.7) mean something to a student: "the motor is in pin 9".
 */
export const SOCKETS = [
  { id: 's0', pin: 13, x: -0.6 },
  { id: 's1', pin: 11, x: -0.2 },
  { id: 's2', pin: 10, x: 0.2 },
  { id: 's3', pin: 9, x: 0.6 },
  { id: 's4', pin: 6, x: 1.0 },
]

/**
 * The socket row, placed on the one strip of the real board that is actually
 * bare copper.
 *
 * These used to sit at z = -0.05 spanning x -1.24..1.24, which was fine over a
 * featureless slab. Against the real Rev3 geometry it put socket s4 inside the
 * 0.36-tall digital header and left s0 wedged between the USB shield and the
 * barrel jack, so components appeared stuck to the connectors.
 *
 * z = -0.45 is the clearest row on the board: an occupancy map of the model
 * (max height per 0.15-unit cell, above the PCB face) shows nothing but flat
 * PCB across the whole span there.
 *
 * The x range runs -0.6..1.0 rather than the old -1.24..1.24 because a
 * component's pad is 0.52 wide: seated at x = -1.0 it would still reach to
 * -1.26 and bury itself in the USB shield, which begins at x = -1.15.
 */
export const SOCKET_Z = -0.45

/**
 * Top face of the PCB.
 *
 * Measured from the model, not derived from BOARD.thickness: the real board's
 * slab runs from y = -0.035 to y = 0.045, so anything drawn at thickness/2
 * (0.035) sits *inside* the board and z-fights with it.
 */
export const BOARD_SURFACE = 0.05

/** Four bolt holes on the board, so strips can carry it (Part 2.4). */
// Deliberately on the 0.5 hole grid so the board bolts straight onto strips.
export const BOARD_HOLES = [
  [-1.0, -0.5],
  [1.0, -0.5],
  [-1.0, 0.5],
  [1.0, 0.5],
].map(([x, z]) => ({ x, z }))

/**
 * Digital header row, along the board's +Z edge. Wires terminate here.
 *
 * Both numbers are measured off the Rev3 model rather than guessed. z is the
 * mean of the gold pin tips on that edge (y > 0.335), not the median of the
 * whole plastic body — the body is wide and its median sat 0.078 back from the
 * posts, which put every digital terminal 2 mm off the metal.
 */
export const HEADER_Z = 0.944
export const HEADER_TOP = 0.36

/** Real header pitch: 2.54 mm, and a scene unit is one inch. */
export const HEADER_PITCH = 0.1

/**
 * Jumper-lead colours, following the convention every wiring diagram uses:
 * red carries supply, black is ground, and signal leads take a colour of their
 * own so a glance at the harness tells you what each lead is for.
 *
 * Kept here rather than beside the renderer because wiring rules, templates
 * and the 3D lead renderer all use the same semantic colours.
 */
export const WIRE_COLOUR = {
  vcc: '#e0342a', // 5V / VIN
  gnd: '#1a1a1a', // ground
  led: '#e2544c',
  sensor: '#f0b429', // signal
  // Orange, not the blue a wiring diagram would use, because the chassis
  // strips in this project are #3d76c4 — a blue lead slung across them is
  // nearly invisible. Orange is what the design system already reserves for
  // power and motors, so it reads correctly here and stays legible.
  motor: '#ef7f2a', // signal
}

/**
 * THE REV3 PINOUT.
 *
 * Names and ordering are the official Arduino Uno Rev3 pinout diagram; the
 * coordinates are fitted to this model's own header bodies, which were
 * measured by clustering the pin posts:
 *
 *   digital edge (+Z)  bodies at x -0.722..0.431 and 0.608..1.140
 *   power edge  (-Z)   bodies at x -0.721..0.313 and 0.451..1.140
 *
 * Each edge carries two separate blocks with a gap between them, exactly as
 * the diagram shows, and every pin sits on the standard 2.54 mm pitch — which
 * is 0.1 units here, since a scene unit is an inch. Each block is centred in
 * its own body so the pins land on the plastic rather than beside it.
 *
 * Reading order runs from the USB end (-X) outward, so on the digital edge
 * SCL comes first and D0 last, and on the power edge NC comes first and A5
 * last. That is the same direction you read the diagram with the USB at top.
 *
 * `pin` is the Arduino number the runtime cares about; rails and unnumbered
 * pads carry null.
 */
const block = (centre, n) => (i) => +(centre - ((n - 1) * HEADER_PITCH) / 2 + i * HEADER_PITCH).toFixed(3)

/*
 * Digital edge: a 10-way block nearest the USB, then an 8-way block.
 *
 * Centred on the runs of gold posts (-0.282..0.480 and 0.584..1.189), not on
 * the plastic bodies. The bodies extend well past their metal on this model —
 * body A starts at -0.722 but its first post is at -0.282 — so centring on the
 * body put the top four pins over bare plastic, 2.8 mm from anything.
 */
const DIG_A = block((-0.282 + 0.48) / 2, 10)
const DIG_B = block((0.584 + 1.189) / 2, 8)

export const DIGITAL_HEADER = [
  { id: 'SCL', label: 'SCL', pin: null, x: DIG_A(0) },
  { id: 'SDA', label: 'SDA', pin: null, x: DIG_A(1) },
  { id: 'AREF', label: 'AREF', pin: null, x: DIG_A(2) },
  { id: 'GND3', label: 'GND', pin: null, x: DIG_A(3), rail: 'gnd' },
  { id: 'D13', label: 'D13', pin: 13, x: DIG_A(4) },
  { id: 'D12', label: 'D12', pin: 12, x: DIG_A(5) },
  { id: 'D11', label: '~D11', pin: 11, x: DIG_A(6) },
  { id: 'D10', label: '~D10', pin: 10, x: DIG_A(7) },
  { id: 'D9', label: '~D9', pin: 9, x: DIG_A(8) },
  { id: 'D8', label: 'D8', pin: 8, x: DIG_A(9) },

  { id: 'D7', label: 'D7', pin: 7, x: DIG_B(0) },
  { id: 'D6', label: '~D6', pin: 6, x: DIG_B(1) },
  { id: 'D5', label: '~D5', pin: 5, x: DIG_B(2) },
  { id: 'D4', label: 'D4', pin: 4, x: DIG_B(3) },
  { id: 'D3', label: '~D3', pin: 3, x: DIG_B(4) },
  { id: 'D2', label: 'D2', pin: 2, x: DIG_B(5) },
  { id: 'D1', label: 'D1/TX', pin: 1, x: DIG_B(6) },
  { id: 'D0', label: 'D0/RX', pin: 0, x: DIG_B(7) },
]

// Power edge: the 8-way supply block, then the 6-way analog block.
const PWR_A = block((-0.721 + 0.313) / 2, 8)
const PWR_B = block((0.451 + 1.14) / 2, 6)

export const POWER_HEADER = [
  { id: 'NC', label: 'NC', x: PWR_A(0) },
  { id: 'IOREF', label: 'IOREF', x: PWR_A(1) },
  { id: 'RESET', label: 'RESET', x: PWR_A(2) },
  { id: '3V3', label: '3.3V', x: PWR_A(3), rail: 'vcc' },
  { id: '5V', label: '5V', x: PWR_A(4), rail: 'vcc' },
  { id: 'GND1', label: 'GND', x: PWR_A(5), rail: 'gnd' },
  { id: 'GND2', label: 'GND', x: PWR_A(6), rail: 'gnd' },
  { id: 'VIN', label: 'VIN', x: PWR_A(7), rail: 'vcc' },

  // On a real Uno, A0–A5 double as digital pins 14–19 — which is why they
  // carry a `pin`. Without it, a sensor wired to A0 claimed nothing in
  // pinMap, `hasSensor` stayed false, and readDistanceCm() silently returned
  // 0 — making "if distance < 20" permanently true for a perfectly wired build.
  { id: 'A0', label: 'A0', x: PWR_B(0), analog: 0, pin: 14 },
  { id: 'A1', label: 'A1', x: PWR_B(1), analog: 1, pin: 15 },
  { id: 'A2', label: 'A2', x: PWR_B(2), analog: 2, pin: 16 },
  { id: 'A3', label: 'A3', x: PWR_B(3), analog: 3, pin: 17 },
  { id: 'A4', label: 'A4', x: PWR_B(4), analog: 4, pin: 18 },
  { id: 'A5', label: 'A5', x: PWR_B(5), analog: 5, pin: 19 },
]

/** The -Z header row: mean of its pin tips, same measurement as HEADER_Z. */
export const POWER_Z = -0.937

/**
 * Where a digital pin physically sits along the header.
 *
 * A lookup rather than a formula now: the two blocks are separated by a gap on
 * a real board, so pin number no longer maps linearly to x. Kept as a function
 * because callers only ever have a pin number to hand.
 */
const DIGITAL_BY_PIN = new Map(DIGITAL_HEADER.filter((p) => p.pin != null).map((p) => [p.pin, p.x]))
export const HEADER_PIN_X = (pin) => DIGITAL_BY_PIN.get(Number(pin)) ?? DIG_B(7)

// ------------------------------------------------------------------ snapping
export const SNAP_RADIUS = 0.42 // how close two holes must be to bolt together
// One quarter turn per rotate press. This must match the 90° quantiser in the
// build store: when the step was 45° and the quantiser rounded to 90°, a
// reverse press computed -45° and Math.round(-0.5) === -0 threw it away, so
// counter-clockwise rotation silently never worked.
export const ROTATION_STEP = Math.PI / 2

// ------------------------------------------------------------------ terrain
export const TERRAIN = {
  size: 34,
  segments: 44,
  amplitude: 0.55,
  padRadius: 7, // flat build pad in the middle
  padFalloff: 3.5,
}

// -------------------------------------------------------------------- colours
export const C = {
  pcb: '#087f8c',
  pcbDark: '#075f69',
  header: '#20242b',
  pinGold: '#d7ae4d',
  usb: '#aeb7c1',
  chip: '#262b33',

  strip: '#3d76c4',
  stripDark: '#2b5794',
  bolt: '#7d8896',
  nut: '#616c79',

  tyre: '#2f343c',
  hub: '#c9d1da',

  ledRed: '#e0483d',
  sensorBlue: '#1f6fb2',
  sensorCan: '#aab3bd',
  motorBody: '#8f98a4',
  motorCap: '#3b444f',

  ground: '#b9a882',
  groundDark: '#a3906c',
  grass: '#7fa05a',
  rock: '#8c8377',
  ramp: '#c08f52',
  track: '#e8e2d3',

  outline: '#1b232c',
}

export const OUTLINE_THICKNESS = 0.02

// ------------------------------------------------------------------- physics
export const PHYSICS = {
  gravity: [0, -9.81, 0],
  solverIterations: 16,
  wheelFriction: 0.06,
  groundFriction: 0.8,
  terrainFriction: 0.8,
  stripFriction: 0.6,
  /** Rapier motor tuning: how hard the wheel motor tries to hit its target. */
  /**
   * Wheel drive is a torque controller rather than Rapier's built-in joint
   * motor. The joint motor sets a velocity by solving a constraint, and a
   * constraint that stiff, engaging while a freshly-created assembly is still
   * settling, reliably threw the robot into the air. Torque is gentler and
   * completely predictable: the wheel accelerates, friction with the ground
   * does the rest, and a stuck wheel simply stops — which is exactly what the
   * stall detector wants to see.
   */
  driveGain: 9.0, // newtons per unit/s of speed error
  driveMaxForce: 20.0, // newtons per driven wheel
  /** Program speed (-255..255) -> travel speed in world units per second. */
  speedToUnitsPerSec: 0.019,
  /**
   * How far above the ground the build is lifted before Run releases it.
   * A visible little drop, on purpose: it reads as "now it's real", and it
   * gives the terrain collider time to be live before anything touches it.
   */
  dropClearance: 0.22,
}

// ============================================================ new structure
/**
 * The mounting chain that makes a real drivetrain:
 *   chassis hole -> motor mount -> DC motor -> wheel
 * Every link shares one axis, so a wheel can only ever end up where a wheel
 * belongs: on the end of a motor shaft, upright, clear of the ground.
 */
export const MOUNT = {
  bracketDepth: 0.26, // how far the mounting plate stands off the strip
  bracketWidth: 0.66,
  bracketHeight: 0.7,
  motorRadius: 0.24,
  motorLength: 0.72,
  shaftLength: 0.22,
  shaftRadius: 0.06,
}

export const DECK = { cols: 5, rows: 3 } // perforated deck plate, in holes

/**
 * The ball caster is deliberately sized so its ball touches the ground at the
 * exact height a driven wheel does: stem + ball == WHEEL.radius. Put casters at
 * the front of a chassis and the robot sits dead level, with no fiddling.
 */
export const CASTER = { ball: 0.22, stem: 0.62 - 0.22 }
export const STANDOFF = { radius: 0.16, height: 0.7 }
export const LBRACKET = { arm: 1.0, width: 0.5, thickness: 0.1 }

/**
 * The upright post — a vertical column that carries holes up the build.
 *
 * A standoff raises one thing by one fixed step and an L-bracket raises one
 * thing by one arm. Neither lets a student choose a height, which is what
 * building a mast, a sensor tower or a second storey actually needs.
 *
 * `height` is a whole number of PITCH on purpose, so the holes land on the same
 * 12.7 mm grid as every strip. A cross-member bolted between two uprights then
 * meets both at the same level by construction rather than by luck.
 */
export const UPRIGHT = { post: 0.3, levels: 3, height: 3 * PITCH }

// ================================================================== arena
export const ARENA = {
  size: 44,
  buildZone: 6.5, // flat, obstacle-free radius around the origin
  wallHeight: 0.9,
  wallThickness: 0.5,
  half: 20, // inner face of the perimeter walls
  friction: 0.8,
  rampAngle: 0.31, // ~18°
}
