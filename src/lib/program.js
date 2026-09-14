/**
 * THE PROGRAM LAYER.
 *
 * Students build the program out of blocks. Two things then happen with it:
 *
 *  1. `toArduinoCode()` turns the blocks into the real Arduino C++ they would
 *     write on actual hardware, shown live next to the blocks. Blocks are the
 *     way in; the C++ is the thing they are learning to read.
 *
 *  2. `makeRunner()` executes the blocks directly with a small generator-based
 *     evaluator. It walks the block tree and yields once per step, so the
 *     scene advances one frame between steps. There is deliberately no
 *     `eval()` and no `new Function()` anywhere — student input never becomes
 *     executable JavaScript.
 */

let seq = 0
export const newId = (prefix = 'b') => `${prefix}${(++seq).toString(36)}${Math.floor(performance.now() % 9973).toString(36)}`

// ------------------------------------------------------------------ palette
export const BLOCK_TYPES = {
  drive: {
    colour: 'blue',
    icon: '🚗',
    make: () => ({ type: 'drive', dir: 'forward', speed: 200, ms: 1500 }),
  },
  digitalWrite: {
    colour: 'amber',
    icon: '💡',
    make: () => ({ type: 'digitalWrite', pin: 13, value: 'HIGH' }),
  },
  motor: {
    colour: 'blue',
    icon: '🌀',
    make: () => ({ type: 'motor', pin: 9, speed: 180 }),
  },
  servo: {
    colour: 'blue',
    icon: '↗️',
    make: () => ({ type: 'servo', pin: 9, angle: 90 }),
  },
  wait: {
    colour: 'slate',
    icon: '⏳',
    make: () => ({ type: 'wait', ms: 1000 }),
  },
  repeat: {
    colour: 'purple',
    icon: '🔁',
    make: () => ({ type: 'repeat', times: 4, body: [] }),
  },
  forever: {
    colour: 'purple',
    icon: '♾️',
    make: () => ({ type: 'forever', body: [] }),
  },
  ifDistance: {
    colour: 'teal',
    icon: '📏',
    make: () => ({ type: 'ifDistance', op: '<', cm: 20, body: [], elseBody: [] }),
  },
  print: {
    colour: 'green',
    icon: '💬',
    make: () => ({ type: 'print', text: 'Hello!' }),
  },

  /* --------------------------------------------------------- variables */
  setVar: {
    colour: 'rose',
    icon: '📦',
    make: () => ({ type: 'setVar', name: 'count', a: num(0), op: '', b: num(1) }),
  },
  ifCompare: {
    colour: 'teal',
    icon: '❓',
    make: () => ({
      type: 'ifCompare',
      a: variable('count'),
      op: '<',
      b: num(10),
      body: [],
      elseBody: [],
    }),
  },
  whileCompare: {
    colour: 'purple',
    icon: '🔄',
    make: () => ({ type: 'whileCompare', a: variable('count'), op: '<', b: num(10), body: [] }),
  },
}

export const DIRECTIONS = ['forward', 'back', 'left', 'right']

export const CONTAINER_TYPES = ['repeat', 'forever', 'ifDistance', 'ifCompare', 'whileCompare']

/**
 * AN OPERAND: the one value shape the whole language uses.
 *
 * Four sources, and no nesting: a number, variable, distance or wired sensor.
 * Allowing operands to contain other operands would buy almost
 * nothing here and would cost a tree editor, a precedence table and a much
 * harder parser on the C++ side.
 */
export const OPERAND_SOURCES = ['num', 'var', 'distance', 'sensor']
export const COMPARE_OPS = ['<', '>', '<=', '>=', '==', '!=']
/** '' means "just a, no arithmetic". */
export const MATH_OPS = ['', '+', '-', '*', '/']

export const num = (value) => ({ src: 'num', value })
export const variable = (name) => ({ src: 'var', name })
export const distanceOperand = () => ({ src: 'distance' })

/** Every variable name the program assigns, in first-seen order. */
export function collectVars(blocks, out = []) {
  for (const b of blocks) {
    if (b.type === 'setVar' && b.name && !out.includes(b.name)) out.push(b.name)
    collectVars(b.body ?? [], out)
    collectVars(b.elseBody ?? [], out)
  }
  return out
}

/**
 * A variable name safe to paste into C++.
 *
 * Students type into this field, and whatever they type is emitted as an
 * identifier and then read back by the parser. Anything that is not a plain
 * identifier would produce code that does not compile and cannot be re-parsed,
 * so it is filtered at the edge rather than guarded at every use.
 */
export function safeVarName(raw) {
  const cleaned = String(raw ?? '')
    .replace(/[^A-Za-z0-9_]/g, '')
    .replace(/^[0-9]+/, '')
  return cleaned || 'x'
}

export function makeBlock(type) {
  return { id: newId(), ...BLOCK_TYPES[type].make() }
}

/** Deep count, so the log can say "your 7 blocks". */
export function countBlocks(blocks) {
  return blocks.reduce(
    (n, b) => n + 1 + countBlocks(b.body ?? []) + countBlocks(b.elseBody ?? []),
    0,
  )
}

// ------------------------------------------------------------- tree editing
export function insertBlock(blocks, block, parentId, slot = 'body') {
  if (!parentId) return [...blocks, block]
  return blocks.map((b) => {
    if (b.id === parentId) return { ...b, [slot]: [...(b[slot] ?? []), block] }
    return withChildren(b, (list) => insertBlock(list, block, parentId, slot))
  })
}

export function updateBlock(blocks, id, patch) {
  return blocks.map((b) => {
    if (b.id === id) return { ...b, ...patch }
    return withChildren(b, (list) => updateBlock(list, id, patch))
  })
}

export function removeBlock(blocks, id) {
  return blocks
    .filter((b) => b.id !== id)
    .map((b) => withChildren(b, (list) => removeBlock(list, id)))
}

function withChildren(block, fn) {
  let next = block
  if (block.body) next = { ...next, body: fn(block.body) }
  if (block.elseBody) next = { ...next, elseBody: fn(block.elseBody) }
  return next
}

/** The block with this id, wherever it is in the tree. */
export function findBlock(blocks, id) {
  for (const b of blocks) {
    if (b.id === id) return b
    const hit = findBlock(b.body ?? [], id) ?? findBlock(b.elseBody ?? [], id)
    if (hit) return hit
  }
  return null
}

/** Is `id` inside `block` (at any depth)? */
function contains(block, id) {
  return Boolean(findBlock([...(block.body ?? []), ...(block.elseBody ?? [])], id))
}

/** A deep copy with fresh ids all the way down. */
export function cloneBlock(block) {
  const copy = { ...block, id: newId() }
  if (block.body) copy.body = block.body.map(cloneBlock)
  if (block.elseBody) copy.elseBody = block.elseBody.map(cloneBlock)
  return copy
}

/** Insert `block` into a list at a position, rather than only at the end. */
function insertAt(blocks, block, parentId, slot, index) {
  if (!parentId) {
    const next = [...blocks]
    next.splice(index ?? next.length, 0, block)
    return next
  }
  return blocks.map((b) => {
    if (b.id === parentId) {
      const list = [...(b[slot] ?? [])]
      list.splice(index ?? list.length, 0, block)
      return { ...b, [slot]: list }
    }
    return withChildren(b, (list) => insertAt(list, block, parentId, slot, index))
  })
}

/**
 * Move a block to a new parent and position — the drag-and-drop primitive.
 *
 * Two things make this less trivial than a remove followed by an insert:
 *
 *  1. A container cannot be dropped into itself or into its own descendants.
 *     Allowing it detaches the whole subtree from the program and loses it,
 *     since nothing then holds a reference to the new root.
 *  2. Removing first shifts the indices in the list being dropped into. When
 *     the source and destination are the same list and the block is moving
 *     down, the target index has to come back by one or the block lands one
 *     slot short of where it was dropped.
 */
export function moveBlock(blocks, id, parentId, slot = 'body', index = null) {
  const moving = findBlock(blocks, id)
  if (!moving) return blocks
  if (id === parentId || (parentId && contains(moving, parentId))) return blocks

  const siblings = parentId ? (findBlock(blocks, parentId)?.[slot] ?? []) : blocks
  const from = siblings.findIndex((b) => b.id === id)
  let at = index
  if (from !== -1 && at != null && from < at) at -= 1

  return insertAt(removeBlock(blocks, id), moving, parentId, slot, at)
}

/** Duplicate a block, subtree and all, directly after the original. */
export function duplicateBlock(blocks, id) {
  const original = findBlock(blocks, id)
  if (!original) return blocks
  const copy = cloneBlock(original)

  const place = (list) => {
    const i = list.findIndex((b) => b.id === id)
    if (i === -1) return list.map((b) => withChildren(b, place))
    const next = [...list]
    next.splice(i + 1, 0, copy)
    return next
  }
  return place(blocks)
}

// ------------------------------------------------------------- code emitter
export function toArduinoCode(blocks, pinMap) {
  const usedPins = [...new Set(collectPins(blocks))].sort((a, b) => a - b)
  const lines = []

  lines.push('// Generated from blocks. drive, setMotor, setServo, readDistanceCm and readSensor are workshop helpers.')
  lines.push('// Hardware requires matching motor-driver and sensor libraries; this is the workshop C++ subset.')
  for (const pin of usedPins) {
    const owner = pinMap[pin]
    // Callers pass two shapes of pinMap: the store's { pin: {id, kind} } and
    // pre-flattened { pin: 'motor' } strings. Read the kind off either — the
    // raw object stringified into "// [object Object]" in the site's panel.
    const label = typeof owner === 'string' ? owner : owner?.kind
    lines.push(`#define PIN_${pin}  ${pin}${label ? `  // ${label}` : '  // nothing plugged in'}`)
  }

  // Variables are globals, so their values survive from one pass of loop() to
  // the next — which is what a student means by "count how many times".
  const vars = collectVars(blocks)
  if (vars.length) {
    lines.push('')
    for (const v of vars) lines.push(`int ${safeVarName(v)} = 0;`)
  }

  lines.push('')
  lines.push('void setup() {')
  lines.push('  Serial.begin(9600);')
  const sensorPins = new Set()
  const walk = (list) => { for (const b of list) { for (const o of [b.a, b.b]) if (o?.src === 'sensor') sensorPins.add(Number(o.pin)); walk(b.body ?? []); walk(b.elseBody ?? []) } }
  walk(blocks)
  for (const pin of usedPins) lines.push(`  pinMode(${pin}, ${sensorPins.has(pin) ? 'INPUT' : 'OUTPUT'});`)
  lines.push('}')
  lines.push('')
  lines.push('void loop() {')
  emit(blocks, lines, 1)
  lines.push('}')
  return lines.join('\n')
}

function collectPins(blocks, out = []) {
  for (const b of blocks) {
    if (b.pin != null) out.push(b.pin)
    for (const operand of [b.a, b.b]) if (operand?.src === 'sensor') out.push(Number(operand.pin))
    collectPins(b.body ?? [], out)
    collectPins(b.elseBody ?? [], out)
  }
  return out
}

/** One operand as C++. `distance` is the same helper the sensor block reads. */
export function operandCode(o) {
  if (!o) return '0'
  if (o.src === 'var') return safeVarName(o.name)
  if (o.src === 'distance') return 'readDistanceCm()'
  if (o.src === 'sensor') return `readSensor(${Number(o.pin) || 0})`
  return String(Number(o.value) || 0)
}

/** The right-hand side of a `setVar`: either `a` alone or `a op b`. */
function operandPair(b) {
  const left = operandCode(b.a)
  return b.op ? `${left} ${b.op} ${operandCode(b.b)}` : left
}

function emit(blocks, lines, depth) {
  const pad = '  '.repeat(depth)
  for (const b of blocks) {
    switch (b.type) {
      case 'drive':
        lines.push(`${pad}drive(${b.dir.toUpperCase()}, ${b.speed});`)
        lines.push(`${pad}delay(${b.ms});`)
        lines.push(`${pad}drive(STOP, 0);`)
        break
      case 'digitalWrite':
        lines.push(`${pad}digitalWrite(${b.pin}, ${b.value});`)
        break
      case 'motor':
        lines.push(`${pad}setMotor(${b.pin}, ${b.speed});`)
        break
      case 'servo':
        lines.push(`${pad}setServo(${b.pin}, ${b.angle});`)
        break
      case 'wait':
        lines.push(`${pad}delay(${b.ms});`)
        break
      case 'print':
        lines.push(`${pad}Serial.println(${JSON.stringify(String(b.text))});`)
        break
      case 'repeat':
        lines.push(`${pad}for (int i = 0; i < ${b.times}; i++) {`)
        emit(b.body, lines, depth + 1)
        lines.push(`${pad}}`)
        break
      case 'forever':
        lines.push(`${pad}while (true) {`)
        emit(b.body, lines, depth + 1)
        lines.push(`${pad}}`)
        break
      case 'ifDistance':
        lines.push(`${pad}if (readDistanceCm() ${b.op} ${b.cm}) {`)
        emit(b.body, lines, depth + 1)
        if (b.elseBody?.length) {
          lines.push(`${pad}} else {`)
          emit(b.elseBody, lines, depth + 1)
        }
        lines.push(`${pad}}`)
        break
      case 'setVar':
        lines.push(`${pad}${safeVarName(b.name)} = ${operandPair(b)};`)
        break
      case 'ifCompare':
        lines.push(`${pad}if (${operandCode(b.a)} ${b.op} ${operandCode(b.b)}) {`)
        emit(b.body, lines, depth + 1)
        if (b.elseBody?.length) {
          lines.push(`${pad}} else {`)
          emit(b.elseBody, lines, depth + 1)
        }
        lines.push(`${pad}}`)
        break
      case 'whileCompare':
        lines.push(`${pad}while (${operandCode(b.a)} ${b.op} ${operandCode(b.b)}) {`)
        emit(b.body, lines, depth + 1)
        lines.push(`${pad}}`)
        break
      default:
        lines.push(`${pad}// unknown block: ${b.type}`)
    }
  }
}

// -------------------------------------------------------------- interpreter
/**
 * `ctx` must provide:
 *   now()        -> milliseconds
 *   digitalWrite(pin, 'HIGH'|'LOW')
 *   motor(pin, speed)
 *   servo(pin, angle)
 *   print(text)
 *   distance()   -> cm
 */
export function makeRunner(blocks, ctx) {
  /*
   * Variables live for the whole run, not for one pass of the program.
   *
   * That matches the C++ this emits, where they are globals above `loop()` —
   * so "add one to count" inside a Repeat forever actually counts up, which is
   * the entire reason a student reaches for a variable in the first place.
   */
  const vars = new Map()
  const read = (o) => {
    if (!o) return 0
    if (o.src === 'var') return vars.get(safeVarName(o.name)) ?? 0
    if (o.src === 'distance') return ctx.distance()
    if (o.src === 'sensor') {
      if (!ctx.sensor) throw new Error('Sensor reader is unavailable.')
      return ctx.sensor(Number(o.pin))
    }
    return Number(o.value) || 0
  }
  const compare = (a, op, b) => {
    switch (op) {
      case '<': return a < b
      case '>': return a > b
      case '<=': return a <= b
      case '>=': return a >= b
      case '==': return a === b
      case '!=': return a !== b
      default: return false
    }
  }
  const arithmetic = (a, op, b) => {
    switch (op) {
      case '+': return a + b
      case '-': return a - b
      case '*': return a * b
      // Integer division, because the emitted C++ declares these as `int` and
      // a student comparing the two should not find them disagreeing.
      case '/': return b === 0 ? 0 : Math.trunc(a / b)
      default: return a
    }
  }

  function* runList(list) {
    for (const b of list) yield* runBlock(b)
  }

  function* runBlock(b) {
    switch (b.type) {
      case 'drive': {
        // Drive is the block a ten-year-old reaches for first, so it has to be
        // honest about what it does: it writes to the motor pins, waits, then
        // switches them off again. Nothing hidden, nothing magic.
        ctx.drive(b.dir, clampSpeed(b.speed))
        const until = ctx.now() + Math.max(0, Number(b.ms) || 0)
        while (ctx.now() < until) yield
        ctx.drive('stop', 0)
        yield
        break
      }

      case 'digitalWrite':
        ctx.digitalWrite(b.pin, b.value)
        yield
        break

      case 'motor':
        ctx.motor(b.pin, clampSpeed(b.speed))
        yield
        break

      case 'servo':
        ctx.servo(b.pin, clampAngle(b.angle))
        yield
        break

      case 'wait': {
        const until = ctx.now() + Math.max(0, Number(b.ms) || 0)
        while (ctx.now() < until) yield
        break
      }

      case 'print':
        ctx.print(String(b.text))
        yield
        break

      case 'repeat': {
        const times = Math.max(0, Math.min(500, Number(b.times) || 0))
        for (let i = 0; i < times; i++) {
          yield* runList(b.body ?? [])
          yield // never let an empty body spin the frame
        }
        break
      }

      case 'forever':
        for (;;) {
          yield* runList(b.body ?? [])
          yield
        }

      case 'ifDistance': {
        const cm = ctx.distance()
        const pass = compare(cm, b.op, b.cm)
        yield* runList((pass ? b.body : b.elseBody) ?? [])
        break
      }

      case 'setVar':
        vars.set(safeVarName(b.name), Math.trunc(arithmetic(read(b.a), b.op, read(b.b))))
        yield
        break

      case 'ifCompare':
        yield* runList((compare(read(b.a), b.op, read(b.b)) ? b.body : b.elseBody) ?? [])
        break

      case 'whileCompare':
        // One yield per turn of the loop, exactly like `repeat` and `forever`.
        // A condition the body never changes therefore spins at one iteration
        // per frame rather than locking the tab — the robot simply sits there,
        // which is a debuggable outcome instead of a crash.
        while (compare(read(b.a), b.op, read(b.b))) {
          yield* runList(b.body ?? [])
          yield
        }
        break

      default:
        throw new Error(`I do not know how to run a "${b.type}" block.`)
    }
  }

  return runList(blocks)
}

const clampSpeed = (v) => Math.max(-255, Math.min(255, Number(v) || 0))
const clampAngle = (v) => Math.max(0, Math.min(180, Number(v) || 0))
