'use client'

import { useEffect, useRef } from 'react'
import { createRipple, type Ripple } from '@/lib/ripple'

/**
 * The page's ambient background: a drifting gradient, three colour glows, an
 * engineering grid with floating doodles, and the interactive click ripple.
 *
 * Every layer is `position: fixed` with a NEGATIVE z-index and
 * `pointer-events: none`, so the whole thing sits behind the document and can
 * never cover text or swallow a click. That is the correction from the first
 * pass, where the ripple painted over headlines and cards.
 *
 * Mounted once in the root layout, so a single canvas serves every route.
 */
export function Backdrop() {
  const fx = useRef<HTMLCanvasElement>(null)
  const doodles = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const canvas = fx.current
    if (!canvas) return

    const page: Ripple | null = createRipple(canvas, null, {
      outer: 'rgba(30,143,130,$)',
      inner: 'rgba(217,97,47,$)',
      alphaOuter: 0.3,
      alphaInner: 0.22,
    })
    if (!page) return

    // A hero (or any dark band) can register its own canvas so the wave is
    // still visible over an opaque section. See HeroRipple.
    const locals: Ripple[] = []
    const register = (e: Event) => {
      const r = (e as CustomEvent<Ripple>).detail
      if (r) locals.push(r)
    }
    const unregister = (e: Event) => {
      const r = (e as CustomEvent<Ripple>).detail
      const i = locals.indexOf(r)
      if (i >= 0) locals.splice(i, 1)
    }

    const all = () => [page, ...locals]
    const onResize = () => all().forEach((r) => r.resize())
    const onDown = (e: PointerEvent) => all().forEach((r) => r.at(e.clientX, e.clientY))
    const ambient = window.setInterval(() => {
      if (!document.hidden) all().forEach((r) => r.ambient())
    }, 4600)

    // Parallax on the doodles — cheap depth that stops the fixed background
    // reading as a flat sheet behind a moving page.
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const y = window.scrollY
        const host = doodles.current
        if (!host) return
        Array.from(host.children).forEach((el, i) => {
          const dir = i % 2 ? -1 : 1
          ;(el as HTMLElement).style.transform =
            `translate3d(0, ${(y * 0.06 * dir).toFixed(1)}px, 0) rotate(${(y * 0.008 * dir).toFixed(2)}deg)`
        })
      })
    }

    window.addEventListener('resize', onResize)
    window.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('ard:ripple-add', register as EventListener)
    window.addEventListener('ard:ripple-remove', unregister as EventListener)

    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('ard:ripple-add', register as EventListener)
      window.removeEventListener('ard:ripple-remove', unregister as EventListener)
      window.clearInterval(ambient)
      if (raf) cancelAnimationFrame(raf)
      page.destroy()
    }
  }, [])

  return (
    <>
      <div className="ard-bg-layer" aria-hidden />
      <div className="ard-bg-glow" aria-hidden />
      <div className="ard-bg-grid" aria-hidden ref={doodles}>
        {/* chip · LED · resistor · code brace */}
        <svg className="ard-doodle left-[6%] top-[14%]" width="60" height="60" viewBox="0 0 60 60" fill="none" stroke="currentColor" strokeWidth="3">
          <rect x="14" y="14" width="32" height="32" rx="6" />
          <path d="M22 6v8M30 6v8M38 6v8M22 46v8M30 46v8M38 46v8M6 22h8M6 30h8M6 38h8M46 22h8M46 30h8M46 38h8" strokeLinecap="round" />
        </svg>
        <svg className="ard-doodle right-[8%] top-[26%] [animation-delay:-2.5s]" width="54" height="54" viewBox="0 0 54 54" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M18 30a9 9 0 1 1 18 0v8H18z" strokeLinejoin="round" />
          <path d="M22 46h10M24 52h6M27 6v6M12 14l4 4M42 14l-4 4" strokeLinecap="round" />
        </svg>
        <svg className="ard-doodle bottom-[22%] left-[11%] [animation-delay:-5s]" width="76" height="40" viewBox="0 0 76 40" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 20h12l5-12 8 24 8-24 8 24 5-12h26" />
        </svg>
        <svg className="ard-doodle bottom-[14%] right-[12%] [animation-delay:-7.5s]" width="58" height="58" viewBox="0 0 58 58" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 10c-8 0-8 15-14 19 6 4 6 19 14 19M36 10c8 0 8 15 14 19-6 4-6 19-14 19" />
        </svg>
      </div>
      <canvas className="ard-fx" aria-hidden ref={fx} />
    </>
  )
}

/**
 * A ripple layer scoped to one opaque section.
 *
 * The page-level canvas is behind everything, so it is invisible under a dark
 * band. This adds a second canvas inside the band — still behind the band's
 * own content — drawn at a lower alpha so it stays ambience rather than
 * competing with the headline.
 */
export function HeroRipple() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const canvas = ref.current
    const host = canvas?.parentElement
    if (!canvas || !host) return

    const r = createRipple(canvas, host, {
      outer: 'rgba(45,190,172,$)',
      inner: 'rgba(232,124,68,$)',
      alphaOuter: 0.2,
      alphaInner: 0.15,
    })
    if (!r) return

    window.dispatchEvent(new CustomEvent('ard:ripple-add', { detail: r }))
    return () => {
      window.dispatchEvent(new CustomEvent('ard:ripple-remove', { detail: r }))
      r.destroy()
    }
  }, [])

  return <canvas className="ard-fx-local" aria-hidden ref={ref} />
}
