import assert from 'node:assert/strict'
import { COMPONENT_KINDS, COMPONENT_SPECS, LED_KINDS } from '../src/lib/electronics.js'
import { CATALOGUE } from '../src/lib/parts.js'
import { SENSOR_KINDS, SENSOR_SPECS, sampleSensor, sensorConnection } from '../src/lib/sensors.js'
import { ledConnection, lcdConnection, motorConnection, outputConnection } from '../src/lib/circuits.js'
import { getTemplate } from '../src/lib/templates.js'
import { allTerminals, canConnect, terminalsOf } from '../src/lib/terminals.js'

let passed = 0
const check = (name, fn) => { fn(); passed++; console.log('PASS', name) }
const wire = (id, aPart, aTerminal, bPart, bTerminal) => ({
  id,
  a: { partId: aPart, terminal: aTerminal },
  b: { partId: bPart, terminal: bTerminal },
})

check('Catalogue exposes every LED colour and every Starter Kit component', () => {
  const catalogue = new Set(Object.values(CATALOGUE).flat())
  for (const kind of LED_KINDS.filter((kind) => kind !== 'led')) assert.ok(catalogue.has(kind), kind)
  for (const kind of COMPONENT_KINDS) assert.ok(catalogue.has(kind), kind)
})

check('Every loose component has addressable electrical terminals', () => {
  for (const kind of COMPONENT_KINDS) {
    const part = { id: kind, kind }
    assert.deepEqual(terminalsOf(part).map((terminal) => terminal.id), COMPONENT_SPECS[kind].terminals.map((terminal) => terminal.id), kind)
  }
})

check('Every single-colour LED requires ground and a 220 ohm series resistor', () => {
  for (const kind of LED_KINDS.filter((value) => value !== 'rgbLed')) {
    const led = { id: 'led', kind }, resistor = { id: 'r', kind: 'resistor' }, board = { id: 'uno', kind: 'board' }
    const parts = { led, r: resistor, uno: board }
    assert.equal(ledConnection(led, parts, [wire('a', 'led', 'A', 'uno', 'D13'), wire('k', 'led', 'K', 'uno', 'GND1')]).ready, false, `${kind} direct`)
    const ready = ledConnection(led, parts, [
      wire('a', 'led', 'A', 'r', '1'), wire('p', 'r', '2', 'uno', 'D13'), wire('k', 'led', 'K', 'uno', 'GND1'),
    ])
    assert.equal(ready.ready, true, kind)
    assert.equal(ready.pins.A, 13, kind)
  }
})

check('Interactive wiring rejects a direct Uno-to-LED signal lead', () => {
  const parts = {
    uno: { id: 'uno', kind: 'board', pos: [0, 0, 0], y: 0.1 },
    led: { id: 'led', kind: 'ledRed', pos: [1, 0, 0], y: 0.1 },
  }
  const terminals = allTerminals(parts)
  const d13 = terminals.find((terminal) => terminal.partId === 'uno' && terminal.id === 'D13')
  const anode = terminals.find((terminal) => terminal.partId === 'led' && terminal.id === 'A')
  assert.equal(canConnect(d13, anode), false)
})

check('RGB LED uses three independent resistor-protected channels', () => {
  const rgb = { id: 'rgb', kind: 'rgbLed' }, board = { id: 'uno', kind: 'board' }
  const parts = { rgb, uno: board }
  const wires = [wire('k', 'rgb', 'K', 'uno', 'GND1')]
  for (const [channel, pin, id] of [['R', 'D9', 'rr'], ['G', 'D10', 'rg'], ['B', 'D11', 'rb']]) {
    parts[id] = { id, kind: 'resistor' }
    wires.push(wire(channel + 'a', 'rgb', channel, id, '1'), wire(channel + 'b', id, '2', 'uno', pin))
  }
  assert.deepEqual(ledConnection(rgb, parts, wires), { ready: true, pins: { R: 9, G: 10, B: 11 }, boardId: 'uno', missing: [] })
  assert.equal(ledConnection(rgb, parts, wires.filter((item) => item.id !== 'Gb')).ready, false)
})

check('A DC motor cannot run from one lead or direct Uno pins', () => {
  const motor = { id: 'm', kind: 'motor' }, board = { id: 'uno', kind: 'board' }
  const parts = { m: motor, uno: board }
  assert.equal(motorConnection(motor, parts, [wire('one', 'm', 'M+', 'uno', 'D9')]).ready, false)
  assert.equal(motorConnection(motor, parts, [wire('one', 'm', 'M+', 'uno', 'D9'), wire('two', 'm', 'M-', 'uno', 'D10')]).ready, false)
})

check('Both rover motors require a complete powered L293D channel', () => {
  const json = getTemplate('rover').json
  const parts = Object.fromEntries(json.parts.map((part) => [part.id, part]))
  for (const id of ['r-motorL', 'r-motorR']) assert.equal(motorConnection(parts[id], parts, json.wires).ready, true, id)
  assert.equal(motorConnection(parts['r-motorL'], parts, json.wires.filter((item) => item.id !== 'rw-ml-minus')).ready, false)
  assert.equal(motorConnection(parts['r-motorL'], parts, json.wires.filter((item) => item.id !== 'rw-driver-vcc')).ready, false)
  assert.equal(motorConnection(parts['r-motorL'], parts, json.wires.filter((item) => item.id !== 'rw-vmot')).ready, false)
})

check('Every sensor rejects incomplete power and reports its intended input pin', () => {
  for (const kind of SENSOR_KINDS) {
    const part = { id: 's', kind }, board = { id: 'uno', kind: 'board' }, wheel = { id: 'wheel', kind: 'wheel' }
    const parts = { s: part, uno: board, wheel }
    const spec = SENSOR_SPECS[kind]
    const wires = []
    if (spec.supply.length) wires.push(wire('v', 's', 'VCC', 'uno', '5V'))
    wires.push(wire('g', 's', spec.ground ?? 'GND', 'uno', 'GND1'))
    for (const signal of spec.signals) wires.push(wire(signal, 's', signal, 'uno', signal === spec.output ? 'A0' : 'D6'))
    assert.equal(sensorConnection(part, parts, wires).pin, 14, kind)
    assert.equal(sensorConnection(part, parts, wires).ready, true, kind)
    assert.equal(sensorConnection(part, parts, wires.filter((item) => item.id !== 'g')).ready, false, `${kind} without ground`)
  }
})

check('Simulated kit inputs respond to their physical quantity', () => {
  assert.equal(sampleSensor('photoTransistor', { environment: { light: 37 } }).value, 37)
  assert.equal(sampleSensor('tmp36', { environment: { temperature: 28.4 } }).value, 28.4)
  assert.equal(sampleSensor('potentiometer', { environment: { potentiometer: 81 } }).value, 81)
  assert.equal(sampleSensor('pushButton', { environment: { button: 1 } }).value, 1)
  assert.equal(sampleSensor('tiltSwitch', { up: { x: 1, y: 0, z: 0 } }).value, 1)
})

check('Servo, piezo and LCD stay off until every required lead is present', () => {
  const board = { id: 'uno', kind: 'board' }
  const servo = { id: 'servo', kind: 'servo' }, piezo = { id: 'piezo', kind: 'piezo' }, lcd = { id: 'lcd', kind: 'lcd' }
  const parts = { uno: board, servo, piezo, lcd }
  assert.equal(outputConnection(servo, parts, [wire('ss', 'servo', 'SIG', 'uno', 'D9')]).ready, false)
  assert.equal(outputConnection(piezo, parts, [wire('ps', 'piezo', '+', 'uno', 'D8')]).ready, false)
  const lcdWires = [wire('lv', 'lcd', 'VCC', 'uno', '5V'), wire('lg', 'lcd', 'GND', 'uno', 'GND1')]
  for (const [i, id] of ['RS', 'EN', 'D4', 'D5', 'D6', 'D7'].entries()) lcdWires.push(wire('l' + id, 'lcd', id, 'uno', `D${i + 2}`))
  assert.equal(lcdConnection(lcd, parts, lcdWires).ready, true)
  assert.equal(lcdConnection(lcd, parts, lcdWires.slice(0, -1)).ready, false)
})

console.log(`${passed}/${passed} PASS`)
