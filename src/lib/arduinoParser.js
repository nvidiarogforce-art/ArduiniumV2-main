import { COMPARE_OPS, MATH_OPS, newId, num, safeVarName, variable } from './program.js'

/**
 * ARDUINO C++ BACK INTO BLOCKS.
 *
 * The code tab used to be a one-way mirror: blocks went in, C++ came out, and
 * the C++ was something to read rather than something to write. This is the
 * return journey, and it is what makes text a real second way to program the
 * robot rather than a poster of one.
 *
 * The rules it plays by:
 *
 *  - NO `eval`, NO `new Function`. Student text never becomes executable
 *    JavaScript. It is tokenised, parsed into the very same block tree the
 *    palette builds, and handed to the same `makeRunner` — so text and blocks
 *    cannot drift into behaving differently, because after this point they are
 *    literally the same data.
 *  - It accepts the exact shape `toArduinoCode` emits, so blocks -> code ->
 *    blocks is a round trip. Everything else it accepts is a bonus, and
 *    anything it cannot represent is a clear error with a line number rather
 *    than a silent drop.
 *
 * Only the body of `loop()` becomes blocks. `setup()` is generated boilerplate
 * — pin modes and Serial.begin — and a student editing it is describing the
 * same wiring the build already knows about.
 */

/* ================================================================ tokeniser */

const PUNCT = ['<=', '>=', '==', '!=', '++', '--', '(', ')', '{', '}', ';', ',', '.', '=', '<', '>', '+', '-', '*', '/']

/**
 * `#define NAME 13` — one entry for the symbol table.
 *
 * Only object-like macros with an integer body are taken. A function-like
 * macro (`#define SQ(x) ...`), an `#include`, or anything whose body is not a
 * plain number is ignored rather than guessed at: a name this cannot resolve
 * stays an unknown identifier, which produces a clear error where it is used
 * instead of a wrong number.
 *
 * A body that names an earlier define is followed, so `#define LED PIN_13`
 * works — the map is built in source order.
 */
function recordDefine(text, defines) {
  const body = text.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//g, '')
  const m = /^\s*define\s+([A-Za-z_]\w*)\s+(\S+)\s*$/.exec(body)
  if (!m) return
  const [, name, raw] = m
  const value = /^[+-]?\d+$/.test(raw) ? Number(raw) : defines.get(raw)
  if (value != null) defines.set(name, value)
}

function tokenise(src) {
  const out = []
  const defines = new Map()
  let i = 0
  let line = 1

  while (i < src.length) {
    const c = src[i]

    if (c === '\n') {
      line++
      i++
      continue
    }
    if (/\s/.test(c)) {
      i++
      continue
    }
    // Comments, both flavours. A `//` also covers the `#define` and `#include`
    // preamble below, which is skipped wholesale as a directive.
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') line++
        i++
      }
      i += 2
      continue
    }
    // Preprocessor directives are not statements, but `#define` names ARE
    // values the rest of the file may use, so the line is read before it is
    // dropped. Skipping it wholesale is what made `digitalWrite(PIN_13, HIGH)`
    // fail with "I expected a number" on a header the emitter itself writes.
    if (c === '#') {
      let directive = ''
      i++
      while (i < src.length && src[i] !== '\n') directive += src[i++]
      recordDefine(directive, defines)
      continue
    }
    if (c === '"') {
      let text = ''
      const startLine = line
      i++
      while (i < src.length && src[i] !== '"') {
        if (src[i] === '\\' && i + 1 < src.length) {
          const escape = src[i + 1]
          text += ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' })[escape] ?? escape
          i += 2
          continue
        }
        if (src[i] === '\n') line++
        text += src[i]
        i++
      }
      if (i >= src.length) throw new ParseError('Unclosed string.', startLine)
      i++
      out.push({ kind: 'str', value: text, line })
      continue
    }
    if (/[0-9]/.test(c)) {
      let n = ''
      while (i < src.length && /[0-9.]/.test(src[i])) n += src[i++]
      out.push({ kind: 'num', value: Number(n), line })
      continue
    }
    if (/[A-Za-z_]/.test(c)) {
      let word = ''
      while (i < src.length && /[A-Za-z0-9_]/.test(src[i])) word += src[i++]
      out.push({ kind: 'word', value: word, line })
      continue
    }
    const punct = PUNCT.find((p) => src.startsWith(p, i))
    if (punct) {
      out.push({ kind: 'punct', value: punct, line })
      i += punct.length
      continue
    }
    throw new ParseError(`I do not understand the character "${c}".`, line)
  }

  out.push({ kind: 'eof', value: '', line })
  return { tokens: out, defines }
}

class ParseError extends Error {
  constructor(message, line) {
    super(message)
    this.line = line
  }
}

/* =================================================================== parser */

class Parser {
  constructor(tokens, defines = new Map()) {
    this.t = tokens
    this.i = 0
    this.defines = defines
  }

  /**
   * The number a token stands for, or null if it stands for no number.
   *
   * A `#define`d name is a number everywhere a literal would be — that is the
   * whole point of naming a pin — so this is the one place that decides it and
   * every "I need a number here" reads through it.
   */
  numeric(tok) {
    if (tok.kind === 'num') return tok.value
    if (tok.kind === 'word' && this.defines.has(tok.value)) return this.defines.get(tok.value)
    return null
  }

  peek(offset = 0) {
    return this.t[Math.min(this.i + offset, this.t.length - 1)]
  }

  next() {
    return this.t[this.i++]
  }

  is(value, offset = 0) {
    const tok = this.peek(offset)
    return (tok.kind === 'punct' || tok.kind === 'word') && tok.value === value
  }

  eat(value) {
    if (!this.is(value)) {
      const tok = this.peek()
      throw new ParseError(
        `I expected "${value}" here, but found "${tok.value || 'the end of the program'}".`,
        tok.line,
      )
    }
    return this.next()
  }

  /** Skip everything up to and including the opening brace of `loop()`. */
  seekLoop() {
    for (let k = 0; k < this.t.length - 2; k++) {
      if (this.t[k].kind === 'word' && this.t[k].value === 'loop' && this.t[k + 1].value === '(') {
        this.i = k
        this.next() // loop
        this.eat('(')
        while (!this.is(')')) {
          if (this.peek().kind === 'eof') throw new ParseError('The loop() declaration is not finished.', this.peek().line)
          this.next()
        }
        this.eat(')')
        this.eat('{')
        return true
      }
    }
    return false
  }

  /** Statements up to the matching close brace. */
  parseBlockBody() {
    const list = []
    while (!this.is('}')) {
      if (this.peek().kind === 'eof') {
        throw new ParseError('This program is missing a closing "}".', this.peek().line)
      }
      const stmt = this.parseStatement()
      if (stmt) list.push(stmt)
    }
    this.eat('}')
    return foldDrives(list)
  }

  braced() {
    this.eat('{')
    return this.parseBlockBody()
  }

  parseStatement() {
    const tok = this.peek()

    if (tok.kind === 'punct' && tok.value === ';') {
      this.next()
      return null
    }
    if (tok.kind !== 'word') {
      throw new ParseError(`I did not expect "${tok.value}" here.`, tok.line)
    }

    switch (tok.value) {
      case 'if':
        return this.parseIf()
      case 'while':
        return this.parseWhile()
      case 'for':
        return this.parseFor()
      case 'delay': {
        this.next()
        this.eat('(')
        const ms = this.number()
        this.eat(')')
        this.eat(';')
        return { id: newId(), type: 'wait', ms }
      }
      case 'drive': {
        this.next()
        this.eat('(')
        const dir = this.next().value
        this.eat(',')
        const speed = this.signedNumber()
        this.eat(')')
        this.eat(';')
        return String(dir).toUpperCase() === 'STOP'
          ? { id: newId(), type: '__driveStop' }
          : { id: newId(), type: '__drive', dir: String(dir).toLowerCase(), speed }
      }
      case 'digitalWrite': {
        this.next()
        this.eat('(')
        const pin = this.number()
        this.eat(',')
        const value = String(this.next().value).toUpperCase()
        this.eat(')')
        this.eat(';')
        if (value !== 'HIGH' && value !== 'LOW') {
          throw new ParseError('digitalWrite needs HIGH or LOW.', tok.line)
        }
        return { id: newId(), type: 'digitalWrite', pin, value }
      }
      case 'setMotor': {
        this.next()
        this.eat('(')
        const pin = this.number()
        this.eat(',')
        const speed = this.signedNumber()
        this.eat(')')
        this.eat(';')
        return { id: newId(), type: 'motor', pin, speed }
      }
      case 'setServo': {
        this.next()
        this.eat('(')
        const pin = this.number()
        this.eat(',')
        const angle = this.signedNumber()
        this.eat(')')
        this.eat(';')
        return { id: newId(), type: 'servo', pin, angle }
      }
      case 'Serial': {
        this.next()
        this.eat('.')
        const fn = this.next().value
        if (fn !== 'println' && fn !== 'print') {
          throw new ParseError(`Serial.${fn} is not something I can run.`, tok.line)
        }
        this.eat('(')
        const strTok = this.next()
        if (strTok.kind !== 'str') {
          throw new ParseError('Serial.println needs text in quotes.', strTok.line)
        }
        this.eat(')')
        this.eat(';')
        return { id: newId(), type: 'print', text: strTok.value }
      }
      // A local `int x = ...;` is treated as an assignment: the emitter hoists
      // every variable to a global, so where it was declared carries no meaning.
      case 'int':
      case 'long':
      case 'float':
        this.next()
        return this.parseAssignment()
      default:
        return this.parseAssignment()
    }
  }

  parseAssignment() {
    const nameTok = this.next()
    if (nameTok.kind !== 'word') {
      throw new ParseError(`I did not expect "${nameTok.value}" here.`, nameTok.line)
    }
    // `count++` is the one shorthand worth supporting: it is what a student
    // copying a for-loop will reach for.
    if (this.is('++') || this.is('--')) {
      const op = this.next().value === '++' ? '+' : '-'
      this.eat(';')
      return {
        id: newId(),
        type: 'setVar',
        name: safeVarName(nameTok.value),
        a: variable(nameTok.value),
        op,
        b: num(1),
      }
    }
    this.eat('=')
    const a = this.operand()
    let op = ''
    let b = num(1)
    if (MATH_OPS.includes(this.peek().value) && this.peek().value !== '') {
      op = this.next().value
      b = this.operand()
    }
    this.eat(';')
    return { id: newId(), type: 'setVar', name: safeVarName(nameTok.value), a, op, b }
  }

  parseIf() {
    const line = this.peek().line
    this.eat('if')
    this.eat('(')
    const a = this.operand()
    const op = this.comparison(line)
    const b = this.operand()
    this.eat(')')
    const body = this.braced()

    let elseBody = []
    if (this.is('else')) {
      this.next()
      // `else if` chains into a nested if, which is what the blocks show too.
      elseBody = this.is('if') ? [this.parseIf()] : this.braced()
    }

    // Keep the friendly form when it is exactly the friendly form, so a
    // round trip through the code tab does not quietly rewrite a student's
    // "if something is closer than 20cm" into the general comparison.
    if (a.src === 'distance' && b.src === 'num' && (op === '<' || op === '>')) {
      return { id: newId(), type: 'ifDistance', op, cm: b.value, body, elseBody }
    }
    return { id: newId(), type: 'ifCompare', a, op, b, body, elseBody }
  }

  parseWhile() {
    const line = this.peek().line
    this.eat('while')
    this.eat('(')
    if (this.is('true')) {
      this.next()
      this.eat(')')
      return { id: newId(), type: 'forever', body: this.braced() }
    }
    const a = this.operand()
    const op = this.comparison(line)
    const b = this.operand()
    this.eat(')')
    return { id: newId(), type: 'whileCompare', a, op, b, body: this.braced() }
  }

  /**
   * `for (int i = 0; i < N; i++)` is read as "repeat N times".
   *
   * The counter is deliberately not exposed as a variable: this is the shape
   * the Repeat block emits, and reading it back as anything else would stop
   * Repeat surviving a trip through the code tab.
   */
  parseFor() {
    const line = this.peek().line
    this.eat('for')
    this.eat('(')
    let times = 0
    let sawLimit = false
    let depth = 1
    while (depth > 0) {
      const tok = this.next()
      if (tok.kind === 'eof') throw new ParseError('This "for" loop is not finished.', line)
      if (tok.value === '(') depth++
      else if (tok.value === ')') depth--
      else if (!sawLimit && (tok.value === '<' || tok.value === '<=')) {
        const limit = this.numeric(this.peek())
        if (limit != null) {
          times = tok.value === '<=' ? limit + 1 : limit
          sawLimit = true
        }
      }
    }
    if (!sawLimit) {
      throw new ParseError('I need a plain number to know how many times to repeat.', line)
    }
    return { id: newId(), type: 'repeat', times, body: this.braced() }
  }

  comparison(line) {
    const tok = this.peek()
    if (!COMPARE_OPS.includes(tok.value)) {
      throw new ParseError(
        `I expected a comparison such as < or ==, but found "${tok.value}".`,
        tok.line ?? line,
      )
    }
    return this.next().value
  }

  operand() {
    const tok = this.next()
    if (tok.kind === 'num') return num(tok.value)
    if (tok.kind === 'punct' && tok.value === '-') {
      const n = this.next()
      if (n.kind !== 'num') throw new ParseError('I expected a number after the minus.', n.line)
      return num(-n.value)
    }
    if (tok.kind === 'word') {
      if (tok.value === 'readSensor') {
        this.eat('(')
        const pin = this.number()
        this.eat(')')
        if (!Number.isInteger(pin) || pin < 0 || pin > 19) throw new ParseError('Sensor pin must be 0–19.', tok.line)
        return { src: 'sensor', pin }
      }
      if (tok.value === 'readDistanceCm') {
        this.eat('(')
        this.eat(')')
        return { src: 'distance' }
      }
      // A #defined name is a constant, not a variable a student can change —
      // otherwise `while (count < MAX)` would silently compare against a
      // variable nothing ever assigns, which reads as 0.
      if (this.defines.has(tok.value)) return num(this.defines.get(tok.value))
      return variable(tok.value)
    }
    throw new ParseError(`I expected a value here, but found "${tok.value}".`, tok.line)
  }

  number() {
    const tok = this.next()
    const value = this.numeric(tok)
    if (value == null) {
      throw new ParseError(
        tok.kind === 'word'
          ? `I expected a number here. "${tok.value}" is not one, and nothing gives it a value with #define.`
          : `I expected a number, found "${tok.value}".`,
        tok.line,
      )
    }
    return value
  }

  signedNumber() {
    if (this.is('-')) {
      this.next()
      return -this.number()
    }
    return this.number()
  }
}

/**
 * Put a Drive block back together.
 *
 * One Drive emits three statements — start the motors, wait, stop them — so
 * reading them back one at a time would turn every Drive into three blocks and
 * the round trip would grow the program each time it was opened. Anything that
 * does not match the full triple is left as it was written.
 */
function foldDrives(list) {
  const out = []
  for (let i = 0; i < list.length; i++) {
    const a = list[i]
    if (a.type === '__drive') {
      const b = list[i + 1]
      const c = list[i + 2]
      if (b?.type === 'wait' && c?.type === '__driveStop') {
        out.push({ id: a.id, type: 'drive', dir: a.dir, speed: a.speed, ms: b.ms })
        i += 2
        continue
      }
      out.push({ id: a.id, type: 'drive', dir: a.dir, speed: a.speed, ms: 0 })
      continue
    }
    if (a.type === '__driveStop') {
      out.push({ id: a.id, type: 'drive', dir: 'forward', speed: 0, ms: 0 })
      continue
    }
    out.push(a)
  }
  return out
}

/**
 * Parse a sketch into blocks.
 *
 * Returns `{ blocks }` on success or `{ error: { message, line } }` — never
 * throws, because the caller is a text box a student is typing into and a
 * half-finished line is the normal state, not an exceptional one.
 */
export function parseArduino(source) {
  try {
    const { tokens, defines } = tokenise(source)
    const parser = new Parser(tokens, defines)
    if (!parser.seekLoop()) {
      return {
        error: {
          message: 'I could not find "void loop() { }". That is where the program goes.',
          line: 1,
        },
      }
    }
    return { blocks: parser.parseBlockBody() }
  } catch (err) {
    if (err instanceof ParseError) return { error: { message: err.message, line: err.line } }
    return { error: { message: err.message, line: 1 } }
  }
}
