import { useCallback, useEffect, useRef, useState } from 'react'
import BlockCanvas from './BlockCanvas.jsx'
import Inspector from './Inspector.jsx'
import Toolbar from './Toolbar.jsx'
import { useBlockEditor } from './hooks/useBlockEditor.js'
import './editor.css'

/**
 * Root of the block editor: composes the panels and owns the keyboard layer.
 *
 * Shortcuts live here rather than in the individual components because they
 * are global to the editor — binding them per-panel would mean they only work
 * while that panel happens to hold focus, which is exactly the bug people hit
 * when they click the canvas and Ctrl+Z stops working.
 */
export default function BlockEditor() {
  const containerRef = useRef(null)
  const editor = useBlockEditor(containerRef)

  /**
   * Sticky selection mode, toggled with S. Holding Shift does the same thing
   * transiently; the canvas checks both, so this only tracks the sticky half.
   */
  const [selectionMode, setSelectionMode] = useState(false)

  /**
   * Latest editor API for the keyboard handler.
   *
   * `useBlockEditor` returns a fresh object every render, and this component
   * re-renders on every marquee pixel — so depending on `editor` directly would
   * tear down and re-add the window listener hundreds of times per drag.
   */
  const live = useRef(null)
  live.current = editor

  useEffect(() => {
    const onKey = (e) => {
      const editor = live.current
      // Never steal keys from a text field. Escape is the one exception: it
      // should always be able to back you out, so it blurs the field instead.
      const el = e.target
      const typing =
        el?.tagName === 'INPUT' ||
        el?.tagName === 'SELECT' ||
        el?.tagName === 'TEXTAREA' ||
        el?.isContentEditable
      if (typing) {
        if (e.key === 'Escape') el.blur()
        return
      }

      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()

      // ---------------------------------------------------------- modified
      if (mod) {
        switch (key) {
          case 'a':
            e.preventDefault()
            editor.selectAll()
            return
          case 'c':
            e.preventDefault()
            editor.copySelection()
            return
          case 'v':
            e.preventDefault()
            editor.pasteClipboard()
            return
          case 'd':
            e.preventDefault()
            editor.duplicateSelection()
            return
          case 'l':
            e.preventDefault()
            editor.toggleLock()
            return
          case 'z':
            e.preventDefault()
            // Ctrl+Shift+Z is the second redo binding, alongside Ctrl+Y.
            if (e.shiftKey) editor.history.redo()
            else editor.history.undo()
            return
          case 'y':
            e.preventDefault()
            editor.history.redo()
            return
          case ']':
            e.preventDefault()
            editor.setLayer('front')
            return
          case '[':
            e.preventDefault()
            editor.setLayer('back')
            return
          default:
            return
        }
      }

      // -------------------------------------------------------- unmodified
      switch (e.key) {
        case 'Escape':
          editor.selection.clear()
          setSelectionMode(false)
          return
        case 'Delete':
        case 'Backspace':
          e.preventDefault()
          editor.deleteSelected()
          return
        case 'ArrowLeft':
          e.preventDefault()
          editor.moveSelection(-1, 0, { coalesce: true, label: 'nudge' })
          return
        case 'ArrowRight':
          e.preventDefault()
          editor.moveSelection(1, 0, { coalesce: true, label: 'nudge' })
          return
        case 'ArrowUp':
          e.preventDefault()
          editor.moveSelection(0, -1, { coalesce: true, label: 'nudge' })
          return
        case 'ArrowDown':
          e.preventDefault()
          editor.moveSelection(0, 1, { coalesce: true, label: 'nudge' })
          return
        default:
          break
      }

      switch (key) {
        case 'r':
          // R clockwise, Shift+R counter-clockwise.
          editor.rotateSelection(e.shiftKey ? 'ccw' : 'cw')
          return
        case 'q':
          editor.rotateSelection('ccw')
          return
        case 's':
          setSelectionMode((v) => !v)
          return
        case 'h':
          editor.toggleHidden()
          return
        default:
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // Mount-only: the handler reads the current editor through `live`.
  }, [])

  const toggleSelectionMode = useCallback(() => setSelectionMode((v) => !v), [])

  /* State probe for the headless test harness, mirroring the __ARDUINIUM__
     hook the 3D workshop exposes. Read-only: the tests drive the editor
     through real DOM and keyboard events, not by calling into it. */
  useEffect(() => {
    window.__BC__ = () => {
      const e = live.current
      return {
        blocks: e.blocks.map((b) => ({
          id: b.id,
          x: b.x,
          y: b.y,
          w: b.w,
          h: b.h,
          rotation: b.rotation,
          color: b.color,
          z: b.z,
          locked: b.locked,
          hidden: b.hidden,
          label: b.label,
          props: { ...b.props },
        })),
        count: e.blocks.length,
        selected: [...e.selection.selected],
        activeId: e.selection.activeBlockId,
        viewport: { ...e.viewport.viewport },
        canUndo: e.history.canUndo,
        canRedo: e.history.canRedo,
        messages: e.messages.map((m) => m.text),
      }
    }
    window.__BC_EXPORT__ = () => live.current.exportToJSON()
    window.__BC_IMPORT__ = (data) => live.current.importFromJSON(data)
    return () => {
      delete window.__BC__
      delete window.__BC_EXPORT__
      delete window.__BC_IMPORT__
    }
  }, [])

  return (
    <div className="bc-app">
      <header className="bc-header">
        <h1>Block Canvas</h1>
        <p className="bc-sub">
          {editor.blocks.length} blocks · {editor.selectedBlocks.length} selected · history{' '}
          {editor.history.depth}/50
        </p>
      </header>

      <Toolbar
        editor={editor}
        selectionMode={selectionMode}
        onToggleSelectionMode={toggleSelectionMode}
      />

      <main className="bc-main">
        <BlockCanvas editor={editor} selectionMode={selectionMode} containerRef={containerRef} />
        <Inspector editor={editor} />
      </main>

      <footer className="bc-footer">
        <Legend />
      </footer>

      <div className="bc-toasts">
        {editor.messages.map((m) => (
          <div key={m.id} className={`bc-toast is-${m.tone}`}>
            {m.text}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Printed shortcut list — every binding the editor has, visible on screen. */
function Legend() {
  const items = [
    ['Click', 'select'],
    ['Shift+click', 'toggle'],
    ['S / Shift', 'marquee mode'],
    ['Drag', 'move · pan empty'],
    ['Alt+drag', 'duplicate'],
    ['Space/middle+drag', 'pan'],
    ['Ctrl+wheel', 'zoom'],
    ['R / Q', 'rotate'],
    ['Arrows', 'nudge'],
    ['Ctrl+A/C/V/D', 'all·copy·paste·dup'],
    ['Ctrl+Z / Ctrl+Y', 'undo · redo'],
    ['Ctrl+[ / Ctrl+]', 'back · front'],
    ['Ctrl+L / H', 'lock · hide'],
    ['Del', 'delete'],
    ['Esc', 'deselect'],
  ]
  return (
    <ul className="bc-legend">
      {items.map(([k, v]) => (
        <li key={k}>
          <kbd>{k}</kbd>
          <span>{v}</span>
        </li>
      ))}
    </ul>
  )
}
