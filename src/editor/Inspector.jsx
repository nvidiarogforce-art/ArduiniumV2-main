import { useCallback, useEffect, useState } from 'react'
import { GRID, PALETTE, footprint } from './model.js'

/**
 * Property panel for the active block.
 *
 * Every edit routes through `editor.updateBlock`, which validates geometry
 * against the rest of the board before committing — so this panel cannot
 * produce an overlapping or out-of-bounds canvas no matter what is typed.
 *
 * Continuous inputs (text, colour, number spinners) pass `coalesce`, which
 * collapses a run of edits into a single history entry. Without it, typing a
 * six-character label would push six undo states and bury whatever the user
 * did before.
 */
export default function Inspector({ editor }) {
  const { activeBlock, selectedBlocks, updateBlock } = editor

  if (!activeBlock) {
    return (
      <aside className="bc-inspector">
        <h2 className="bc-panel-title">Inspector</h2>
        <p className="bc-empty">
          {selectedBlocks.length > 1
            ? `${selectedBlocks.length} blocks selected. Click one to edit its properties.`
            : 'Nothing selected. Click a block on the canvas.'}
        </p>
      </aside>
    )
  }

  const f = footprint(activeBlock)
  const set = (patch, opts) => updateBlock(activeBlock.id, patch, opts)

  return (
    <aside className="bc-inspector">
      <h2 className="bc-panel-title">Inspector</h2>

      {selectedBlocks.length > 1 && (
        <p className="bc-hint">
          Editing 1 of {selectedBlocks.length} selected. Group actions are in the toolbar.
        </p>
      )}

      <div className="bc-field">
        <label htmlFor="bc-label">Label</label>
        <input
          id="bc-label"
          type="text"
          value={activeBlock.label}
          maxLength={64}
          onChange={(e) => set({ label: e.target.value }, { coalesce: true, label: 'label' })}
        />
      </div>

      <div className="bc-field">
        <span className="bc-field-legend">Colour</span>
        <div className="bc-swatches">
          {PALETTE.map((p) => (
            <button
              key={p.name}
              type="button"
              className={`bc-swatch ${activeBlock.color === p.fill ? 'is-on' : ''}`}
              style={{ background: p.fill }}
              title={p.name}
              aria-label={p.name}
              onClick={() => set({ color: p.fill })}
            />
          ))}
          {/* Free colour choice alongside the presets — the native picker
              fires change continuously while dragging, hence coalescing. */}
          <input
            type="color"
            className="bc-color-input"
            value={activeBlock.color}
            title="Custom colour"
            aria-label="Custom colour"
            onChange={(e) => set({ color: e.target.value }, { coalesce: true, label: 'colour' })}
          />
        </div>
      </div>

      <div className="bc-grid-2">
        <NumberField
          id="bc-x"
          label="X"
          value={activeBlock.x}
          min={0}
          max={GRID.cols - f.w}
          onCommit={(v) => set({ x: v }, { coalesce: true, label: 'pos' })}
        />
        <NumberField
          id="bc-y"
          label="Y"
          value={activeBlock.y}
          min={0}
          max={GRID.rows - f.h}
          onCommit={(v) => set({ y: v }, { coalesce: true, label: 'pos' })}
        />
        <NumberField
          id="bc-w"
          label="Width"
          value={activeBlock.w}
          min={1}
          max={GRID.cols}
          onCommit={(v) => set({ w: v }, { coalesce: true, label: 'size' })}
        />
        <NumberField
          id="bc-h"
          label="Height"
          value={activeBlock.h}
          min={1}
          max={GRID.rows}
          onCommit={(v) => set({ h: v }, { coalesce: true, label: 'size' })}
        />
      </div>

      <div className="bc-field">
        <span className="bc-field-legend">Rotation</span>
        <div className="bc-seg">
          {[0, 90, 180, 270].map((deg) => (
            <button
              key={deg}
              type="button"
              className={activeBlock.rotation === deg ? 'is-on' : ''}
              onClick={() => set({ rotation: deg })}
            >
              {deg}°
            </button>
          ))}
        </div>
      </div>

      <div className="bc-field">
        <label htmlFor="bc-z">Layer (z)</label>
        <input
          id="bc-z"
          type="number"
          value={activeBlock.z}
          onChange={(e) => set({ z: Number(e.target.value) || 0 }, { coalesce: true, label: 'z' })}
        />
      </div>

      <div className="bc-checks">
        <label>
          <input
            type="checkbox"
            checked={activeBlock.locked}
            onChange={(e) => set({ locked: e.target.checked })}
          />
          Locked
        </label>
        <label>
          <input
            type="checkbox"
            checked={activeBlock.hidden}
            onChange={(e) => set({ hidden: e.target.checked })}
          />
          Hidden
        </label>
      </div>

      <CustomProps block={activeBlock} onChange={(props) => set({ props })} />

      <p className="bc-id">id: {activeBlock.id}</p>
    </aside>
  )
}

/**
 * A number input that keeps its own draft string while focused.
 *
 * Binding a number input straight to committed state makes it impossible to
 * clear the field or type a minus sign — every keystroke round-trips through
 * validation and snaps back. Holding a draft locally and committing on a valid
 * parse (and on blur) keeps typing natural while still rejecting nonsense.
 */
function NumberField({ id, label, value, min, max, onCommit }) {
  const [draft, setDraft] = useState(String(value))
  const [focused, setFocused] = useState(false)

  // Track external changes (drag, undo, alignment) while not being typed into.
  useEffect(() => {
    if (!focused) setDraft(String(value))
  }, [value, focused])

  const commit = useCallback(
    (raw) => {
      const n = Math.round(Number(raw))
      if (!Number.isFinite(n)) return
      onCommit(Math.min(max, Math.max(min, n)))
    },
    [max, min, onCommit],
  )

  return (
    <div className="bc-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        value={draft}
        min={min}
        max={max}
        onFocus={() => setFocused(true)}
        onChange={(e) => {
          setDraft(e.target.value)
          if (e.target.value !== '' && e.target.value !== '-') commit(e.target.value)
        }}
        onBlur={(e) => {
          setFocused(false)
          commit(e.target.value)
          setDraft(String(value))
        }}
      />
    </div>
  )
}

/**
 * Free-form key/value pairs on a block.
 *
 * Kept deliberately simple: add a row, edit either side, remove a row. Keys
 * are unique per block, so renaming a key to an existing one overwrites it —
 * the same rule an object literal follows, which is the least surprising
 * behaviour available.
 */
function CustomProps({ block, onChange }) {
  const entries = Object.entries(block.props ?? {})
  const [newKey, setNewKey] = useState('')

  const add = () => {
    const key = newKey.trim()
    if (!key) return
    onChange({ ...block.props, [key]: '' })
    setNewKey('')
  }

  const rename = (oldKey, nextKey) => {
    const key = nextKey.trim()
    if (!key || key === oldKey) return
    const next = {}
    // Rebuild in order so renaming does not shuffle the list under the cursor.
    for (const [k, v] of Object.entries(block.props)) next[k === oldKey ? key : k] = v
    onChange(next)
  }

  const remove = (key) => {
    const next = { ...block.props }
    delete next[key]
    onChange(next)
  }

  return (
    <div className="bc-props">
      <span className="bc-field-legend">Custom properties</span>

      {entries.length === 0 && <p className="bc-empty bc-empty-sm">None yet.</p>}

      {entries.map(([key, value]) => (
        <div className="bc-prop-row" key={key}>
          <input
            type="text"
            value={key}
            aria-label={`Property name ${key}`}
            onChange={(e) => rename(key, e.target.value)}
          />
          <input
            type="text"
            value={value}
            aria-label={`Value of ${key}`}
            onChange={(e) => onChange({ ...block.props, [key]: e.target.value })}
          />
          <button type="button" onClick={() => remove(key)} title={`Remove ${key}`}>
            ✕
          </button>
        </div>
      ))}

      <div className="bc-prop-row">
        <input
          type="text"
          placeholder="new key"
          value={newKey}
          aria-label="New property name"
          onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
        />
        <button type="button" onClick={add} disabled={!newKey.trim()}>
          Add
        </button>
      </div>
    </div>
  )
}
