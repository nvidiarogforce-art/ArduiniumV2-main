import { useCallback, useMemo, useRef, useState } from 'react'

/**
 * Selection state.
 *
 * One `Set` of ids is the whole truth. `activeBlockId` is derived — it is the
 * block the inspector focuses on, which is the most recently touched member of
 * the selection. Keeping it derived rather than stored removes the classic bug
 * where the inspector shows a block that is no longer selected.
 *
 * Every setter produces a NEW Set. Mutating one in place would keep the same
 * reference and skip re-renders in anything comparing by identity.
 */
export function useSelection() {
  const [selected, setSelected] = useState(() => new Set())
  const [activeBlockId, setActiveBlockId] = useState(null)

  const selectedRef = useRef(selected)
  selectedRef.current = selected
  const activeRef = useRef(activeBlockId)
  activeRef.current = activeBlockId

  const select = useCallback((ids, { additive = false } = {}) => {
    const list = Array.isArray(ids) ? ids : [ids]
    setSelected((prev) => {
      const next = additive ? new Set(prev) : new Set()
      for (const id of list) next.add(id)
      return next
    })
    setActiveBlockId(list.length ? list[list.length - 1] : null)
  }, [])

  /** Shift+click semantics: flip one block's membership. */
  const toggle = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        // Hand the inspector to some other member rather than blanking it.
        setActiveBlockId((cur) => (cur === id ? (next.values().next().value ?? null) : cur))
      } else {
        next.add(id)
        setActiveBlockId(id)
      }
      return next
    })
  }, [])

  const clear = useCallback(() => {
    setSelected((prev) => (prev.size ? new Set() : prev))
    setActiveBlockId(null)
  }, [])

  /**
   * Drop ids that no longer exist — called after a delete or an import.
   * Returns the same Set when nothing changed so React can bail out.
   */
  const prune = useCallback((existing) => {
    setSelected((prev) => {
      let changed = false
      const next = new Set()
      for (const id of prev) {
        if (existing.has(id)) next.add(id)
        else changed = true
      }
      return changed ? next : prev
    })
    setActiveBlockId((cur) => (cur && existing.has(cur) ? cur : null))
  }, [])

  /* ------------------------------------------------------------- marquee */

  /**
   * The marquee rectangle in *screen* pixels, relative to the canvas element.
   *
   * This is intentionally the one piece of state the canvas re-renders on
   * during a drag: the rectangle changes every pointermove, and there is
   * nothing to derive from it until the gesture ends. Blocks themselves do not
   * subscribe to it — only the single absolutely-positioned marquee div reads
   * it — so a marquee drag repaints one element, not the board.
   */
  const [marquee, setMarquee] = useState(null)
  const marqueeStart = useRef(null)
  /**
   * Mirror of the rectangle. The commit step runs inside a pointerup listener
   * that must not be re-registered on every mousemove, so it reads the live
   * rectangle from here instead of closing over the state value.
   */
  const marqueeRef = useRef(null)

  const beginMarquee = useCallback((x, y) => {
    marqueeStart.current = { x, y }
    marqueeRef.current = { x, y, w: 0, h: 0 }
    setMarquee(marqueeRef.current)
  }, [])

  const moveMarquee = useCallback((x, y) => {
    const s = marqueeStart.current
    if (!s) return null
    // Normalise so dragging up/left produces a positive-extent rectangle.
    const rect = {
      x: Math.min(s.x, x),
      y: Math.min(s.y, y),
      w: Math.abs(x - s.x),
      h: Math.abs(y - s.y),
    }
    marqueeRef.current = rect
    setMarquee(rect)
    return rect
  }, [])

  const endMarquee = useCallback(() => {
    marqueeStart.current = null
    marqueeRef.current = null
    setMarquee(null)
  }, [])

  const isMarqueeing = useCallback(() => marqueeStart.current !== null, [])

  const api = useMemo(
    () => ({
      selected,
      selectedRef,
      activeBlockId,
      setActiveBlockId,
      select,
      toggle,
      clear,
      prune,
      marquee,
      marqueeRef,
      beginMarquee,
      moveMarquee,
      endMarquee,
      isMarqueeing,
    }),
    [
      selected,
      activeBlockId,
      select,
      toggle,
      clear,
      prune,
      marquee,
      beginMarquee,
      moveMarquee,
      endMarquee,
      isMarqueeing,
    ],
  )

  return api
}
