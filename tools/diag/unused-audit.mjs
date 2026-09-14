/**
 * Unused exports and unused imports across src/.
 *
 *   node tools/diag/unused-audit.mjs
 *
 * Crude but effective: collect every exported name, then count references to
 * that identifier in every OTHER file. Zero references means nothing outside
 * its own module can be using it. Re-exports and dynamic access will produce
 * the odd false positive, so read the list rather than acting on it blindly.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const srcDir = path.join(root, 'src')

const files = []
;(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.(jsx?)$/.test(e.name)) files.push(p)
  }
})(srcDir)

const text = new Map(files.map((f) => [f, fs.readFileSync(f, 'utf8')]))
const rel = (f) => path.relative(root, f).replace(/\\/g, '/')

/* ------------------------------------------------------- unused exports */
const exportRe =
  /^export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm
const exportListRe = /^export\s*\{([^}]+)\}/gm

console.log('=== EXPORTS WITH NO REFERENCE IN ANY OTHER FILE ===')
let unused = 0
for (const f of files) {
  const src = text.get(f)
  const names = new Set()
  for (const m of src.matchAll(exportRe)) names.add(m[1])
  for (const m of src.matchAll(exportListRe)) {
    for (const part of m[1].split(',')) {
      const n = part.trim().split(/\s+as\s+/)[0].trim()
      if (n && n !== 'default') names.add(n)
    }
  }
  for (const name of names) {
    const re = new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\b`)
    const users = files.filter((o) => o !== f && re.test(text.get(o)))
    if (!users.length) {
      // Also check tools/, which imports a few library helpers directly.
      const toolHit = fs
        .readdirSync(path.join(root, 'tools'))
        .filter((n) => n.endsWith('.mjs'))
        .some((n) => re.test(fs.readFileSync(path.join(root, 'tools', n), 'utf8')))
      if (!toolHit) {
        console.log(`  ${rel(f)}  ->  ${name}`)
        unused++
      }
    }
  }
}
if (!unused) console.log('  none')

/* ------------------------------------------------------- unused imports */
console.log('\n=== IMPORTED BUT NEVER USED IN THE FILE ===')
let dead = 0
const importRe = /^import\s+(?:([\w$]+)\s*,\s*)?(?:\{([^}]*)\}|([\w$*]+))?\s*from\s*['"][^'"]+['"]/gm
for (const f of files) {
  const src = text.get(f)
  const body = src.replace(importRe, '')
  for (const m of src.matchAll(importRe)) {
    const names = []
    if (m[1]) names.push(m[1])
    if (m[3] && m[3] !== '*') names.push(m[3])
    if (m[2]) {
      for (const part of m[2].split(',')) {
        const n = part.trim().split(/\s+as\s+/).pop().trim()
        if (n) names.push(n)
      }
    }
    for (const n of names) {
      if (!new RegExp(`\\b${n.replace(/\$/g, '\\$')}\\b`).test(body)) {
        console.log(`  ${rel(f)}  ->  ${n}`)
        dead++
      }
    }
  }
}
if (!dead) console.log('  none')
