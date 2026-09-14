import { useCallback, useRef, useState } from 'react'
import { HISTORY_LIMIT } from '../model.js'

/**
 * Snapshot-based undo/redo.
 *
 * Snapshot rather than command-pattern, on purpose. The command pattern only
 * pays for itself when snapshots are too big to hold — here a snapshot is one
 * array of a few hundred small immutable objects, and every mutation already
 * produces a fresh array. Storing the array *is* the cheapest possible undo
 * entry, and it makes every operation undoable for free: there is no risk of
 * someone adding a new mutation and forgetting to write its inverse.
 *
 * The stack holds the present at `index`; everything before is undo, after is
 * redo. Pushing a new entry truncates the redo tail, as expected.
 *
 * `coalesce` exists for continuous edits — dragging a colour picker or typing
 * in a text field would otherwise push 40 entries and bury the previous real
 * action. When the incoming label matches the top entry's label and coalescing
 * is on, we replace the top instead of pushing.
 */
export function useHistory(initial) {
  const [state, setState] = useState(() => ({
    stack: [initial],
    index: 0,
    label: 'init',
  }))

  // Mirror of the present kept in a ref so imperative callers (pointer
  // handlers, keyboard handlers) can read the current blocks without having to
  // list `present` as a dependency and get re-created every keystroke.
  const presentRef = useRef(initial)
  presentRef.current = state.stack[state.index]

  const commit = useCallback((next, label = 'edit', opts = {}) => {
    setState((s) => {
      const present = s.stack[s.index]
      const value = typeof next === 'function' ? next(present) : next
      if (value === present) return s

      // Replace the top entry instead of growing the stack.
      if (opts.coalesce && s.label === label && s.index > 0) {
        const stack = s.stack.slice(0, s.index + 1)
        stack[s.index] = value
        return { stack, index: s.index, label }
      }

      const stack = [...s.stack.slice(0, s.index + 1), value]
      // Drop the oldest entries once we exceed the cap.
      const overflow = Math.max(0, stack.length - HISTORY_LIMIT)
      return {
        stack: overflow ? stack.slice(overflow) : stack,
        index: (overflow ? stack.length - overflow : stack.length) - 1,
        label,
      }
    })
  }, [])

  const undo = useCallback(() => {
    setState((s) => (s.index > 0 ? { ...s, index: s.index - 1, label: 'undo' } : s))
  }, [])

  const redo = useCallback(() => {
    setState((s) =>
      s.index < s.stack.length - 1 ? { ...s, index: s.index + 1, label: 'redo' } : s,
    )
  }, [])

  /** Wipe history and start over — used by import, which is not undoable-into. */
  const reset = useCallback((value) => {
    setState({ stack: [value], index: 0, label: 'reset' })
  }, [])

  return {
    present: state.stack[state.index],
    presentRef,
    commit,
    undo,
    redo,
    reset,
    canUndo: state.index > 0,
    canRedo: state.index < state.stack.length - 1,
    depth: state.stack.length,
  }
}
