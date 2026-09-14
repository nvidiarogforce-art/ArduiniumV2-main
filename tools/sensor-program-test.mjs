import assert from 'node:assert/strict'
import { makeBlock, makeRunner, toArduinoCode } from '../src/lib/program.js'
import { parseArduino } from '../src/lib/arduinoParser.js'

let passed = 0
const check = (name, fn) => { fn(); passed++; console.log('PASS', name) }
const clean = (value) => JSON.parse(JSON.stringify(value, (key, val) => key === 'id' ? undefined : val))
const sample = { ...makeBlock('setVar'), name: 'reading', a: { src: 'sensor', pin: 14 }, op: '' }
const condition = { ...makeBlock('ifCompare'), a: { src: 'sensor', pin: 14 }, op: '>', b: { src: 'num', value: 50 }, body: [{ ...makeBlock('digitalWrite'), pin: 13, value: 'HIGH' }], elseBody: [] }
const program = [{ ...makeBlock('repeat'), times: 2, body: [sample, condition] }]
check('Sensor operands survive nested blocks → C++ → blocks', () => {
  const parsed = parseArduino(toArduinoCode(program, {}))
  assert.equal(parsed.error, undefined)
  assert.deepEqual(clean(parsed.blocks), clean(program))
})
check('Sensor inputs and LED outputs receive distinct pin modes', () => {
  const code = toArduinoCode(program, {})
  assert.match(code, /pinMode\(14, INPUT\)/)
  assert.match(code, /pinMode\(13, OUTPUT\)/)
})
check('Interpreter branches on live sensor readings each iteration', () => {
  const writes = []; let reads = 0
  const runner = makeRunner(program, { sensor: (pin) => { assert.equal(pin, 14); return ++reads <= 2 ? 70 : 20 }, digitalWrite: (...args) => writes.push(args) })
  for (let n = 0; n < 100 && !runner.next().done; n++) {}
  assert.equal(reads, 4)
  assert.deepEqual(writes, [[13, 'HIGH']])
})
check('Disconnected sensor errors propagate instead of inventing a reading', () => {
  const runner = makeRunner([sample], { sensor: () => { throw new Error('missing GND') } })
  assert.throws(() => runner.next(), /missing GND/)
})
check('Fractional sensor assignment matches generated integer variable', () => {
  const writes = []
  const compare = { ...condition, a: { src: 'var', name: 'reading' }, op: '==', b: { src: 'num', value: 22 } }
  const runner = makeRunner([sample, compare], { sensor: () => 22.9, digitalWrite: (...args) => writes.push(args) })
  for (let n = 0; n < 100 && !runner.next().done; n++) {}
  assert.deepEqual(writes, [[13, 'HIGH']])
})
check('Invalid sensor pin is a useful parse error', () => {
  for (const pin of [-1, 20, 3.5]) assert.ok(parseArduino(`void loop() { reading = readSensor(${pin}); }`).error)
})
check('Truncated function signature terminates with a parse error', () => {
  assert.ok(parseArduino('void loop(').error)
})
check('Quotes, slashes and newlines survive print round trip', () => {
  const blocks = [{ ...makeBlock('print'), text: 'C:\\robot\\new\nSay "salom"\tOK' }]
  assert.deepEqual(clean(parseArduino(toArduinoCode(blocks, {})).blocks), clean(blocks))
})
check('Unclosed string is rejected', () => {
  assert.ok(parseArduino('void loop() { Serial.println("unfinished').error)
})
check('Distance equality operators use the same comparison semantics as code', () => {
  for (const op of ['<=', '>=', '==']) {
    const writes = []
    const runner = makeRunner([{ ...makeBlock('ifDistance'), op, cm: 20, body: [{ ...makeBlock('digitalWrite'), pin: 13, value: 'HIGH' }] }], { distance: () => 20, digitalWrite: (...args) => writes.push(args) })
    for (let n = 0; n < 10 && !runner.next().done; n++) {}
    assert.deepEqual(writes, [[13, 'HIGH']])
  }
})
console.log(`${passed}/${passed} PASS`)
