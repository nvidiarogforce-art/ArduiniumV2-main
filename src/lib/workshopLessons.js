import { SENSOR_KINDS as ALL_SENSOR_KINDS, SENSOR_SPECS } from './sensors.js';
import { isLed } from './electronics.js';
import { ledConnection, motorConnection } from './circuits.js';

/**
 * Academy curriculum and pure evidence checks. No store writes or scene resets.
 * The UI supplies semantic connections from sensors.js; this module never
 * substitutes a pin-map entry for a powered, correctly wired sensor.
 */
export const SENSOR_KINDS = ALL_SENSOR_KINDS;
const DEFAULT_TERMINAL = { lineSensor: 'A0', lightSensor: 'A1', temperatureSensor: 'A2', touchSensor: 'D2', tiltSensor: 'D3', encoderSensor: 'D4', photoTransistor: 'A1', tmp36: 'A2', tiltSwitch: 'D3', potentiometer: 'A3', pushButton: 'D2' };
export const WIRING_PLANS = Object.fromEntries(SENSOR_KINDS.map(kind => [kind, [
  ...(SENSOR_SPECS[kind].supply.length ? [{ from: 'VCC', to: '5V', colour: '#c94735', why: 'powerRoute' }] : []),
  { from: SENSOR_SPECS[kind].ground ?? 'GND', to: 'GND1', colour: '#354451', why: 'groundRoute' },
  ...(kind === 'sensor' ? [
    { from: 'TRIG', to: 'D6', colour: '#ad710e', why: 'trigRoute' },
    { from: 'ECHO', to: 'D7', colour: '#247b74', why: 'echoRoute' },
  ] : [{ from: SENSOR_SPECS[kind].output, to: DEFAULT_TERMINAL[kind], colour: '#247b74', why: 'outRoute' }]),
]]));
export const WORKSHOP_LESSONS = [
  { id: 'basics', art: 'strip7', steps: ['frame', 'bolts', 'xyz'], actions: ['strip7', 'strip5', 'focus'] },
  { id: 'led', art: 'led', starter: 'led', steps: ['ledSeat', 'blinkCode', 'blinkRun'], actions: ['led', 'program', 'program'] },
  { id: 'rover', art: 'wheel', starter: 'rover', steps: ['drivetrain', 'driveCode', 'driveRun'], actions: ['motormount', 'program', 'program'] },
  { id: 'ultrasonic', art: 'sensor', starter: 'rover', steps: ['sonarWire', 'sonarCode', 'sonarRun'], actions: ['wiring', 'program', 'program'] },
  { id: 'line', art: 'lineSensor', starter: 'rover', steps: ['lineWire', 'lineCode', 'lineRun'], actions: ['lineSensor', 'program', 'program'] },
];
export const PROGRESS_KEY = 'arduinium.workshop-guide.v1';
export function cleanProgress(raw) {
  const completed = {};
  for (const lesson of WORKSHOP_LESSONS) {
    // Only a contiguous prefix is legitimate: no jumping over ungraded steps.
    const saved = Array.isArray(raw?.completed?.[lesson.id]) ? raw.completed[lesson.id] : [];
    const prefix = [];
    for (const step of lesson.steps) {
      if (!saved.includes(step)) break;
      prefix.push(step);
    }
    completed[lesson.id] = prefix;
  }
  const active = WORKSHOP_LESSONS.some(l => l.id === raw?.active) ? raw.active : null;
  return { version: 1, active, completed };
}
const values = b => Object.values(b.parts ?? {});
const strips = b => values(b).filter(p => /^strip(5|7|11)$/.test(p.kind));
const board = b => values(b).find(p => p.kind === 'board');
const pinEntries = b => typeof b.pinMap === 'function' ? b.pinMap() : (b.pinMap ?? {});
export const ledOn13 = b => {
  const uno = board(b);
  if (!uno) return false;
  return values(b).some(p => isLed(p.kind) && p.hostId && b.parts?.[p.hostId]
    && ledConnection(p, b.parts, b.wires).ready
    && Object.values(ledConnection(p, b.parts, b.wires).pins).includes(13)
    && pinEntries(b)[13]?.id === p.id);
};
const wait = (block, min, max = Infinity) => block?.type === 'wait' && Number(block.ms) >= min && Number(block.ms) <= max;
const write = (block, value) => block?.type === 'digitalWrite' && Number(block.pin) === 13 && block.value === value;
const withoutPrint = blocks => (blocks ?? []).filter(b => b.type !== 'print');
function finalLoop(program) {
  const blocks = withoutPrint(program);
  if (!blocks.length || blocks.at(-1).type !== 'forever') return null;
  // A matching block in an unreachable branch or after another forever is not code completion.
  if (!blocks.slice(0, -1).every(b => wait(b, 0, 60000))) return null;
  return blocks.at(-1);
}
export function blinkProgram(program) {
  const loop = finalLoop(program), body = loop?.body ?? [];
  return body.length === 4 && write(body[0], 'HIGH') && wait(body[1], 500, 500)
    && write(body[2], 'LOW') && wait(body[3], 500, 500);
}
export function driveProgram(program) {
  const blocks = withoutPrint(program);
  const drive = wait(blocks[0], 0, 60000) ? blocks[1] : blocks[0];
  return drive?.type === 'drive' && drive.dir === 'forward' && Number(drive.speed) === 140
    && Number(drive.ms) >= 1500 && Number(drive.ms) <= 60000;
}
export function sonarProgram(program) {
  const loop = finalLoop(program), body = loop?.body ?? [], test = body[0];
  return body.length === 2 && test?.type === 'ifDistance' && test.op === '<'
    && Number(test.cm) === 20 && test.body?.length === 1 && write(test.body[0], 'HIGH')
    && test.elseBody?.length === 1 && write(test.elseBody[0], 'LOW') && wait(body[1], 100, 100);
}
export function lineCondition(program) {
  const blocks = withoutPrint(program), loop = finalLoop(program), test = loop?.body?.[0];
  const move = (b, dir) => b?.type === 'drive' && b.dir === dir && Number(b.speed) > 0
    && Number(b.speed) <= 255 && Number(b.ms) >= 100 && Number(b.ms) <= 400;
  if (!([loop].includes(blocks[0]) || (wait(blocks[0], 0, 60000) && blocks[1] === loop)) || loop?.body?.length !== 1
    || test?.type !== 'ifCompare' || test.a?.src !== 'sensor' || Number(test.a.pin) !== 14
    || test.b?.src !== 'num' || !(Number(test.b.value) > 0 && Number(test.b.value) < 100)
    || test.op !== '<' || test.body?.length !== 1 || test.elseBody?.length !== 1
    || !move(test.body[0], 'left') || !move(test.elseBody[0], 'right')) return null;
  return test;
}
export function driveChains(b) {
  const parts = b.parts ?? {};
  return values(b).filter(p => {
    const motor = parts[p.hostId], mount = parts[motor?.hostId], host = parts[mount?.hostId];
    return p.kind === 'wheel' && motor?.kind === 'motor' && mount?.kind === 'motormount'
      && !!host && motorConnection(motor, parts, b.wires).ready;
  });
}
export function drivetrainReady(b) {
  const chains = driveChains(b);
  const pins = new Set(chains.flatMap(p => {
    const connection = motorConnection(b.parts[p.hostId], b.parts, b.wires);
    return [connection.pin, connection.reversePin];
  }));
  return !!board(b) && chains.length >= 2 && pins.size >= 2
    && values(b).some(p => p.kind === 'caster' && b.parts[p.hostId]);
}
function wireTo(b, partId, from, boardId, to) {
  return (b.wires ?? []).some(w => [[w.a, w.b], [w.b, w.a]].some(([a, z]) =>
    a?.partId === partId && a.terminal === from && z?.partId === boardId && z.terminal === to));
}
/** Exact lesson plan AND sensorConnection semantic readiness (same board, supplies, free signal). */
export function plannedSensor(b, context, kind) {
  return values(b).find(p => p.kind === kind && p.hostId && b.parts[p.hostId]
    && context.connections?.[p.id]?.ready === true
    && values(b).some(uno => uno.kind === 'board'
      && WIRING_PLANS[kind].every(w => wireTo(b, p.id, w.from, uno.id, w.to))));
}
function rigidStripPair(b) {
  const ids = new Set(strips(b).map(p => p.id)), pairs = new Map();
  for (const bolt of b.bolts ?? []) {
    if (bolt.aId === bolt.bId || !ids.has(bolt.aId) || !ids.has(bolt.bId)) continue;
    const forward = bolt.aId < bolt.bId, key = [bolt.aId, bolt.bId].sort().join('|');
    const holes = forward ? [bolt.aHole, bolt.bHole] : [bolt.bHole, bolt.aHole];
    const seen = pairs.get(key) ?? [];
    // Duplicate bolts through one hole cannot fake a rigid joint.
    if (!seen.some(h => h[0] === holes[0] || h[1] === holes[1])) seen.push(holes);
    pairs.set(key, seen);
  }
  return [...pairs.values()].some(holes => holes.length >= 2);
}
const position = p => [p.pos?.[0] ?? 0, p.y ?? p.pos?.[1] ?? 0, p.pos?.[2] ?? 0];
export function createEvidence(b) {
  return { wasRunning: !!b.running, previousParts: b.parts, axes: {}, run: null };
}
function sameRunBuild(run, b) {
  return run && run.parts === b.parts && run.wires === b.wires && run.program === b.program && run.bolts === b.bolts;
}
/**
 * Called on store changes AND a modest timer (runtime is intentionally mutable).
 * Evidence is session-only and never persisted. A new step needs a fresh Run.
 */
export function observeWorkshop(e, b, runtime, context = {}) {
  for (const part of strips(b)) {
    const prev = e.previousParts?.[part.id];
    if (!prev || b.running || prev === part) continue;
    const a = position(prev), z = position(part), axes = e.axes[part.id] ?? [false, false, false];
    e.axes[part.id] = axes.map((done, i) => done || Math.abs(a[i] - z[i]) > 0.0001);
  }
  e.previousParts = b.parts;
  if (b.running && !e.wasRunning) e.run = {
    parts: b.parts, wires: b.wires, bolts: b.bolts, program: b.program,
    origin: null, ledHigh: false, blink: false, travelled: false, sonar: false, lineValues: [],
  };
  e.wasRunning = !!b.running;
  if (e.run && !sameRunBuild(e.run, b)) e.run = null;
  const run = e.run;
  if (!run || !b.running || !(runtime.clock > 700)) return e;
  if (ledOn13(b) && blinkProgram(b.program)) {
    if (runtime.pinHigh?.[13] === true) run.ledHigh = true;
    if (run.ledHigh && runtime.pinHigh?.[13] === false) run.blink = true;
  }
  const chains = driveChains(b);
  const moving = chains.filter(p => {
    const t = runtime.wheelTelemetry?.[p.id];
    return t && Math.abs(t.commanded) > 0 && Math.abs(t.actual) > 0.02;
  }).length >= 2;
  if (drivetrainReady(b) && moving && runtime.robotPos?.every(Number.isFinite)) {
    run.origin ??= [...runtime.robotPos];
    if (driveProgram(b.program) && runtime.driveCommand?.dir === 'forward'
      && Math.hypot(runtime.robotPos[0] - run.origin[0], runtime.robotPos[2] - run.origin[2]) >= 0.25)
      run.travelled = true;
  }
  const sonar = plannedSensor(b, context, 'sensor'), reading = runtime.sensorReadings?.[sonar?.id];
  if (sonar && ledOn13(b) && sonarProgram(b.program) && reading?.ready === true
    && reading.kind === 'sensor' && Number.isFinite(reading.value) && reading.value >= 0
    && reading.pin === context.connections[sonar.id].pin
    && Object.hasOwn(runtime.pinHigh ?? {}, 13) && runtime.pinHigh[13] === (reading.value < 20))
    run.sonar = true;
  const line = plannedSensor(b, context, 'lineSensor'), lineReading = runtime.sensorReadings?.[line?.id];
  const condition = lineCondition(b.program);
  if (context.mission === 'followLine' && line && condition && drivetrainReady(b) && moving
    && lineReading?.ready === true && lineReading.kind === 'lineSensor' && lineReading.pin === 14
    && Number.isFinite(lineReading.value)
    && runtime.driveCommand?.dir === (lineReading.value < Number(condition.b.value) ? 'left' : 'right')) {
    if (!run.lineValues.some(v => Math.abs(v - lineReading.value) < 1)) run.lineValues.push(lineReading.value);
    if (run.lineValues.length > 2) run.lineValues.shift();
  }
  return e;
}
export function lessonReady(step, b, context = {}, e = {}) {
  const run = sameRunBuild(e.run, b) ? e.run : null;
  switch (step) {
    case 'frame': return strips(b).length >= 2;
    case 'bolts': return rigidStripPair(b);
    case 'xyz': return strips(b).some(p => e.axes?.[p.id]?.every(Boolean));
    case 'ledSeat': return ledOn13(b);
    case 'blinkCode': return ledOn13(b) && blinkProgram(b.program);
    case 'blinkRun': return ledOn13(b) && blinkProgram(b.program) && !!run?.blink;
    case 'drivetrain': return drivetrainReady(b);
    case 'driveCode': return drivetrainReady(b) && driveProgram(b.program);
    case 'driveRun': return drivetrainReady(b) && driveProgram(b.program) && !!run?.travelled;
    case 'sonarWire': return ledOn13(b) && !!plannedSensor(b, context, 'sensor');
    case 'sonarCode': return ledOn13(b) && !!plannedSensor(b, context, 'sensor') && sonarProgram(b.program);
    case 'sonarRun': return ledOn13(b) && !!plannedSensor(b, context, 'sensor') && sonarProgram(b.program) && !!run?.sonar;
    case 'lineWire': return context.mission === 'followLine' && drivetrainReady(b) && !!plannedSensor(b, context, 'lineSensor');
    case 'lineCode': return lessonReady('lineWire', b, context, e) && !!lineCondition(b.program);
    case 'lineRun': return lessonReady('lineCode', b, context, e) && (run?.lineValues.length ?? 0) >= 2;
    default: return false;
  }
}

