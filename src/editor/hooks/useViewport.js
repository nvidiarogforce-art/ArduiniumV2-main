import { useCallback, useEffect, useRef, useState } from 'react'
import { GRID, ZOOM } from '../model.js'

/**
 * Pan and zoom.
 *
 * The viewport is a similarity transform: screen = world * scale + offset.
 * Everything on the canvas is laid out once in world pixels (cell * CELL) and
 * then moved by a single CSS transform on the parent, so panning and zooming
 * never touch a single block's own styles — the browser composites the whole
 * layer.
 *
 * `viewportRef` mirrors state for pointer/wheel handlers, which must read the
 * live value without re-subscribing on every frame.
 */
export function useViewport(containerRef) {
  const [viewport, setViewport] = useState({ x: 40, y: 40, scale: 1 })
  const viewportRef = useRef(viewport)
  viewportRef.current = viewport

  /** True while space is held or a middle-drag is active — used for cursors. */
  const [panReady, setPanReady] = useState(false)
  const panning = useRef(null)

  /** Screen (client) point -> world pixel point. */
  const toWorld = useCallback(
    (clientX, clientY) => {
      const rect = containerRef.current?.getBoundingClientRect()
      const vp = viewportRef.current
      const sx = clientX - (rect?.left ?? 0)
      const sy = clientY - (rect?.top ?? 0)
      return { x: (sx - vp.x) / vp.scale, y: (sy - vp.y) / vp.scale }
    },
    [containerRef],
  )

  /** Screen point -> grid cell (floored, so it names the cell you are over). */
  const toCell = useCallback(
    (clientX, clientY) => {
      const w = toWorld(clientX, clientY)
      return { x: Math.floor(w.x / GRID.cell), y: Math.floor(w.y / GRID.cell) }
    },
    [toWorld],
  )

  /**
   * Zoom about a focal point.
   *
   * Keep the world point under the cursor pinned: solve for the offset that
   * leaves it at the same screen position after the scale change.
   *
   *   world = (screen - offset) / scale          (before)
   *   offset' = screen - world * scale'          (after)
   */
  const zoomAt = useCallback(
    (clientX, clientY, factor) => {
      const rect = containerRef.current?.getBoundingClientRect()
      setViewport((vp) => {
        const scale = Math.min(ZOOM.max, Math.max(ZOOM.min, vp.scale * factor))
        if (scale === vp.scale) return vp
        const sx = clientX - (rect?.left ?? 0)
        const sy = clientY - (rect?.top ?? 0)
        const wx = (sx - vp.x) / vp.scale
        const wy = (sy - vp.y) / vp.scale
        return { x: sx - wx * scale, y: sy - wy * scale, scale }
      })
    },
    [containerRef],
  )

  /** Zoom about the centre of the viewport — for the toolbar buttons. */
  const zoomBy = useCallback(
    (factor) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor)
    },
    [containerRef, zoomAt],
  )

  const resetView = useCallback(() => setViewport({ x: 40, y: 40, scale: 1 }), [])

  /** Centre the grid in the container at a scale that fits it. */
  const fitView = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const pad = 48
    const scale = Math.min(
      ZOOM.max,
      Math.max(
        ZOOM.min,
        Math.min(
          (rect.width - pad * 2) / (GRID.cols * GRID.cell),
          (rect.height - pad * 2) / (GRID.rows * GRID.cell),
        ),
      ),
    )
    setViewport({
      x: (rect.width - GRID.cols * GRID.cell * scale) / 2,
      y: (rect.height - GRID.rows * GRID.cell * scale) / 2,
      scale,
    })
  }, [containerRef])

  const beginPan = useCallback((clientX, clientY) => {
    panning.current = { sx: clientX, sy: clientY, ox: viewportRef.current.x, oy: viewportRef.current.y }
  }, [])

  const movePan = useCallback((clientX, clientY) => {
    const p = panning.current
    if (!p) return false
    // Pan is in screen pixels: the offset moves 1:1 with the pointer at any
    // zoom level, which is what makes dragging the canvas feel "attached".
    setViewport((vp) => ({ ...vp, x: p.ox + (clientX - p.sx), y: p.oy + (clientY - p.sy) }))
    return true
  }, [])

  const endPan = useCallback(() => {
    const was = panning.current !== null
    panning.current = null
    return was
  }, [])

  const isPanning = useCallback(() => panning.current !== null, [])

  /* Space-to-pan. Tracked here rather than in the global key handler so the
     cursor affordance and the gesture live in one place. Note the keyup
     listener is on window, not the container: if you release space while the
     pointer has left the canvas we still need to hear about it, otherwise the
     editor stays stuck in pan mode. */
  useEffect(() => {
    const isTyping = (e) => {
      const tag = e.target?.tagName
      return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || e.target?.isContentEditable
    }
    const down = (e) => {
      if (e.code === 'Space' && !isTyping(e)) {
        e.preventDefault() // stop the page scrolling under us
        setPanReady(true)
      }
    }
    const up = (e) => {
      if (e.code === 'Space') setPanReady(false)
    }
    // A blur while space is held would otherwise leave panReady stuck on.
    const blur = () => setPanReady(false)

    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  /* Ctrl + wheel to zoom.

     Registered natively with { passive: false } because React's synthetic
     wheel handler is passive — preventDefault() there is ignored and the
     browser runs its own page zoom instead. */
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? ZOOM.step : 1 / ZOOM.step)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [containerRef, zoomAt])

  return {
    viewport,
    viewportRef,
    setViewport,
    toWorld,
    toCell,
    zoomAt,
    zoomBy,
    resetView,
    fitView,
    panReady,
    beginPan,
    movePan,
    endPan,
    isPanning,
  }
}
