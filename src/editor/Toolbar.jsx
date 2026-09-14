import { useRef } from 'react'
import { BLOCK_KINDS, ZOOM } from './model.js'

/**
 * Palette, group operations and file actions.
 *
 * Every control here maps to exactly one editor operation and shows its
 * keyboard shortcut in the tooltip — the toolbar is meant to teach the
 * shortcuts, not to be the permanent way of working.
 *
 * Buttons are disabled rather than hidden when they do not apply, so the
 * layout never reflows under the pointer.
 */
export default function Toolbar({ editor, selectionMode, onToggleSelectionMode }) {
  const { selectedBlocks, editableBlocks, history, viewport } = editor
  const fileInput = useRef(null)

  const nSel = selectedBlocks.length
  const canEdit = editableBlocks.length > 0
  const canAlign = editableBlocks.length > 1
  const canDistribute = editableBlocks.length > 2

  /** Download the current canvas as a .json file. */
  const doExport = () => {
    const data = editor.exportToJSON()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'block-canvas.json'
    a.click()
    // Revoking immediately can cancel the download in some browsers; one turn
    // of the event loop is enough for the click to be consumed.
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  const doImport = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => editor.importFromJSON(String(reader.result))
    reader.onerror = () => editor.notify('Could not read that file', 'warn')
    reader.readAsText(file)
  }

  return (
    <div className="bc-toolbar">
      <section className="bc-tool-group">
        <span className="bc-tool-label">Add</span>
        <div className="bc-palette">
          {BLOCK_KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              className="bc-palette-btn"
              style={{ '--swatch': k.color }}
              onClick={() => editor.addBlock(k.kind)}
              title={`Add ${k.label} (${k.w}×${k.h}) at the cursor`}
            >
              <span className="bc-palette-chip" />
              {k.label}
            </button>
          ))}
        </div>
      </section>

      <section className="bc-tool-group">
        <span className="bc-tool-label">Selection · {nSel}</span>
        <div className="bc-tool-row">
          <button
            type="button"
            className={selectionMode ? 'is-on' : ''}
            onClick={onToggleSelectionMode}
            title="Selection mode — drag empty space to rubber-band select (S)"
          >
            ⬚ Select
          </button>
          <button type="button" onClick={editor.selectAll} title="Select all unlocked (Ctrl+A)">
            All
          </button>
          <button
            type="button"
            onClick={editor.selection.clear}
            disabled={!nSel}
            title="Deselect (Esc)"
          >
            None
          </button>
        </div>
      </section>

      <section className="bc-tool-group">
        <span className="bc-tool-label">Transform</span>
        <div className="bc-tool-row">
          <button
            type="button"
            onClick={() => editor.rotateSelection('ccw')}
            disabled={!canEdit}
            title="Rotate counter-clockwise (Q or Shift+R)"
          >
            ↺
          </button>
          <button
            type="button"
            onClick={() => editor.rotateSelection('cw')}
            disabled={!canEdit}
            title="Rotate clockwise (R)"
          >
            ↻
          </button>
          <button
            type="button"
            onClick={() => editor.duplicateSelection()}
            disabled={!nSel}
            title="Duplicate (Ctrl+D, or Alt+drag)"
          >
            ⧉
          </button>
          <button
            type="button"
            onClick={editor.deleteSelected}
            disabled={!canEdit}
            title="Delete (Del)"
          >
            🗑
          </button>
        </div>
      </section>

      <section className="bc-tool-group">
        <span className="bc-tool-label">Layer &amp; lock</span>
        <div className="bc-tool-row">
          <button
            type="button"
            onClick={() => editor.setLayer('front')}
            disabled={!canEdit}
            title="Bring to front (Ctrl+])"
          >
            ⬆ Front
          </button>
          <button
            type="button"
            onClick={() => editor.setLayer('back')}
            disabled={!canEdit}
            title="Send to back (Ctrl+[)"
          >
            ⬇ Back
          </button>
          <button
            type="button"
            onClick={editor.toggleLock}
            disabled={!nSel}
            title="Lock or unlock (Ctrl+L)"
          >
            🔒
          </button>
          <button
            type="button"
            onClick={editor.toggleHidden}
            disabled={!canEdit}
            title="Show or hide (H)"
          >
            👁
          </button>
        </div>
      </section>

      <section className="bc-tool-group">
        <span className="bc-tool-label">Align</span>
        <div className="bc-tool-row">
          <button type="button" onClick={() => editor.align('left')} disabled={!canAlign} title="Align left">
            ⇤
          </button>
          <button
            type="button"
            onClick={() => editor.align('centerX')}
            disabled={!canAlign}
            title="Align horizontal centres"
          >
            ⇹
          </button>
          <button type="button" onClick={() => editor.align('right')} disabled={!canAlign} title="Align right">
            ⇥
          </button>
          <button type="button" onClick={() => editor.align('top')} disabled={!canAlign} title="Align top">
            ⤒
          </button>
          <button
            type="button"
            onClick={() => editor.align('centerY')}
            disabled={!canAlign}
            title="Align vertical centres"
          >
            ⇳
          </button>
          <button
            type="button"
            onClick={() => editor.align('bottom')}
            disabled={!canAlign}
            title="Align bottom"
          >
            ⤓
          </button>
        </div>
        <div className="bc-tool-row">
          <button
            type="button"
            onClick={() => editor.distribute('x')}
            disabled={!canDistribute}
            title="Even horizontal gaps (needs 3+)"
          >
            ↔ Distribute
          </button>
          <button
            type="button"
            onClick={() => editor.distribute('y')}
            disabled={!canDistribute}
            title="Even vertical gaps (needs 3+)"
          >
            ↕ Distribute
          </button>
        </div>
      </section>

      <section className="bc-tool-group">
        <span className="bc-tool-label">History</span>
        <div className="bc-tool-row">
          <button type="button" onClick={history.undo} disabled={!history.canUndo} title="Undo (Ctrl+Z)">
            ↶ Undo
          </button>
          <button
            type="button"
            onClick={history.redo}
            disabled={!history.canRedo}
            title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
          >
            ↷ Redo
          </button>
        </div>
      </section>

      <section className="bc-tool-group">
        <span className="bc-tool-label">View · {Math.round(viewport.viewport.scale * 100)}%</span>
        <div className="bc-tool-row">
          <button
            type="button"
            onClick={() => viewport.zoomBy(1 / ZOOM.step)}
            title="Zoom out (Ctrl+wheel)"
          >
            −
          </button>
          <button type="button" onClick={() => viewport.zoomBy(ZOOM.step)} title="Zoom in (Ctrl+wheel)">
            +
          </button>
          <button type="button" onClick={viewport.fitView} title="Fit the grid to the window">
            Fit
          </button>
          <button type="button" onClick={viewport.resetView} title="Reset pan and zoom">
            100%
          </button>
        </div>
      </section>

      <section className="bc-tool-group">
        <span className="bc-tool-label">File</span>
        <div className="bc-tool-row">
          <button type="button" onClick={doExport} title="Download the canvas as JSON">
            ⭳ Export
          </button>
          <button type="button" onClick={() => fileInput.current?.click()} title="Load a canvas JSON">
            ⭱ Import
          </button>
          <button
            type="button"
            onClick={editor.clearCanvas}
            disabled={!editor.blocks.length}
            title="Remove every block (undoable)"
          >
            Clear
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              doImport(e.target.files?.[0])
              // Reset so re-picking the same file fires change again.
              e.target.value = ''
            }}
          />
        </div>
      </section>
    </div>
  )
}
