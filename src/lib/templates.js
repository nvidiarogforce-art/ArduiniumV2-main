import { BOARD, BREADBOARD, MECCANO, STRIP_T, WIRE_COLOUR } from './config.js'
import { ID, stepWorld } from './orient.js'

/**
 * Starter builds, authored as plain save-files.
 *
 * They go through the exact same `loadBuildFromJSON` path as a student's own
 * save, so there is no special "template system" to keep in sync — if loading
 * works for one, it works for both.
 *
 * The rover is worth reading as a worked example of the mounting chain:
 *
 *     cross member --bolt--> motor mount --seat--> DC motor --shaft--> wheel
 *
 * Nothing in the file says where a wheel *is*. It says which shaft it is on,
 * and the position falls out of that. Same for the casters at the front: they
 * hang from a chassis hole and are sized to hold the nose at exactly the height
 * the driven wheels hold the tail, so the robot sits level without tuning.
 */

const RAIL_Y = STRIP_T / 2 // 0.045 — bottom layer, resting on the build plane
const CROSS_Y = RAIL_Y + STRIP_T // 0.135 — second layer, across the rails
const DECK_Y = RAIL_Y + STRIP_T / 2 + BOARD.thickness / 2 // board on the rails
const WALL = stepWorld(ID, 'x', 1) // plate normal points along world +Z
const VERTICAL = stepWorld(WALL, 'z', 1) // long local +X points world +Y
const DOWN = stepWorld(stepWorld(VERTICAL, 'z', 1), 'z', 1)
const TURN_BASE_Y = RAIL_Y + STRIP_T / 2 + MECCANO.turntableThickness / 2
const TURN_TOP_Y = TURN_BASE_Y + MECCANO.turntableThickness

export const TEMPLATES = [
  {
    id: 'led',
    name: 'Basic LED circuit',
    blurb: 'One board, one LED, and code that makes it blink.',
    icon: '💡',
    json: {
      format: 'arduinium-build',
      version: 2,
      name: 'Basic LED circuit',
      parts: [
        { id: 't-board', kind: 'board', pos: [0, 0, 0], y: BOARD.thickness / 2, rotY: 0 },
        { id: 't-rail', kind: 'strip5', pos: [0, 0, -1.5], y: RAIL_Y, rotY: 0 },
        { id: 't-led', kind: 'ledRed', hostId: 't-rail', hostHole: 1 },
        { id: 't-resistor', kind: 'resistor', hostId: 't-rail', hostHole: 3 },
      ],
      wires: [
        { id: 'tw-led-r', a: { partId: 't-led', terminal: 'A' }, b: { partId: 't-resistor', terminal: '1' }, colour: WIRE_COLOUR.led },
        { id: 'tw-r-pin', a: { partId: 't-resistor', terminal: '2' }, b: { partId: 't-board', terminal: 'D13' }, colour: WIRE_COLOUR.led },
        { id: 'tw-gnd', a: { partId: 't-led', terminal: 'K' }, b: { partId: 't-board', terminal: 'GND1' }, colour: WIRE_COLOUR.gnd },
      ],
      bolts: [],
      program: [
        { id: 'l1', type: 'print', text: 'Blinking on pin 13' },
        {
          id: 'l2',
          type: 'forever',
          body: [
            { id: 'l3', type: 'digitalWrite', pin: 13, value: 'HIGH' },
            { id: 'l4', type: 'wait', ms: 500 },
            { id: 'l5', type: 'digitalWrite', pin: 13, value: 'LOW' },
            { id: 'l6', type: 'wait', ms: 500 },
          ],
        },
      ],
    },
  },

  {
    id: 'rover',
    name: 'Driving rover',
    blurb: 'A bolted chassis, two geared motors, two driven wheels and a caster nose.',
    icon: '🚙',
    json: {
      format: 'arduinium-build',
      version: 2,
      name: 'Driving rover',
      parts: [
        // ---- frame: two long rails, two cross members bridging them
        { id: 'r-railA', kind: 'strip11', pos: [0, 0, -1.0], y: RAIL_Y, rotY: 0 },
        { id: 'r-railB', kind: 'strip11', pos: [0, 0, 1.0], y: RAIL_Y, rotY: 0 },
        // rotY = 90°, so a cross member's local +X runs along world -Z.
        // Hole i then sits at world z = 1.5 - 0.5*i : hole 1 -> +1.0 (railB),
        // hole 5 -> -1.0 (railA), and holes 0 and 6 hang free outboard.
        { id: 'r-front', kind: 'strip7', pos: [-1.5, 0, 0], y: CROSS_Y, rotY: Math.PI / 2 },
        { id: 'r-rear', kind: 'strip7', pos: [1.5, 0, 0], y: CROSS_Y, rotY: Math.PI / 2 },

        // ---- board on the rails, turned so its socket row faces forward (+X)
        { id: 'r-board', kind: 'board', pos: [0, 0, 0], y: DECK_Y, rotY: -Math.PI / 2 },

        /*
         * ---- drivetrain, one chain per side.
         *
         * The motors sit on the cross-member at x = -1.5 and the casters on
         * the one at x = +1.5, and that choice IS the rover's heading:
         * driveFrame() points "forward" from the driven wheels towards the
         * rest of the chassis — the caster end leads. That makes forward
         * world +X, which is where every mission target lives. (The first
         * version had it the other way round, and the demo program drove the
         * rover backwards into the slalom cones for every mission.)
         */
        { id: 'r-mountL', kind: 'motormount', hostId: 'r-front', hostHole: 0 },
        { id: 'r-motorL', kind: 'motor', hostId: 'r-mountL', hostHole: 0 },
        { id: 'r-wheelL', kind: 'wheel', hostId: 'r-motorL', hostHole: 0 },

        { id: 'r-mountR', kind: 'motormount', hostId: 'r-front', hostHole: 6 },
        { id: 'r-motorR', kind: 'motor', hostId: 'r-mountR', hostHole: 0 },
        { id: 'r-wheelR', kind: 'wheel', hostId: 'r-motorR', hostHole: 0 },

        // ---- caster nose: no motor, no steering, just a ball that rolls.
        // These lead the way (see above).
        { id: 'r-castL', kind: 'caster', hostId: 'r-rear', hostHole: 2 },
        { id: 'r-castR', kind: 'caster', hostId: 'r-rear', hostHole: 4 },

        // ---- external LED: mounted on the frame and wired to D13 + GND
        { id: 'r-led', kind: 'ledRed', hostId: 'r-rear', hostHole: 0 },
        { id: 'r-led-resistor', kind: 'resistor', hostId: 'r-railA', hostHole: 0 },

        // L293D and its own motor supply. Direct Uno-to-motor wiring is never
        // treated as a working drivetrain.
        { id: 'r-driver', kind: 'motorDriver', hostId: 'r-front', hostHole: 3 },
        { id: 'r-battery', kind: 'battery9v', hostId: 'r-rear', hostHole: 6 },

        // The HC-SR04 bolts to the leading cross-member. Its transducers face
        // the fitting's local +Z, which the mount chain turns to world +X
        // here — the way the rover drives. It reaches the board through the
        // four leads below.
        { id: 'r-sensor', kind: 'sensor', hostId: 'r-rear', hostHole: 3 },
      ],
      // ---- the sensor's flying leads: power, ground and the two signals
      wires: [
        { id: 'rw-led-r', a: { partId: 'r-led', terminal: 'A' }, b: { partId: 'r-led-resistor', terminal: '1' }, colour: WIRE_COLOUR.led },
        { id: 'rw-r-pin', a: { partId: 'r-led-resistor', terminal: '2' }, b: { partId: 'r-board', terminal: 'D13' }, colour: WIRE_COLOUR.led },
        { id: 'rw-led-gnd', a: { partId: 'r-led', terminal: 'K' }, b: { partId: 'r-board', terminal: 'GND2' }, colour: WIRE_COLOUR.gnd },
        { id: 'rw-ml-plus', a: { partId: 'r-motorL', terminal: 'M+' }, b: { partId: 'r-driver', terminal: 'OUT1' }, colour: WIRE_COLOUR.motor },
        { id: 'rw-ml-minus', a: { partId: 'r-motorL', terminal: 'M-' }, b: { partId: 'r-driver', terminal: 'OUT2' }, colour: WIRE_COLOUR.motor },
        { id: 'rw-mr-plus', a: { partId: 'r-motorR', terminal: 'M+' }, b: { partId: 'r-driver', terminal: 'OUT3' }, colour: WIRE_COLOUR.motor },
        { id: 'rw-mr-minus', a: { partId: 'r-motorR', terminal: 'M-' }, b: { partId: 'r-driver', terminal: 'OUT4' }, colour: WIRE_COLOUR.motor },
        { id: 'rw-driver-vcc', a: { partId: 'r-driver', terminal: 'VCC' }, b: { partId: 'r-board', terminal: '5V' }, colour: WIRE_COLOUR.vcc },
        { id: 'rw-en12', a: { partId: 'r-driver', terminal: 'EN12' }, b: { partId: 'r-board', terminal: '5V' }, colour: WIRE_COLOUR.vcc },
        { id: 'rw-en34', a: { partId: 'r-driver', terminal: 'EN34' }, b: { partId: 'r-board', terminal: '5V' }, colour: WIRE_COLOUR.vcc },
        { id: 'rw-g4', a: { partId: 'r-driver', terminal: 'GND4' }, b: { partId: 'r-board', terminal: 'GND1' }, colour: WIRE_COLOUR.gnd },
        { id: 'rw-g5', a: { partId: 'r-driver', terminal: 'GND5' }, b: { partId: 'r-board', terminal: 'GND1' }, colour: WIRE_COLOUR.gnd },
        { id: 'rw-g12', a: { partId: 'r-driver', terminal: 'GND12' }, b: { partId: 'r-board', terminal: 'GND1' }, colour: WIRE_COLOUR.gnd },
        { id: 'rw-g13', a: { partId: 'r-driver', terminal: 'GND13' }, b: { partId: 'r-board', terminal: 'GND1' }, colour: WIRE_COLOUR.gnd },
        { id: 'rw-vmot', a: { partId: 'r-driver', terminal: 'VMOT' }, b: { partId: 'r-battery', terminal: '+' }, colour: WIRE_COLOUR.vcc },
        { id: 'rw-battery-gnd', a: { partId: 'r-battery', terminal: '-' }, b: { partId: 'r-board', terminal: 'GND3' }, colour: WIRE_COLOUR.gnd },
        { id: 'rw-in1', a: { partId: 'r-driver', terminal: 'IN1' }, b: { partId: 'r-board', terminal: 'D10' }, colour: WIRE_COLOUR.motor },
        { id: 'rw-in2', a: { partId: 'r-driver', terminal: 'IN2' }, b: { partId: 'r-board', terminal: 'D11' }, colour: WIRE_COLOUR.motor },
        { id: 'rw-in3', a: { partId: 'r-driver', terminal: 'IN3' }, b: { partId: 'r-board', terminal: 'D9' }, colour: WIRE_COLOUR.motor },
        { id: 'rw-in4', a: { partId: 'r-driver', terminal: 'IN4' }, b: { partId: 'r-board', terminal: 'D8' }, colour: WIRE_COLOUR.motor },
        { id: 'rw-vcc', a: { partId: 'r-sensor', terminal: 'VCC' }, b: { partId: 'r-board', terminal: '5V' }, colour: WIRE_COLOUR.vcc },
        { id: 'rw-gnd', a: { partId: 'r-sensor', terminal: 'GND' }, b: { partId: 'r-board', terminal: 'GND1' }, colour: WIRE_COLOUR.gnd },
        { id: 'rw-trig', a: { partId: 'r-sensor', terminal: 'TRIG' }, b: { partId: 'r-board', terminal: 'D6' }, colour: WIRE_COLOUR.sensor },
        { id: 'rw-echo', a: { partId: 'r-sensor', terminal: 'ECHO' }, b: { partId: 'r-board', terminal: 'D7' }, colour: WIRE_COLOUR.sensor },
      ],
      bolts: [
        { id: 'rb1', aId: 'r-front', aHole: 1, bId: 'r-railB', bHole: 2 },
        { id: 'rb2', aId: 'r-front', aHole: 5, bId: 'r-railA', bHole: 2 },
        { id: 'rb3', aId: 'r-rear', aHole: 1, bId: 'r-railB', bHole: 8 },
        { id: 'rb4', aId: 'r-rear', aHole: 5, bId: 'r-railA', bHole: 8 },
        // The board is turned 90°, so its local (x, z) holes map to world
        // (-z, x). Worked through, that puts h0/h2 over rail A and h1/h3
        // over rail B. `loadBuildFromJSON` re-checks this on every load.
        { id: 'rb5', aId: 'r-board', aHole: 0, bId: 'r-railA', bHole: 6 },
        { id: 'rb6', aId: 'r-board', aHole: 1, bId: 'r-railB', bHole: 6 },
        { id: 'rb7', aId: 'r-board', aHole: 2, bId: 'r-railA', bHole: 4 },
        { id: 'rb8', aId: 'r-board', aHole: 3, bId: 'r-railB', bHole: 4 },
      ],
      // Written with Drive blocks on purpose: change "forward" to "turn left"
      // in the dropdown and the rover really does turn left. Timings are
      // tuned to the arena: the first leg stops short of the ramp base
      // (x ≈ 9.8), and the turn is brief because an assembly this heavy
      // carries real angular momentum out of it.
      program: [
        { id: 'v1', type: 'digitalWrite', pin: 13, value: 'HIGH' },
        { id: 'v2', type: 'drive', dir: 'forward', speed: 140, ms: 2200 },
        // The waits are not padding: a Drive block ends with drive(STOP, 0),
        // and a stopped motor BRAKES — the pause is where the rover actually
        // sheds its momentum before changing direction, like a real one.
        { id: 'v3', type: 'wait', ms: 700 },
        { id: 'v4', type: 'drive', dir: 'right', speed: 150, ms: 900 },
        { id: 'v5', type: 'wait', ms: 400 },
        { id: 'v6', type: 'drive', dir: 'forward', speed: 140, ms: 2000 },
        { id: 'v7', type: 'digitalWrite', pin: 13, value: 'LOW' },
      ],
    },
  },

  {
    id: 'robotArm',
    name: 'Servo robot arm',
    blurb: 'A rotating Meccano arm with shoulder, elbow, wrist and a working two-finger gripper.',
    icon: '🦾',
    json: {
      format: 'arduinium-build',
      version: 4,
      name: 'Servo robot arm',
      parts: [
        // Heavy base, bearing and rotating upper plate.
        { id: 'a-base', kind: 'deck', pos: [0, 0, 0], y: RAIL_Y, rot: ID, rotY: 0, anchored: true },
        { id: 'a-turn-base', kind: 'turntableBase', pos: [0, 0, 0], y: TURN_BASE_Y, rot: ID, rotY: 0 },
        { id: 'a-turn-top', kind: 'turntableTop', pos: [0, 0, 0], y: TURN_TOP_Y, rot: ID, rotY: 0 },
        { id: 'a-bracket-r', kind: 'lbracket', hostId: 'a-turn-top', hostHole: 1, spin: 0 },
        { id: 'a-bracket-l', kind: 'lbracket', hostId: 'a-turn-top', hostHole: 2, spin: 0 },

        // A pair of brackets turn the horizontal turntable into a genuinely
        // vertical bolting face. The tower then shares two bolts with it, so
        // those pieces are one rigid body while each single-bolt arm joint is
        // left for Rapier to articulate.
        { id: 'a-tower-plate', kind: 'plate3x5', pos: [0, 0, 0.045], y: 1.815, rot: WALL, rotY: 0 },
        { id: 'a-tower', kind: 'strip11', pos: [0, 0, 0.135], y: 3.815, rot: VERTICAL, rotY: 0 },
        { id: 'a-boom', kind: 'strip15', pos: [3.5, 0, 0.225], y: 6.315, rot: WALL, rotY: 0 },
        { id: 'a-forearm', kind: 'strip11', pos: [7, 0, 0.315], y: 8.815, rot: VERTICAL, rotY: 0 },
        { id: 'a-palm', kind: 'gripperPalm', pos: [7, 0, 0.405], y: 11.315, rot: WALL, rotY: 0 },
        { id: 'a-jaw-l', kind: 'gripperJawL', pos: [6, 0, 0.495], y: 11.065, rot: DOWN, rotY: Math.PI },
        { id: 'a-jaw-r', kind: 'gripperJawR', pos: [8, 0, 0.495], y: 11.065, rot: DOWN, rotY: Math.PI },

        // Each motor is bolted to the fixed side of its joint. A separate horn
        // snaps onto its output spline and the moving beam bolts to that horn:
        // motor -> shaft -> horn -> beam, with no invisible proximity link.
        { id: 'a-servo-base', kind: 'servo', hostId: 'a-turn-base', hostHole: 0, spin: 0 },
        { id: 'a-servo-shoulder', kind: 'servo', hostId: 'a-tower', hostHole: 10, spin: 0 },
        { id: 'a-servo-elbow', kind: 'servo', hostId: 'a-boom', hostHole: 14, spin: 0 },
        { id: 'a-servo-wrist', kind: 'servo', hostId: 'a-forearm', hostHole: 10, spin: 0 },
        { id: 'a-servo-grip-l', kind: 'servo', hostId: 'a-palm', hostHole: 0, spin: 0 },
        { id: 'a-servo-grip-r', kind: 'servo', hostId: 'a-palm', hostHole: 4, spin: 0 },
        { id: 'a-horn-base', kind: 'servoHorn', hostId: 'a-servo-base', hostHole: 0, spin: 0 },
        { id: 'a-horn-shoulder', kind: 'servoHorn', hostId: 'a-servo-shoulder', hostHole: 0, spin: 0 },
        { id: 'a-horn-elbow', kind: 'servoHorn', hostId: 'a-servo-elbow', hostHole: 0, spin: 0 },
        { id: 'a-horn-wrist', kind: 'servoHorn', hostId: 'a-servo-wrist', hostHole: 0, spin: 0 },
        { id: 'a-horn-grip-l', kind: 'servoHorn', hostId: 'a-servo-grip-l', hostHole: 0, spin: 0 },
        { id: 'a-horn-grip-r', kind: 'servoHorn', hostId: 'a-servo-grip-r', hostHole: 0, spin: 0 },

        // Controls sit on their own perforated tray. The full-size breadboard
        // distributes one 5 V and one GND lead to all six servos.
        { id: 'a-controls', kind: 'deck', pos: [-4.5, 0, 0], y: RAIL_Y, rot: ID, rotY: 0 },
        { id: 'a-board', kind: 'board', pos: [-4.5, 0, 0], y: RAIL_Y + STRIP_T / 2 + BOARD.thickness / 2, rot: ID, rotY: 0 },
        { id: 'a-breadboard', kind: 'breadboard', pos: [-4.5, 0, -2.4], y: BREADBOARD.height / 2, rot: ID, rotY: 0 },
        { id: 'a-led-resistor', kind: 'resistor', breadboardId: 'a-breadboard', holes: { '1': 't:A:15', '2': 't:A:20' } },
        { id: 'a-status-led', kind: 'ledGreen', breadboardId: 'a-breadboard', holes: { A: 't:E:20', K: 't:E:22' } },
      ],
      bolts: [
        { id: 'ab-base-r', aId: 'a-turn-base', aHole: 1, bId: 'a-base', bHole: 8 },
        { id: 'ab-base-l', aId: 'a-turn-base', aHole: 2, bId: 'a-base', bHole: 6 },
        { id: 'ab-turn', aId: 'a-turn-top', aHole: 0, bId: 'a-horn-base', bHole: 0 },
        { id: 'ab-bracket-r', aId: 'a-tower-plate', aHole: 14, bId: 'a-bracket-r', bHole: 0 },
        { id: 'ab-bracket-l', aId: 'a-tower-plate', aHole: 10, bId: 'a-bracket-l', bHole: 0 },
        { id: 'ab-tower-1', aId: 'a-tower', aHole: 0, bId: 'a-tower-plate', bHole: 12 },
        { id: 'ab-tower-2', aId: 'a-tower', aHole: 1, bId: 'a-tower-plate', bHole: 7 },
        { id: 'ab-shoulder', aId: 'a-boom', aHole: 0, bId: 'a-horn-shoulder', bHole: 0 },
        { id: 'ab-elbow', aId: 'a-forearm', aHole: 0, bId: 'a-horn-elbow', bHole: 0 },
        { id: 'ab-wrist', aId: 'a-palm', aHole: 2, bId: 'a-horn-wrist', bHole: 0 },
        { id: 'ab-jaw-l', aId: 'a-jaw-l', aHole: 0, bId: 'a-horn-grip-l', bHole: 0 },
        { id: 'ab-jaw-r', aId: 'a-jaw-r', aHole: 0, bId: 'a-horn-grip-r', bHole: 0 },
        { id: 'ab-board-0', aId: 'a-board', aHole: 0, bId: 'a-controls', bHole: 0 },
        { id: 'ab-board-1', aId: 'a-board', aHole: 1, bId: 'a-controls', bHole: 4 },
        { id: 'ab-board-2', aId: 'a-board', aHole: 2, bId: 'a-controls', bHole: 10 },
        { id: 'ab-board-3', aId: 'a-board', aHole: 3, bId: 'a-controls', bHole: 14 },
      ],
      wires: [
        { id: 'aw-rail-5v', a: { partId: 'a-board', terminal: '5V' }, b: { partId: 'a-breadboard', terminal: 'r:top:+:1' }, colour: WIRE_COLOUR.vcc },
        { id: 'aw-rail-gnd', a: { partId: 'a-board', terminal: 'GND1' }, b: { partId: 'a-breadboard', terminal: 'r:top:-:1' }, colour: WIRE_COLOUR.gnd },
        ...[
          ['base', 'a-servo-base', 3, 2],
          ['shoulder', 'a-servo-shoulder', 5, 3],
          ['elbow', 'a-servo-elbow', 6, 4],
          ['wrist', 'a-servo-wrist', 9, 5],
          ['grip-l', 'a-servo-grip-l', 10, 6],
          ['grip-r', 'a-servo-grip-r', 11, 7],
        ].flatMap(([name, partId, pin, rail]) => [
          { id: `aw-${name}-vcc`, a: { partId, terminal: 'VCC' }, b: { partId: 'a-breadboard', terminal: `r:top:+:${rail}` }, colour: WIRE_COLOUR.vcc },
          { id: `aw-${name}-gnd`, a: { partId, terminal: 'GND' }, b: { partId: 'a-breadboard', terminal: `r:top:-:${rail}` }, colour: WIRE_COLOUR.gnd },
          { id: `aw-${name}-sig`, a: { partId, terminal: 'SIG' }, b: { partId: 'a-board', terminal: `D${pin}` }, colour: WIRE_COLOUR.sensor },
        ]),
        { id: 'aw-led-pin', a: { partId: 'a-board', terminal: 'D13' }, b: { partId: 'a-breadboard', terminal: 't:B:15' }, colour: WIRE_COLOUR.led },
        { id: 'aw-led-gnd', a: { partId: 'a-board', terminal: 'GND2' }, b: { partId: 'a-breadboard', terminal: 't:D:22' }, colour: WIRE_COLOUR.gnd },
      ],
      program: [
        { id: 'ap-settle', type: 'wait', ms: 1200 },
        { id: 'ap-led-on', type: 'digitalWrite', pin: 13, value: 'HIGH' },
        { id: 'ap-base', type: 'servo', pin: 3, angle: 90 },
        { id: 'ap-shoulder', type: 'servo', pin: 5, angle: 35 },
        { id: 'ap-elbow', type: 'servo', pin: 6, angle: 135 },
        { id: 'ap-wrist', type: 'servo', pin: 9, angle: 75 },
        { id: 'ap-open-l', type: 'servo', pin: 10, angle: 35 },
        { id: 'ap-open-r', type: 'servo', pin: 11, angle: 145 },
        { id: 'ap-pause-open', type: 'wait', ms: 1000 },
        { id: 'ap-close-l', type: 'servo', pin: 10, angle: 105 },
        { id: 'ap-close-r', type: 'servo', pin: 11, angle: 75 },
        { id: 'ap-pause-close', type: 'wait', ms: 700 },
        { id: 'ap-led-off', type: 'digitalWrite', pin: 13, value: 'LOW' },
      ],
    },
  },
]

// A line-following starter must include a real downward sensor and its wiring;
// otherwise the line map would be a drawing exercise rather than robotics.
const roverForLine = TEMPLATES.find((template) => template.id === 'rover')
TEMPLATES.splice(1, 0, {
  id: 'breadboardLed',
  name: 'Breadboard LED lab',
  blurb: 'A full-size breadboard with a protected LED circuit ready to inspect.',
  icon: '⚡',
  json: {
    format: 'arduinium-build',
    version: 4,
    name: 'Breadboard LED lab',
    parts: [
      { id: 'bl-board', kind: 'board', pos: [-4, 0, 0], y: BOARD.thickness / 2, rot: ID, rotY: 0 },
      { id: 'bl-breadboard', kind: 'breadboard', pos: [2, 0, 0], y: BREADBOARD.height / 2, rot: ID, rotY: 0 },
      { id: 'bl-resistor', kind: 'resistor', breadboardId: 'bl-breadboard', holes: { '1': 't:A:15', '2': 't:A:20' } },
      { id: 'bl-led', kind: 'ledGreen', breadboardId: 'bl-breadboard', holes: { A: 't:E:20', K: 't:E:22' } },
    ],
    bolts: [],
    wires: [
      { id: 'bl-pin', a: { partId: 'bl-board', terminal: 'D13' }, b: { partId: 'bl-breadboard', terminal: 't:B:15' }, colour: WIRE_COLOUR.led },
      { id: 'bl-gnd', a: { partId: 'bl-board', terminal: 'GND1' }, b: { partId: 'bl-breadboard', terminal: 't:D:22' }, colour: WIRE_COLOUR.gnd },
    ],
    program: [
      // The runtime already has a one-second universal settle window.  A
      // bench-only circuit has no mechanism to settle, so keep the authored
      // pause short and let the learner see the proof almost immediately.
      { id: 'bl-wait', type: 'wait', ms: 150 },
      { id: 'bl-on', type: 'digitalWrite', pin: 13, value: 'HIGH' },
      { id: 'bl-hold', type: 'wait', ms: 1800 },
    ],
  },
})
if (roverForLine) {
  const json = structuredClone(roverForLine.json)
  json.name = 'Line-follower rover'
  // The original rover's centre-front socket carries its ultrasonic module.
  // A line robot needs that exact centred socket for the downward probe, so
  // replace the module rather than stacking two fittings or stealing a frame
  // hole already occupied by a structural bolt.
  json.parts = json.parts.filter((part) => part.id !== 'r-sensor')
  json.wires = json.wires.filter((wire) => !['rw-vcc', 'rw-gnd', 'rw-trig', 'rw-echo'].includes(wire.id))
  json.parts.push({ id: 'r-line', kind: 'lineSensor', hostId: 'r-rear', hostHole: 3, spin: 0 })
  json.wires.push(
    { id: 'rw-line-vcc', a: { partId: 'r-line', terminal: 'VCC' }, b: { partId: 'r-board', terminal: '5V' }, colour: WIRE_COLOUR.vcc },
    { id: 'rw-line-gnd', a: { partId: 'r-line', terminal: 'GND' }, b: { partId: 'r-board', terminal: 'GND3' }, colour: WIRE_COLOUR.gnd },
    { id: 'rw-line-out', a: { partId: 'r-line', terminal: 'OUT' }, b: { partId: 'r-board', terminal: 'A0' }, colour: WIRE_COLOUR.sensor },
  )
  json.program = [
    { id: 'lf-settle', type: 'wait', ms: 1200 },
    {
      id: 'lf-loop', type: 'forever', body: [
        {
          id: 'lf-read', type: 'ifCompare', a: { src: 'sensor', pin: 14 }, op: '>', b: { src: 'num', value: 50 },
          body: [{ id: 'lf-forward', type: 'drive', dir: 'forward', speed: 135, ms: 90 }],
          elseBody: [{ id: 'lf-search', type: 'drive', dir: 'left', speed: 105, ms: 65 }],
        },
      ],
    },
  ]
  TEMPLATES.splice(3, 0, { id: 'lineRover', name: 'Line-follower rover', blurb: 'A wired downward sensor and a starter threshold-control loop.', icon: '⌁', json })
}

export const getTemplate = (id) => TEMPLATES.find((t) => t.id === id)
