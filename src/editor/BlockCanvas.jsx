import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GRID, cellsOf, footprint, isPlacementValid, rectOf, rectsOverlap } from './model.js'

/**
 * The canvas surface: grid, blocks, marquee, drag preview, group outline.
 *
 * All pointer gestures live here and run through one small state machine held
 * in `gesture` (a ref, not state — it changes on every pointerdown and must
 * not trigger a render). The modes are:
 *
 *   pan      — space+drag, middle-drag, or plain drag on empty space
 *   marquee  — drag on empty space while in selection mode
 *   drag     — moving the current selection
 *
 * Performance note, since this is where a naive implementation dies: a
 * pointermove fires at screen refresh rate, but blocks only ever sit on whole
 * cells. So the drag path converts to cell coordinates first and calls
 * setState *only when the integer cell delta changes*. Moving the mouse across
 * one 28px cell produces one render, not thirty. The marquee is the exception —
 * it genuinely is a per-pixel rectangle — so it is isolated in its own state
 * inside useSelection and read by exactly one absolutely-positioned div.
 */
export default function BlockCanvas({ editor, selectionMode, containerRef }) {
  const { blocks, blocksRef, selection, viewport, selectionBounds, cursorCell } = editor
  const { selected, activeBlockId } = selection

  /**
   * Live cell offset of the in-progress drag.
   *
   * Mirrored into a ref because the pointerup listener is registered once and
   * cannot read current state — and because committing the drop from inside a
   * setState updater would double-apply under StrictMode.
   */
  const [dragDelta, setDragDelta] = useState(null)
  const dragDeltaRef = useRef(null)
  const gesture = useRef(null)

  /**
   * Latest props/hooks for the window listeners to read.
   *
   * The listeners below are registered once for the lifetime of the canvas, so
   * they must not close over values that change each render — `selection` in
   * particular gets a new identity on every marquee pixel. Refreshing this ref
   * during render keeps them reading current values with zero re-registration.
   */
  const live = useRef(null)
  live.current = { editor, selection, viewport, blocksRef, containerRef }

  /* --------------------------------------------------------- hit testing */

  /** Topmost block covering a cell — z order decides, matching what you see. */
  const blockAtCell = useCallback(
    (cx, cy) => {
      let hit = null
      for (const b of blocksRef.current) {
        if (b.hidden) continue
        const r = rectOf(b)
        if (cx >= r.x && cx < r.x + r.w && cy >= r.y && cy < r.y + r.h) {
          if (!hit || b.z > hit.z) hit = b
        }
      }
      return hit
    },
    [blocksRef],
  )

  /* ------------------------------------------------------------ gestures */

  const onPointerDown = useCallback(
    (e) => {
      // Only the primary button starts a selection/drag; middle always pans.
      if (e.button !== 0 && e.button !== 1) return
      const cell = viewport.toCell(e.clientX, e.clientY)
      const wantsPan = e.button === 1 || viewport.panReady

      if (wantsPan) {
        viewport.beginPan(e.clientX, e.clientY)
        gesture.current = { mode: 'pan' }
        e.preventDefault()
        return
      }

      const hit = blockAtCell(cell.x, cell.y)

      if (!hit) {
        // Empty space. In selection mode we rubber-band; otherwise we pan,
        // which gives plain drag something useful to do on a bounded board.
        if (selectionMode || e.shiftKey) {
          const rect = containerRef.current.getBoundingClientRect()
          selection.beginMarquee(e.clientX - rect.left, e.clientY - rect.top)
          gesture.current = { mode: 'marquee', additive: e.shiftKey }
        } else {
          selection.clear()
          viewport.beginPan(e.clientX, e.clientY)
          gesture.current = { mode: 'pan' }
        }
        return
      }

      // Shift+click toggles one block's membership and starts no drag — you
      // are building a set, not moving it.
      if (e.shiftKey) {
        selection.toggle(hit.id)
        gesture.current = null
        return
      }

      // Clicking a block that is already part of the selection keeps the
      // selection intact so the whole group can be dragged. Clicking a block
      // outside it replaces the selection.
      if (!selected.has(hit.id)) selection.select(hit.id)
      else selection.setActiveBlockId(hit.id)

      gesture.current = {
        mode: 'drag',
        startCell: cell,
        // Alt+drag duplicates. The copies are made on drop, not on the first
        // movement: duplicating up-front would need the copies to sit exactly
        // on top of the originals, which the no-overlap invariant forbids, so
        // they would be shoved to some arbitrary nearby free spot instead.
        // Dropping a copy at the drag offset leaves the originals in place and
        // never puts the board in an illegal state.
        duplicate: e.altKey,
      }
    },
    [blockAtCell, containerRef, selected, selection, selectionMode, viewport],
  )

  /* Window-level move/up so a gesture survives the pointer leaving the canvas.
     Registered once on mount and guarded by the ref, rather than added and
     removed per gesture — one listener pair, no churn, nothing to leak. */
  useEffect(() => {
    const onMove = (e) => {
      const g = gesture.current
      if (!g) return
      const { selection, viewport, containerRef } = live.current

      if (g.mode === 'pan') {
        viewport.movePan(e.clientX, e.clientY)
        return
      }

      if (g.mode === 'marquee') {
        const rect = containerRef.current?.getBoundingClientRect()
        if (rect) selection.moveMarquee(e.clientX - rect.left, e.clientY - rect.top)
        return
      }

      if (g.mode === 'drag') {
        const cell = viewport.toCell(e.clientX, e.clientY)
        const dx = cell.x - g.startCell.x
        const dy = cell.y - g.startCell.y

        // The one render-rate guard that matters: bail out unless the whole-
        // cell delta actually changed. Pixel moves within a cell are free.
        const prev = dragDeltaRef.current
        if (prev?.dx === dx && prev?.dy === dy) return
        const next = dx || dy ? { dx, dy } : null
        dragDeltaRef.current = next
        setDragDelta(next)
      }
    }

    const onUp = () => {
      const g = gesture.current
      gesture.current = null
      if (!g) return
      const { editor, selection, viewport } = live.current

      if (g.mode === 'pan') {
        viewport.endPan()
        return
      }

      if (g.mode === 'marquee') {
        commitMarquee(g.additive)
        selection.endMarquee()
        return
      }

      if (g.mode === 'drag') {
        // Read the delta from the ref, never from inside a setState updater:
        // React may invoke an updater more than once (StrictMode does exactly
        // that in development), which would apply the move twice.
        const delta = dragDeltaRef.current
        dragDeltaRef.current = null
        setDragDelta(null)

        if (delta && (delta.dx || delta.dy)) {
          if (g.duplicate) {
            // Leave the originals; drop copies at the drag offset.
            editor.duplicateSelection({ x: delta.dx, y: delta.dy })
          } else {
            // moveSelection clamps: if the raw drop spot is blocked the group
            // slides as far as it legally can rather than snapping back.
            editor.moveSelection(delta.dx, delta.dy)
          }
        }
      }
    }

    // Marquee commit reads the rectangle from a ref rather than state, since
    // this listener is never re-created and would otherwise see a stale value.
    const commitMarquee = (additive) => {
      const { selection, viewport, blocksRef } = live.current
      const rect = selection.marqueeRef.current
      if (!rect || (rect.w < 2 && rect.h < 2)) return

      // Screen rect -> world pixels -> fractional cells. Fractional is right:
      // a marquee that clips half a cell should still catch that block.
      const vp = viewport.viewportRef.current
      const x0 = (rect.x - vp.x) / vp.scale / GRID.cell
      const y0 = (rect.y - vp.y) / vp.scale / GRID.cell
      const box = {
        x: x0,
        y: y0,
        w: rect.w / vp.scale / GRID.cell,
        h: rect.h / vp.scale / GRID.cell,
      }

      // Locked and hidden blocks are skipped, matching Ctrl+A. A locked block
      // is still selectable by clicking it directly, so it can be unlocked.
      const caught = blocksRef.current
        .filter((b) => !b.locked && !b.hidden && rectsOverlap(box, rectOf(b)))
        .map((b) => b.id)

      if (caught.length || !additive) selection.select(caught, { additive })
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    // Intentionally mount-only: every value these handlers need is read
    // through `live`, so re-registering on state changes would be pure churn.
  }, [])

  /** Track the hovered cell so paste and "add block" know where to aim. */
  const onPointerMove = useCallback(
    (e) => {
      const cell = viewport.toCell(e.clientX, e.clientY)
      cursorCell.current = cell
    },
    [cursorCell, viewport],
  )

  /* ------------------------------------------------------- drag preview */

  /**
   * Cells the dragged group would land on, and whether that landing is legal.
   * Green means it fits; red means it overlaps something or leaves the grid.
   */
  const preview = useMemo(() => {
    if (!dragDelta) return null
    const moving = editor.editableBlocks
    if (!moving.length) return null

    const ghosts = moving.map((b) => ({ ...b, x: b.x + dragDelta.dx, y: b.y + dragDelta.dy }))
    const ids = new Set(ghosts.map((b) => b.id))
    const valid = ghosts.every((b) => isPlacementValid(rectOf(b), blocks, ids))
    const cells = ghosts.flatMap((b) => cellsOf(rectOf(b)))
    return { cells, valid }
  }, [blocks, dragDelta, editor.editableBlocks])

  /** Blocks paint in z order, so the DOM matches the visual stack. */
  const ordered = useMemo(() => [...blocks].sort((a, b) => a.z - b.z), [blocks])

  const { viewport: vp } = viewport
  const worldStyle = {
    transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.scale})`,
    width: GRID.cols * GRID.cell,
    height: GRID.rows * GRID.cell,
  }

  const cursor = viewport.panReady ? 'grab' : selectionMode ? 'crosshair' : 'default'

  return (
    <div
      className="bc-viewport"
      ref={containerRef}
      style={{ cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onContextMenu={(e) => e.preventDefault()}
      data-testid="block-canvas"
    >
      <div className="bc-world" style={worldStyle}>
        <div className="bc-grid" style={{ backgroundSize: `${GRID.cell}px ${GRID.cell}px` }} />

        {/* Landing-zone highlight, drawn under the blocks so the ghosts stay
            readable on top of it. */}
        {preview && (
          <div className={`bc-preview ${preview.valid ? 'is-valid' : 'is-invalid'}`}>
            {preview.cells.map((key) => {
              const [cx, cy] = key.split(',').map(Number)
              return (
                <span
                  key={key}
                  className="bc-preview-cell"
                  style={{
                    left: cx * GRID.cell,
                    top: cy * GRID.cell,
                    width: GRID.cell,
                    height: GRID.cell,
                  }}
                />
              )
            })}
          </div>
        )}

        {ordered.map((b) => (
          <BlockView
            key={b.id}
            block={b}
            selected={selected.has(b.id)}
            active={b.id === activeBlockId}
            drag={selected.has(b.id) && !b.locked ? dragDelta : null}
          />
        ))}

        {/* One outline around the whole selection, so a group reads as a unit
            rather than as n independent highlights. */}
        {selectionBounds && selected.size > 1 && (
          <div
            className="bc-group-outline"
            style={{
              left: (selectionBounds.x + (dragDelta?.dx ?? 0)) * GRID.cell,
              top: (selectionBounds.y + (dragDelta?.dy ?? 0)) * GRID.cell,
              width: selectionBounds.w * GRID.cell,
              height: selectionBounds.h * GRID.cell,
            }}
          />
        )}
      </div>

      <Marquee selection={selection} />
    </div>
  )
}

/**
 * The rubber-band rectangle.
 *
 * The marquee updates per pixel, so this canvas does re-render on every
 * pointermove during a rubber-band drag. What that costs is bounded by
 * BlockView being memoised: the parent re-renders, but no block repaints
 * unless its own appearance changed.
 */
function Marquee({ selection }) {
  const { marquee } = selection
  if (!marquee) return null
  return (
    <div
      className="bc-marquee"
      style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }}
    />
  )
}

/**
 * One block.
 *
 * Memoised on the fields that actually affect its appearance. Without this,
 * dragging a two-block selection across a hundred-block board would re-render
 * all hundred on every cell step; with it, only the two that moved repaint.
 */
const BlockView = memo(function BlockView({ block, selected, active, drag }) {
  const f = footprint(block)
  const dx = drag?.dx ?? 0
  const dy = drag?.dy ?? 0

  const classes = [
    'bc-block',
    selected && 'is-selected',
    active && 'is-active',
    block.locked && 'is-locked',
    block.hidden && 'is-hidden',
    drag && 'is-dragging',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={classes}
      data-block-id={block.id}
      style={{
        left: (block.x + dx) * GRID.cell,
        top: (block.y + dy) * GRID.cell,
        width: f.w * GRID.cell,
        height: f.h * GRID.cell,
        background: block.color,
        zIndex: block.z + 1,
      }}
    >
      {/* Orientation marker. The footprint alone cannot show a 180° turn, so
          a rotating chevron carries the block's actual heading. */}
      <span className="bc-block-nose" style={{ transform: `rotate(${block.rotation}deg)` }}>
        ▲
      </span>
      {block.label && <span className="bc-block-label">{block.label}</span>}
      {block.locked && <span className="bc-block-badge">🔒</span>}
    </div>
  )
})
