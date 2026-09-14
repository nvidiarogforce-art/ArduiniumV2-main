'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Interactive perfboard layer for the hero.
 *
 * source: 21st.dev "ripple-grid", adapted. Three deliberate changes from the
 * supplied version:
 *
 *  1. It is a background layer sized to its container, not a centred
 *     `min-h-screen` demo grid with visible cell borders. Cells are invisible
 *     until a signal reaches them.
 *  2. Propagation is driven by CSS `animation-delay` rather than one
 *     `setTimeout` per cell. The original scheduled a timer for every cell on
 *     every click — ~500 timers per interaction at hero size, all of which had
 *     to be cleaned up on unmount. This schedules one.
 *  3. Colours come from §4.1 (teal signal, orange LED) instead of the
 *     component's default white/black/#76cefa.
 *
 * The metaphor is the point: clicking the board propagates a signal outward
 * through the holes, which is the same thing the product itself teaches.
 */
export function RippleGrid({
  cellSize = 46,
  className,
  autoPulse = true,
}: {
  cellSize?: number
  className?: string
  autoPulse?: boolean
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const clearRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [grid, setGrid] = useState({ cols: 0, rows: 0 })

  // Cell count follows the container, so the grid stays on a fixed physical
  // pitch at every breakpoint instead of stretching.
  useEffect(() => {
    const el = hostRef.current
    if (!el) return

    const measure = () => {
      const { width, height } = el.getBoundingClientRect()
      setGrid({
        cols: Math.max(1, Math.ceil(width / cellSize)),
        rows: Math.max(1, Math.ceil(height / cellSize)),
      })
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [cellSize])

  const ripple = useCallback(
    (originCol: number, originRow: number) => {
      const el = hostRef.current
      if (!el) return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      const cells = el.querySelectorAll<HTMLElement>('[data-cell]')
      let maxDelay = 0

      cells.forEach((cell) => {
        const col = Number(cell.dataset.col)
        const row = Number(cell.dataset.row)
        // Manhattan distance, as in the source component — it produces the
        // diamond wavefront that reads as a signal rather than a spotlight.
        const delay = (Math.abs(col - originCol) + Math.abs(row - originRow)) * 26
        maxDelay = Math.max(maxDelay, delay)
        cell.style.setProperty('--ard-ripple-delay', `${delay}ms`)
        cell.classList.remove('is-lit')
        // Force a reflow so re-triggering mid-animation restarts it instead of
        // being ignored as a no-op class toggle.
        void cell.offsetWidth
        cell.classList.add('is-lit')
      })

      if (clearRef.current) clearTimeout(clearRef.current)
      clearRef.current = setTimeout(() => {
        cells.forEach((c) => c.classList.remove('is-lit'))
      }, maxDelay + 760)
    },
    [],
  )

  // One ripple shortly after mount, so the hero visibly advertises that the
  // board responds to touch before anyone reads the hint text.
  useEffect(() => {
    if (!autoPulse || !grid.cols) return
    const id = setTimeout(() => ripple(Math.floor(grid.cols / 2), Math.floor(grid.rows / 2)), 850)
    return () => clearTimeout(id)
  }, [autoPulse, grid.cols, grid.rows, ripple])

  useEffect(() => () => void (clearRef.current && clearTimeout(clearRef.current)), [])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    ripple(
      Math.floor((e.clientX - rect.left) / cellSize),
      Math.floor((e.clientY - rect.top) / cellSize),
    )
  }

  return (
    <div
      ref={hostRef}
      onPointerDown={onPointerDown}
      aria-hidden
      className={cn('ard-ripple absolute inset-0 overflow-hidden', className)}
      style={{
        gridTemplateColumns: `repeat(${grid.cols}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${grid.rows}, ${cellSize}px)`,
      }}
    >
      {Array.from({ length: grid.cols * grid.rows }, (_, i) => {
        const row = Math.floor(i / grid.cols)
        const col = i % grid.cols
        return <span key={i} data-cell data-col={col} data-row={row} />
      })}
    </div>
  )
}
