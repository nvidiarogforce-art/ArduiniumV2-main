'use client'

import { useEffect, useRef } from 'react'
import { useI18n } from '@/lib/i18n'

/** Resting speed, px/s, and the most a fast scroll may add on top. */
const BASE = 70
const MAX_BOOST = 260

/**
 * The marquee band under the hero.
 *
 * Two identical copies of the word list; the track is translated left and
 * wrapped at half its width, which is what makes the loop seamless.
 *
 * WHY THIS IS JAVASCRIPT AND NOT A CSS ANIMATION.
 *
 * The first version ran `animation: marquee var(--ard-tick) linear infinite`
 * and rewrote `--ard-tick` from scroll velocity. Changing the duration of a
 * *running* CSS animation makes the browser recompute its position as
 * elapsed-time ÷ new-duration, so every speed change teleported the strip
 * sideways. At speed that reads as tearing — the reported glitch. Any
 * duration-based speed control has this failure built in.
 *
 * Integrating position instead (`x -= speed × dt`) and easing *speed* means a
 * change in speed can only change the next frame's delta. Position stays
 * continuous by construction, so it can accelerate and settle without ever
 * jumping.
 *
 * The CSS animation is left in the stylesheet as the no-JS fallback; this
 * switches it off when it takes over.
 */
export function Ticker() {
  const { t } = useI18n()
  const wrap = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = track.current
    const host = wrap.current
    if (!el || !host) return

    el.style.animation = 'none'

    let x = 0
    let half = el.scrollWidth / 2
    let speed = BASE
    let target = BASE
    let paused = false
    let last = 0
    let raf = 0

    // The two copies change width when the language does; re-measuring keeps
    // the wrap point correct without restarting the loop.
    const ro = new ResizeObserver(() => {
      half = el.scrollWidth / 2
    })
    ro.observe(el)

    let lastY = window.scrollY
    const onScroll = () => {
      const dy = Math.abs(window.scrollY - lastY)
      lastY = window.scrollY
      target = Math.min(BASE + MAX_BOOST, BASE + dy * 12)
    }

    const frame = (now: number) => {
      const dt = last ? Math.min(50, now - last) : 16
      last = now

      target += (BASE - target) * 0.05 // bleed the boost away
      speed += (target - speed) * 0.07 // and ease toward it

      if (!paused && half > 0) {
        x -= (speed * dt) / 1000
        if (x <= -half) x += half
        el.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`
      }
      raf = requestAnimationFrame(frame)
    }

    const enter = () => (paused = true)
    const leave = () => (paused = false)

    host.addEventListener('pointerenter', enter)
    host.addEventListener('pointerleave', leave)
    window.addEventListener('scroll', onScroll, { passive: true })
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      host.removeEventListener('pointerenter', enter)
      host.removeEventListener('pointerleave', leave)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  const run = t.ticker.map((word, i) => (
    <span
      key={`${word}-${i}`}
      className="whitespace-nowrap px-4 font-display text-[15px] font-extrabold uppercase tracking-[0.1em]"
    >
      {word} <b className="text-orange">✦</b>
    </span>
  ))

  return (
    <div className="ard-ticker-wrap" aria-hidden ref={wrap}>
      <div className="ard-ticker">
        <div className="ard-ticker-track" ref={track}>
          {run}
          {run}
        </div>
      </div>
    </div>
  )
}
