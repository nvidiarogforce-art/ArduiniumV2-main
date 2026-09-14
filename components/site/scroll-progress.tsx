'use client'

import { useEffect, useRef } from 'react'

/**
 * A thin orange bar across the top that fills as the page scrolls.
 *
 * Written straight to the DOM inside one rAF rather than through React state:
 * this updates on every scroll frame, and re-rendering the tree that often
 * would be the most expensive thing on the page.
 *
 * It used to also retime the marquee from scroll velocity. That is now the
 * Ticker's own job, because doing it by rewriting a CSS `animation-duration`
 * made the strip jump on every change — see the note in ticker.tsx.
 */
export function ScrollProgress() {
  const bar = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let ticking = false
    let lastY = window.scrollY
    let vel = 0

    const frame = () => {
      ticking = false
      const y = window.scrollY
      const max = document.documentElement.scrollHeight - window.innerHeight
      if (bar.current) {
        bar.current.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`
      }
      vel = Math.min(60, Math.abs(y - lastY)) * 0.9 + vel * 0.1
      lastY = y
      document.documentElement.style.setProperty(
        '--ard-tick',
        `${(26 - Math.min(18, vel * 0.42)).toFixed(1)}s`,
      )
    }

    const onScroll = () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(frame)
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    frame()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return <div className="ard-progress" aria-hidden ref={bar} />
}
