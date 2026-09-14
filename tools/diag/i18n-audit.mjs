/**
 * i18n parity + usage audit.
 *
 *   node tools/diag/i18n-audit.mjs
 *
 * Three questions:
 *   1. Does every key in en.js exist in ru.js and uz.js (and vice versa)?
 *   2. Does every t()/tBlock() call in the app name a key that exists?
 *   3. Is any key defined but never referenced?
 *
 * Static keys only for (2)/(3) — dynamic ones (`parts.${kind}.name`) are
 * resolved by expanding the prefixes listed in DYNAMIC below.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

const en = (await import('file://' + path.join(root, 'src/i18n/en.js'))).default
const ru = (await import('file://' + path.join(root, 'src/i18n/ru.js'))).default
const uz = (await import('file://' + path.join(root, 'src/i18n/uz.js'))).default

/** Every leaf path in a nested dictionary. */
function leaves(node, prefix = '', out = new Map()) {
  for (const [k, v] of Object.entries(node)) {
    const p = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) leaves(v, p, out)
    else out.set(p, v)
  }
  return out
}

const dicts = { en: leaves(en), ru: leaves(ru), uz: leaves(uz) }
const all = new Set([...dicts.en.keys(), ...dicts.ru.keys(), ...dicts.uz.keys()])

console.log('=== 1. KEY PARITY ===')
console.log(`en ${dicts.en.size}   ru ${dicts.ru.size}   uz ${dicts.uz.size}   union ${all.size}\n`)
let parityProblems = 0
for (const key of [...all].sort()) {
  const missing = ['en', 'ru', 'uz'].filter((l) => !dicts[l].has(key))
  if (missing.length) {
    console.log(`  MISSING in ${missing.join(',').padEnd(8)} ${key}`)
    parityProblems++
  }
}
// A key that exists everywhere but is byte-identical in all three usually means
// an untranslated string copied across, which is worth eyeballing.
const untranslated = []
for (const key of [...all].sort()) {
  const v = ['en', 'ru', 'uz'].map((l) => dicts[l].get(key))
  if (v.every((x) => typeof x === 'string' && x.length > 2 && x === v[0])) untranslated.push(key)
}
if (!parityProblems) console.log('  no missing keys')

console.log(`\n=== 2. IDENTICAL IN ALL THREE (${untranslated.length}) ===`)
console.log(untranslated.length ? untranslated.map((k) => '  ' + k).join('\n') : '  none')

/* ------------------------------------------------- keys referenced in code */

const files = []
;(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.(jsx?|mjs)$/.test(e.name) && !p.includes(`${path.sep}i18n${path.sep}`)) files.push(p)
  }
})(path.join(root, 'src'))

/** Prefixes whose full key is built at runtime, expanded from the dictionary. */
const DYNAMIC = ['parts.', 'lessons.', 'missions.', 'blocks.', 'refusal.', 'serial.']

const used = new Set()
const dynamicPrefixes = new Set()
const callRe = /\b(?:t|tb|tBlock|block|teach|say|partName)\s*\(\s*(['"`])([^'"`$]+?)\1/g
const dynRe = /\b(?:t|tb|tBlock|block|teach|say)\s*\(\s*`([^`$]*)\$\{/g

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  for (const m of src.matchAll(callRe)) used.add(m[2])
  for (const m of src.matchAll(dynRe)) dynamicPrefixes.add(m[1])
}

console.log(`\n=== 3. CALLS NAMING A KEY THAT DOES NOT EXIST ===`)
let dangling = 0
for (const key of [...used].sort()) {
  if (all.has(key)) continue
  // A call may name a sub-tree (tBlock) rather than a leaf.
  if ([...all].some((k) => k.startsWith(key + '.'))) continue
  console.log(`  ${key}`)
  dangling++
}
if (!dangling) console.log('  none')

console.log(`\n=== 4. DEFINED BUT NEVER REFERENCED ===`)
const covered = (key) =>
  used.has(key) ||
  [...used].some((u) => key.startsWith(u + '.')) ||
  [...dynamicPrefixes].some((p) => key.startsWith(p)) ||
  DYNAMIC.some((p) => key.startsWith(p))
const orphans = [...dicts.en.keys()].filter((k) => !covered(k)).sort()
console.log(orphans.length ? orphans.map((k) => '  ' + k).join('\n') : '  none')
console.log(`\ndynamic prefixes seen in code: ${[...dynamicPrefixes].join(', ') || '(none)'}`)
