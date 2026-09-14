import assert from 'node:assert/strict'
import {
  breadboardGroup,
  breadboardHoles,
  terminalHoleId,
  railHoleId,
  footprintAt,
  breadboardHole,
} from '../src/lib/breadboard.js'
import { buildElectricalNets } from '../src/lib/netlist.js'
import { ledConnection } from '../src/lib/circuits.js'
import { BREADBOARD } from '../src/lib/config.js'
import { useBuildStore } from '../src/store/useBuildStore.js'
import { solveCircuit } from '../src/lib/electricalSolver.js'

let passed = 0
const check = (name, fn) => {
  fn()
  passed++
  console.log(`✓ ${name}`)
}

check('full-size board exposes exactly 830 contacts', () => {
  assert.equal(breadboardHoles().length, 830)
  assert.equal(new Set(breadboardHoles().map((hole) => hole.id)).size, 830)
})

check('A-E share one five-hole terminal strip', () => {
  assert.equal(breadboardGroup(terminalHoleId('A', 12)), breadboardGroup(terminalHoleId('E', 12)))
})

check('the DIP trench separates E from F', () => {
  assert.notEqual(breadboardGroup(terminalHoleId('E', 12)), breadboardGroup(terminalHoleId('F', 12)))
})

check('numbered rows do not leak into neighbours', () => {
  assert.notEqual(breadboardGroup(terminalHoleId('A', 12)), breadboardGroup(terminalHoleId('A', 13)))
})

check('each power rail has an electrical centre break', () => {
  assert.notEqual(breadboardGroup(railHoleId('top', '+', 25)), breadboardGroup(railHoleId('top', '+', 26)))
  assert.notEqual(breadboardGroup(railHoleId('bottom', '-', 25)), breadboardGroup(railHoleId('bottom', '-', 26)))
})

const parts = {
  uno: { id: 'uno', kind: 'board' },
  bb: { id: 'bb', kind: 'breadboard' },
  r1: { id: 'r1', kind: 'resistor' },
  led: { id: 'led', kind: 'ledRed' },
}
const wires = [
  ['uno', 'D9', 'bb', 't:A:1'],
  ['r1', '1', 'bb', 't:B:1'],
  ['r1', '2', 'bb', 't:A:2'],
  ['led', 'A', 'bb', 't:B:2'],
  ['led', 'K', 'bb', 't:A:3'],
  ['uno', 'GND1', 'bb', 't:B:3'],
].map(([aId, aTerminal, bId, bTerminal], index) => ({
  id: `w${index}`,
  a: { partId: aId, terminal: aTerminal },
  b: { partId: bId, terminal: bTerminal },
}))

check('net graph carries a signal across equivalent row holes', () => {
  const graph = buildElectricalNets(parts, wires)
  assert.equal(graph.same(
    { partId: 'uno', terminal: 'D9' },
    { partId: 'bb', terminal: 't:E:1' },
  ), true)
})

check('LED circuit resolves through breadboard + series resistor', () => {
  assert.deepEqual(ledConnection(parts.led, parts, wires), {
    ready: true,
    pins: { A: 9 },
    boardId: 'uno',
    missing: [],
  })
})

check('one inserted lead occupies one stable physical hole', () => {
  assert.deepEqual(footprintAt('ledRed', 't:C:20'), { A: 't:C:20', K: 't:C:22' })
  assert.equal(footprintAt('resistor', 't:C:60'), null)
})

check('inserted component footprints join their holes without fake wires', () => {
  const inserted = {
    uno: parts.uno,
    bb: parts.bb,
    r1: { ...parts.r1, breadboardId: 'bb', holes: { '1': 't:B:1', '2': 't:A:2' } },
    led: { ...parts.led, breadboardId: 'bb', holes: { A: 't:B:2', K: 't:A:3' } },
  }
  const jumpers = [
    { id: 'signal', a: { partId: 'uno', terminal: 'D9' }, b: { partId: 'bb', terminal: 't:A:1' } },
    { id: 'ground', a: { partId: 'uno', terminal: 'GND1' }, b: { partId: 'bb', terminal: 't:B:3' } },
  ]
  assert.equal(ledConnection(inserted.led, inserted, jumpers).ready, true)
  assert.equal(ledConnection(inserted.led, inserted, jumpers).pins.A, 9)
})

check('store inserts a carried component and save v4 round-trips its footprint', () => {
  const board = { id: 'bb-store', kind: 'breadboard', pos: [0, 0, 0], y: BREADBOARD.height / 2, rot: 0, rotY: 0 }
  useBuildStore.setState({ parts: { [board.id]: board }, order: [board.id], bolts: [], wires: [], pending: null, running: false, past: [], future: [] })
  useBuildStore.getState().beginPlace('resistor')
  assert.equal(useBuildStore.getState().pending.placement, 'breadboard')
  const anchor = breadboardHole('t:C:20').local
  useBuildStore.getState().movePending([anchor[0], 0, anchor[2]])
  useBuildStore.getState().commitPlace()
  const resistor = Object.values(useBuildStore.getState().parts).find((part) => part.kind === 'resistor')
  assert.equal(resistor.breadboardId, board.id)
  assert.equal(Object.keys(resistor.holes).length, 2)
  const saved = useBuildStore.getState().exportBuildToJSON()
  assert.equal(saved.version, 4)
  assert.equal(useBuildStore.getState().loadBuildFromJSON(saved), true)
  const loaded = useBuildStore.getState().parts[resistor.id]
  assert.deepEqual(loaded.holes, resistor.holes)
})

check('solver detects a 5 V to GND short hidden inside one terminal strip', () => {
  const circuitParts = { uno: parts.uno, bb: parts.bb }
  const shorted = [
    { a: { partId: 'uno', terminal: '5V' }, b: { partId: 'bb', terminal: 't:A:10' } },
    { a: { partId: 'uno', terminal: 'GND1' }, b: { partId: 'bb', terminal: 't:E:10' } },
  ]
  assert.equal(solveCircuit(circuitParts, shorted).issues.some((issue) => issue.code === 'POWER_SHORT'), true)
})

check('split rail halves may carry different voltages safely', () => {
  const circuitParts = { uno: parts.uno, bb: parts.bb }
  const separated = [
    { a: { partId: 'uno', terminal: '5V' }, b: { partId: 'bb', terminal: 'r:top:+:25' } },
    { a: { partId: 'uno', terminal: 'GND1' }, b: { partId: 'bb', terminal: 'r:top:+:26' } },
  ]
  assert.equal(solveCircuit(circuitParts, separated).issues.some((issue) => issue.code === 'POWER_SHORT'), false)
})

check('solver catches a breadboard LED that bypasses its resistor', () => {
  const circuitParts = {
    uno: parts.uno,
    bb: parts.bb,
    led: { ...parts.led, breadboardId: 'bb', holes: { A: 't:B:5', K: 't:A:6' } },
  }
  const unsafe = [
    { a: { partId: 'uno', terminal: 'D9' }, b: { partId: 'bb', terminal: 't:A:5' } },
    { a: { partId: 'uno', terminal: 'GND1' }, b: { partId: 'bb', terminal: 't:B:6' } },
  ]
  assert.equal(solveCircuit(circuitParts, unsafe).issues.some((issue) => issue.code === 'LED_NEEDS_RESISTOR'), true)
})

console.log(`${passed}/${passed} breadboard checks passed`)
