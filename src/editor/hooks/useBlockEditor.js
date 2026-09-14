import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useHistory } from './useHistory.js'
import { useSelection } from './useSelection.js'
import { useViewport } from './useViewport.js'
import {
  BLOCK_KINDS,
  GRID,
  alignBlocks,
  boundsOf,
  clampGroupMove,
  createBlock,
  deserialize,
  distributeBlocks,
  footprint,
  hasOverlaps,
  inBounds,
  isPlacementValid,
  nextId,
  normalizeZ,
  rectOf,
  reorderLayer,
  rotateGroupSafely,
  serialize,
  translateGroup,
} from '../model.js'

/**
 * The orchestrator.
 *
 * `useHistory` owns the blocks (so every mutation is undoable by construction),
 * `useSelection` owns what is highlighted, `useViewport` owns pan/zoom. This
 * hook is the only place they meet, and it exposes one flat API that the
 * components call. Components hold no editor state of their own beyond
 * transient pointer bookkeeping.
 *
 * The rule every operation below follows: compute the complete next array,
 * validate it as a whole, then commit once. Never partially apply a gesture —
 * a rotation that moves three of five blocks is worse than one that reports
 * it cannot fit.
 */
export function useBlockEditor(containerRef) {
  const [initial] = useState(makeStarterBlocks)
  const history = useHistory(initial)
  const selection = useSelection()
  const viewport = useViewport(containerRef)

  const blocks = history.present
  const blocksRef = history.presentRef

  /** Last grid cell the pointer was over — paste and "add" target this. */
  const cursorCell = useRef({ x: 2, y: 2 })
  /** Internal clipboard. Deliberately not the system clipboard: see copy(). */
  const clipboard = useRef(null)

  /* --------------------------------------------------------------- toasts */

  const [messages, setMessages] = useState([])
  const msgSeq = useRef(0)
  const timers = useRef(new Set())

  const notify = useCallback((text, tone = 'info') => {
    const id = ++msgSeq.current
    setMessages((m) => [...m.slice(-3), { id, text, tone }])
    const timer = setTimeout(() => {
      setMessages((m) => m.filter((x) => x.id !== id))
      timers.current.delete(timer)
    }, 2600)
    timers.current.add(timer)
  }, [])

  // Clear pending timers on unmount so a dismissed editor cannot setState.
  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const t of pending) clearTimeout(t)
      pending.clear()
    }
  }, [])

  /* ---------------------------------------------------------- derived sets */

  const byId = useMemo(() => new Map(blocks.map((b) => [b.id, b])), [blocks])

  const selectedBlocks = useMemo(
    () => blocks.filter((b) => selection.selected.has(b.id)),
    [blocks, selection.selected],
  )

  /** Locked blocks are inert: they cannot be moved, transformed or deleted. */
  const editableBlocks = useMemo(() => selectedBlocks.filter((b) => !b.locked), [selectedBlocks])

  const activeBlock = selection.activeBlockId ? byId.get(selection.activeBlockId) ?? null : null

  /** Bounding box of the whole selection, for the group outline. */
  const selectionBounds = useMemo(
    () => (selectedBlocks.length ? boundsOf(selectedBlocks) : null),
    [selectedBlocks],
  )

  /**
   * Warn once per gesture when a command was aimed at a selection that is
   * entirely locked — silence there reads as a broken button.
   */
  const guardLocked = useCallback(() => {
    if (!selectedBlocks.length) return false
    if (editableBlocks.length) return true
    notify('Selection is locked — Ctrl+L to unlock', 'warn')
    return false
  }, [selectedBlocks.length, editableBlocks.length, notify])

  /* ------------------------------------------------------------- mutations */

  const topZ = useCallback(() => blocks.reduce((m, b) => Math.max(m, b.z), -1), [blocks])

  /** Place a new block of the given kind, preferring the cell under the cursor. */
  const addBlock = useCallback(
    (kind, at) => {
      const spec = BLOCK_KINDS.find((k) => k.kind === kind) ?? BLOCK_KINDS[0]
      const target = at ?? cursorCell.current
      const all = blocksRef.current
      const draft = createBlock({
        kind: spec.kind,
        label: spec.label,
        w: spec.w,
        h: spec.h,
        color: spec.color,
        z: all.reduce((m, b) => Math.max(m, b.z), -1) + 1,
      })

      const spot = findFreeSpot(draft, all, target.x, target.y)
      if (!spot) {
        notify('No room for that block here', 'warn')
        return null
      }
      const placed = { ...draft, x: spot.x, y: spot.y }
      history.commit([...all, placed], 'add')
      selection.select(placed.id)
      return placed.id
    },
    [blocksRef, history, notify, selection],
  )

  /**
   * Patch one block by id.
   *
   * Geometry fields (x/y/w/h/rotation) are validated against the rest of the
   * board before committing, so the inspector can never produce an overlapping
   * or out-of-bounds board. Non-geometry fields skip the check entirely.
   */
  const updateBlock = useCallback(
    (id, patch, opts = {}) => {
      const all = blocksRef.current
      const current = all.find((b) => b.id === id)
      if (!current) return false
      if (current.locked && !('locked' in patch)) {
        notify('That block is locked', 'warn')
        return false
      }

      const next = { ...current, ...patch }
      const touchesGeometry = ['x', 'y', 'w', 'h', 'rotation'].some((k) => k in patch)
      if (touchesGeometry) {
        const f = footprint(next)
        // Clamp into the grid first — an inspector spinner should push the
        // block against the edge, not refuse the keystroke.
        next.x = Math.min(Math.max(0, next.x), GRID.cols - f.w)
        next.y = Math.min(Math.max(0, next.y), GRID.rows - f.h)
        if (!isPlacementValid(rectOf(next), all, new Set([id]))) {
          notify('That would overlap another block', 'warn')
          return false
        }
      }

      // The history label is always scoped by block id. Coalescing merges
      // consecutive edits sharing a label, so an unscoped label like "pos"
      // would fold an edit to one block into the previous edit to a different
      // one, and undo would then jump two blocks at once.
      history.commit(
        all.map((b) => (b.id === id ? next : b)),
        `${opts.label ?? 'edit'}:${id}`,
        { coalesce: opts.coalesce },
      )
      return true
    },
    [blocksRef, history, notify],
  )

  /** Apply a patch to every unlocked selected block (used by the toolbar). */
  const updateSelection = useCallback(
    (patch, opts = {}) => {
      if (!guardLocked()) return
      const ids = new Set(editableBlocks.map((b) => b.id))
      history.commit(
        blocksRef.current.map((b) => (ids.has(b.id) ? { ...b, ...patch } : b)),
        opts.label ?? 'edit-selection',
        { coalesce: opts.coalesce },
      )
    },
    [blocksRef, editableBlocks, guardLocked, history],
  )

  const deleteSelected = useCallback(() => {
    if (!guardLocked()) return
    const doomed = new Set(editableBlocks.map((b) => b.id))
    const remaining = blocksRef.current.filter((b) => !doomed.has(b.id))
    history.commit(normalizeZ(remaining), 'delete')
    selection.prune(new Set(remaining.map((b) => b.id)))
    notify(`Deleted ${doomed.size} block${doomed.size === 1 ? '' : 's'}`)
  }, [blocksRef, editableBlocks, guardLocked, history, notify, selection])

  /**
   * Move the selection by a whole number of cells.
   *
   * `clampGroupMove` slides the group as far as it legally can rather than
   * rejecting outright, which is what makes dragging into a wall feel right.
   */
  const moveSelection = useCallback(
    (dx, dy, opts = {}) => {
      if (!dx && !dy) return false
      if (!guardLocked()) return false

      // Computed inside the commit rather than from blocksRef, because this is
      // the one operation a user can fire faster than React re-renders. The
      // keyboard handler is a plain window listener, so React auto-batches its
      // updates: ten arrow presses in a single task would otherwise all read
      // the same stale positions and collapse into a single one-cell move.
      // Deriving from the committed `present` makes each move build on the last.
      const ids = new Set(editableBlocks.map((b) => b.id))
      history.commit(
        (present) => {
          const moving = present.filter((b) => ids.has(b.id))
          if (!moving.length) return present
          const clamped = clampGroupMove(moving, present, dx, dy)
          if (!clamped.dx && !clamped.dy) return present
          const moved = translateGroup(moving, present, clamped.dx, clamped.dy)
          if (!moved) return present
          const patch = new Map(moved.map((b) => [b.id, b]))
          return present.map((b) => patch.get(b.id) ?? b)
        },
        opts.label ?? 'move',
        { coalesce: opts.coalesce },
      )
      return true
    },
    [editableBlocks, guardLocked, history],
  )

  const rotateSelection = useCallback(
    (dir) => {
      if (!guardLocked()) return
      const all = blocksRef.current
      const turned = rotateGroupSafely(editableBlocks, all, dir)
      if (!turned) {
        notify('Not enough room to rotate', 'warn')
        return
      }
      const patch = new Map(turned.map((b) => [b.id, b]))
      history.commit(
        all.map((b) => patch.get(b.id) ?? b),
        'rotate',
      )
    },
    [blocksRef, editableBlocks, guardLocked, history, notify],
  )

  /* ------------------------------------------------------------- clipboard */

  /**
   * Copy to an internal clipboard rather than the system one.
   *
   * `navigator.clipboard.writeText` is async, permission-gated, and only
   * carries text — round-tripping blocks through it would mean JSON in the
   * user's OS clipboard and a permission prompt on paste. Canvas editors
   * conventionally keep their own, so Ctrl+C here does not clobber whatever
   * the user copied elsewhere.
   */
  const copySelection = useCallback(() => {
    if (!selectedBlocks.length) return
    const bb = boundsOf(selectedBlocks)
    // Store relative to the group's top-left so paste can land anywhere.
    clipboard.current = selectedBlocks.map((b) => ({ ...b, x: b.x - bb.x, y: b.y - bb.y }))
    notify(`Copied ${selectedBlocks.length} block${selectedBlocks.length === 1 ? '' : 's'}`)
  }, [notify, selectedBlocks])

  const pasteClipboard = useCallback(
    (at) => {
      const group = clipboard.current
      if (!group?.length) {
        notify('Clipboard is empty', 'warn')
        return
      }
      const all = blocksRef.current
      const target = at ?? cursorCell.current
      const base = all.reduce((m, b) => Math.max(m, b.z), -1) + 1
      const fresh = group.map((b, i) => ({ ...b, id: nextId(), z: base + i }))

      const placed = placeGroupAt(fresh, all, target.x, target.y)
      if (!placed) {
        notify('No room to paste there', 'warn')
        return
      }
      history.commit([...all, ...placed], 'paste')
      selection.select(placed.map((b) => b.id))
      notify(`Pasted ${placed.length} block${placed.length === 1 ? '' : 's'}`)
    },
    [blocksRef, history, notify, selection],
  )

  /**
   * Duplicate the selection at a +1/+1 offset (or wherever it fits nearby).
   * Returns the new ids so Alt+drag can immediately start dragging them.
   */
  const duplicateSelection = useCallback(
    (offset = { x: 1, y: 1 }) => {
      if (!selectedBlocks.length) return null
      const all = blocksRef.current
      const bb = boundsOf(selectedBlocks)
      const base = all.reduce((m, b) => Math.max(m, b.z), -1) + 1
      const fresh = selectedBlocks.map((b, i) => ({
        ...b,
        id: nextId(),
        x: b.x - bb.x,
        y: b.y - bb.y,
        z: base + i,
      }))

      const placed = placeGroupAt(fresh, all, bb.x + offset.x, bb.y + offset.y)
      if (!placed) {
        notify('No room to duplicate', 'warn')
        return null
      }
      history.commit([...all, ...placed], 'duplicate')
      const ids = placed.map((b) => b.id)
      selection.select(ids)
      return ids
    },
    [blocksRef, history, notify, selectedBlocks, selection],
  )

  /* ---------------------------------------------------- layers, lock, align */

  const setLayer = useCallback(
    (where) => {
      if (!guardLocked()) return
      const ids = new Set(editableBlocks.map((b) => b.id))
      history.commit(reorderLayer(blocksRef.current, ids, where), 'layer')
      notify(where === 'front' ? 'Brought to front' : 'Sent to back')
    },
    [blocksRef, editableBlocks, guardLocked, history, notify],
  )

  /**
   * Lock toggles on the whole selection, including already-locked members —
   * this is the one command that must bypass the locked guard, or unlocking
   * would be impossible from the keyboard.
   */
  const toggleLock = useCallback(() => {
    if (!selectedBlocks.length) return
    const ids = new Set(selectedBlocks.map((b) => b.id))
    const locking = selectedBlocks.some((b) => !b.locked)
    history.commit(
      blocksRef.current.map((b) => (ids.has(b.id) ? { ...b, locked: locking } : b)),
      'lock',
    )
    notify(locking ? 'Locked' : 'Unlocked')
  }, [blocksRef, history, notify, selectedBlocks])

  const toggleHidden = useCallback(() => {
    if (!guardLocked()) return
    const ids = new Set(editableBlocks.map((b) => b.id))
    const hiding = editableBlocks.some((b) => !b.hidden)
    history.commit(
      blocksRef.current.map((b) => (ids.has(b.id) ? { ...b, hidden: hiding } : b)),
      'hide',
    )
  }, [blocksRef, editableBlocks, guardLocked, history])

  /**
   * Shared tail for align/distribute: validate the whole result, then commit.
   *
   * Unlike a move, these rearrange blocks relative to each other, so it is not
   * enough to test each one against the blocks that stayed put — the moved
   * blocks can just as easily land on top of one another. (Aligning a whole
   * selection to its left edge does exactly that.) So the resulting board is
   * assembled first and checked as a whole.
   */
  const applyArrangement = useCallback(
    (next, label) => {
      const all = blocksRef.current
      const patch = new Map(next.map((b) => [b.id, b]))
      const board = all.map((b) => patch.get(b.id) ?? b)

      if (next.some((b) => !inBounds(rectOf(b))) || hasOverlaps(board)) {
        notify('That arrangement would overlap', 'warn')
        return
      }
      history.commit(board, label)
    },
    [blocksRef, history, notify],
  )

  const align = useCallback(
    (mode) => {
      if (!guardLocked()) return
      if (editableBlocks.length < 2) {
        notify('Select two or more blocks to align', 'warn')
        return
      }
      applyArrangement(alignBlocks(editableBlocks, mode), 'align')
    },
    [applyArrangement, editableBlocks, guardLocked, notify],
  )

  const distribute = useCallback(
    (axis) => {
      if (!guardLocked()) return
      if (editableBlocks.length < 3) {
        notify('Select three or more blocks to distribute', 'warn')
        return
      }
      applyArrangement(distributeBlocks(editableBlocks, axis), 'distribute')
    },
    [applyArrangement, editableBlocks, guardLocked, notify],
  )

  /* ------------------------------------------------------------- selection */

  const selectAll = useCallback(() => {
    const unlocked = blocksRef.current.filter((b) => !b.locked).map((b) => b.id)
    selection.select(unlocked)
    notify(`Selected ${unlocked.length}`)
  }, [blocksRef, notify, selection])

  /* --------------------------------------------------------- serialization */

  const exportToJSON = useCallback(
    () => serialize(blocksRef.current, viewport.viewportRef.current),
    [blocksRef, viewport.viewportRef],
  )

  const importFromJSON = useCallback(
    (data) => {
      try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data
        const { blocks: next, viewport: vp, skipped } = deserialize(parsed)
        // Import replaces the world, so it resets history rather than pushing
        // onto it — undoing "into" a different document is not meaningful.
        history.reset(next)
        viewport.setViewport(vp)
        selection.clear()
        notify(
          skipped.length
            ? `Loaded ${next.length} blocks, skipped ${skipped.length} invalid`
            : `Loaded ${next.length} blocks`,
          skipped.length ? 'warn' : 'good',
        )
        return true
      } catch (err) {
        notify(`Import failed: ${err.message}`, 'warn')
        return false
      }
    },
    [history, notify, selection, viewport],
  )

  const clearCanvas = useCallback(() => {
    history.commit([], 'clear')
    selection.clear()
  }, [history, selection])

  return {
    // state
    blocks,
    blocksRef,
    byId,
    selectedBlocks,
    editableBlocks,
    activeBlock,
    selectionBounds,
    messages,
    cursorCell,
    hasClipboard: () => Boolean(clipboard.current?.length),

    // composed hooks
    selection,
    viewport,
    history,

    // operations
    addBlock,
    updateBlock,
    updateSelection,
    deleteSelected,
    moveSelection,
    rotateSelection,
    copySelection,
    pasteClipboard,
    duplicateSelection,
    setLayer,
    toggleLock,
    toggleHidden,
    align,
    distribute,
    selectAll,
    exportToJSON,
    importFromJSON,
    clearCanvas,
    notify,
  }
}

/* ------------------------------------------------------------------ helpers */

/**
 * Offsets to try when a group will not fit exactly where it was asked to go,
 * ordered by increasing ring so the result lands as close as possible to the
 * requested spot. Generated once at module load, not per call.
 */
const SEARCH_OFFSETS = (() => {
  const out = [[0, 0]]
  for (let r = 1; r <= 14; r++) {
    for (let d = -r; d <= r; d++) {
      out.push([d, -r], [d, r], [-r, d], [r, d])
    }
  }
  return out
})()

/** First legal position for a single block at or near (tx, ty). */
function findFreeSpot(block, all, tx, ty) {
  const f = footprint(block)
  for (const [ox, oy] of SEARCH_OFFSETS) {
    const x = Math.min(Math.max(0, tx + ox), GRID.cols - f.w)
    const y = Math.min(Math.max(0, ty + oy), GRID.rows - f.h)
    if (isPlacementValid({ x, y, w: f.w, h: f.h }, all, new Set([block.id]))) return { x, y }
  }
  return null
}

/**
 * Drop a group (already normalised so its bounding box starts at 0,0) with its
 * top-left at (tx, ty), searching outward for the nearest position where every
 * member fits. Relative offsets are preserved exactly.
 */
function placeGroupAt(group, all, tx, ty) {
  const ids = new Set(group.map((b) => b.id))
  const bb = boundsOf(group)
  for (const [ox, oy] of SEARCH_OFFSETS) {
    const x = Math.min(Math.max(0, tx + ox), GRID.cols - bb.w)
    const y = Math.min(Math.max(0, ty + oy), GRID.rows - bb.h)
    const candidate = group.map((b) => ({ ...b, x: b.x + x, y: b.y + y }))
    if (candidate.every((b) => isPlacementValid(rectOf(b), all, ids))) return candidate
  }
  return null
}

/** A small starting arrangement, so the canvas is never a blank void. */
function makeStarterBlocks() {
  const seed = [
    { kind: 'wall', label: 'Wall', x: 2, y: 2, w: 6, h: 1, color: '#4d6070' },
    { kind: 'beam', label: 'Beam', x: 2, y: 4, w: 4, h: 1, color: '#23a06a' },
    { kind: 'plate', label: 'Plate', x: 9, y: 3, w: 3, h: 2, color: '#ef8b2c' },
    { kind: 'block', label: 'Block', x: 14, y: 2, w: 2, h: 2, color: '#7b5ed6' },
    { kind: 'pad', label: 'Pad', x: 4, y: 8, w: 4, h: 3, color: '#1c9aa8' },
    { kind: 'tile', label: 'Tile', x: 12, y: 8, w: 1, h: 1, color: '#2f6fd9' },
  ]
  return seed.map((s, i) => createBlock({ ...s, z: i }))
}
