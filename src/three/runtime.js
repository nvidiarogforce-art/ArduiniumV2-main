/**
 * A tiny mutable blackboard shared between the program runner and the meshes.
 *
 * Deliberately NOT React state: the LED's brightness and the motor's shaft
 * angle change every frame, and pushing that through `setState` would re-render
 * the whole scene 60 times a second. Everything here is read inside `useFrame`.
 */
export const rt = {
  /** pin -> true/false, written by digitalWrite */
  pinHigh: {},
  /** pin -> -255..255, written by the motor block */
  motorSpeed: {},
  /** pin -> 0..180°, written by the Servo angle block */
  servoAngle: {},
  /** standing order from a Drive block: { dir, speed } or null */
  driveCommand: null,
  /** momentary on-screen/WASD remote override; null hands control back to code */
  manualDrive: null,
  /**
   * pin -> true when a Motor block has spoken for that pin since the last
   * Drive block. The standing Drive order re-derives motorSpeed every frame,
   * which used to clobber a later `setMotor(pin, …)` on the very next frame —
   * a student mixing Drive and Motor blocks saw Motor do nothing while the
   * Serial Monitor claimed it worked.
   */
  motorOverride: {},
  /** latest ultrasonic reading in cm — measured by SensorRay.jsx's raycast */
  distance: 400,
  /** last cast: { origin, dir, hit, toi } — for the harnesses and debugging */
  sensorDebug: null,
  sensorReadings: {},
  environment: { light: 70, temperature: 22, potentiometer: 50, button: 0 },
  /** Last Serial.println payload mirrored to a correctly wired 16×2 LCD. */
  displayText: '',
  programClock: 0,
  /** wheelId -> { commanded, actual } for stall detection */
  wheelTelemetry: {},
  /** puff effects waiting to be spawned: [{ pos:[x,y,z], id }] */
  puffs: [],
  /** program clock in ms since Run was pressed */
  clock: 0,
  /** average world position of the driven wheels — proof the robot moved */
  robotPos: [0, 0, 0],
  /** live crate position, for the push mission */
  cratePos: null,
  /** true once the current mission's goal has been met */
  missionWon: false,
  /** seconds spent inside a ring mission's radial band */
  ringTime: 0,
  checkpointIndex: 0,
  liftTime: 0,
  /** wireId -> live endpoint telemetry, populated only while physics runs */
  wireDebug: {},
  /** hingeId -> actuator/target/angle telemetry for physics regression tests */
  jointDebug: {},
}

/** Public intent boundary used by keyboard/touch UI. */
export function setManualDrive(dir, speed) {
  rt.manualDrive = { dir, speed: Math.max(0, Math.min(255, Number(speed) || 0)) }
}

/** Release the override; brake only when no block program owns the wheels. */
export function clearManualDrive() {
  rt.manualDrive = null
  if (!rt.driveCommand) for (const pin of Object.keys(rt.motorSpeed)) rt.motorSpeed[pin] = 0
}

export function resetRuntime() {
  rt.pinHigh = {}
  rt.motorSpeed = {}
  rt.servoAngle = {}
  rt.driveCommand = null
  rt.manualDrive = null
  rt.motorOverride = {}
  rt.sensorDebug = null
  rt.sensorReadings = {}
  rt.displayText = ''
  rt.programClock = 0
  rt.distance = 400
  rt.wheelTelemetry = {}
  rt.puffs = []
  rt.clock = 0
  rt.robotPos = [0, 0, 0]
  rt.cratePos = null
  rt.missionWon = false
  rt.ringTime = 0
  rt.checkpointIndex = 0
  rt.liftTime = 0
  rt.wireDebug = {}
  rt.jointDebug = {}
}
