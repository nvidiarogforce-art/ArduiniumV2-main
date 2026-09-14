'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

type Phase = 'idle' | 'hidden' | 'shown'

/**
 * Scroll reveal, in both directions.
 *
 * Elements animate in as they arrive and play the same animation in reverse
 * as they leave, so scrolling back up empties the page the way scrolling down
 * filled it.
 *
 * VISIBLE IS THE FALLBACK — reversing does not weaken that rule, it just
 * narrows it: content is never invisible *while it is on screen*. The hidden
 * state is opt-in via `data-shown="false"`, written only after the observer
 * has reported, and:
 *
 *   - first render / SSR is `idle` → no attribute → CSS default is visible;
 *   - on mount we measure in a layout effect (before paint, so no flash) and
 *     anything already on screen goes straight to `shown`;
 *   - no IntersectionObserver, or one that never delivers, → `shown` forever.
 *
 * `rootMargin` insets the root so the transition happens at the edges of the
 * viewport rather than outside it: -8% off the top means an element leaving
 * upward begins reversing while its last sliver is still visible, which is
 * the point — the reader should *see* it go. -10% off the bottom delays entry
 * until the element is properly in the frame.
 */
const ROOT_MARGIN = '-8% 0px -10% 0px'

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [phase, setPhase] = useState<Phase>('idle')

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    if (typeof IntersectionObserver === 'undefined') {
      setPhase('shown')
      return
    }

    const rect = el.getBoundingClientRect()
    setPhase(rect.top < window.innerHeight * 0.92 && rect.bottom > 0 ? 'shown' : 'hidden')

    let delivered = false
    const io = new IntersectionObserver(
      (entries) => {
        delivered = true
        setPhase(entries[entries.length - 1].isIntersecting ? 'shown' : 'hidden')
      },
      { rootMargin: ROOT_MARGIN, threshold: 0 },
    )
    io.observe(el)

    // Only fires if the observer stayed silent; a working one always delivers
    // an initial entry, so this cannot short-circuit the animation.
    const safety = window.setTimeout(() => {
      if (!delivered) {
        setPhase('shown')
        io.disconnect()
      }
    }, 2000)

    return () => {
      io.disconnect()
      window.clearTimeout(safety)
    }
  }, [])

  return { ref, shown: phase === 'idle' ? undefined : phase === 'shown' }
}

/** Rise + scale + blur. The default reveal for prose and section content. */
export function Rise({
  children,
  delay = 0,
  className,
  as: Tag = 'div',
}: {
  children: React.ReactNode
  delay?: number
  className?: string
  as?: 'div' | 'li' | 'section' | 'article'
}) {
  const { ref, shown } = useReveal<HTMLDivElement>()
  const Component = Tag as 'div'
  return (
    <Component
      ref={ref}
      data-shown={shown}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn('ard-rise', className)}
    >
      {children}
    </Component>
  )
}

/**
 * The gear entrance, for repeating card grids.
 *
 * A card swings in from the nearest edge while rotating about its own centre
 * and settling with a slight overshoot — a cog dropping into mesh. Adjacent
 * columns spin opposite ways (`spin`), which is what makes a row read as a
 * gear *train* rather than three things that happen to tilt.
 *
 * Deliberately limited to card grids. Rotating a headline or the quote block
 * would be motion for its own sake, and rotating long text hurts readability
 * mid-transition.
 */
export function Gear({
  children,
  /** -1 enters from the left, 1 from the right, 0 straight up. */
  dir = 0,
  /** 1 or -1: which way the cog turns. Alternate along a row. */
  spin = -1,
  delay = 0,
  className,
  as: Tag = 'div',
}: {
  children: React.ReactNode
  dir?: -1 | 0 | 1
  spin?: 1 | -1
  delay?: number
  className?: string
  as?: 'div' | 'li' | 'section' | 'article'
}) {
  const { ref, shown } = useReveal<HTMLDivElement>()
  const Component = Tag as 'div'
  return (
    <Component
      ref={ref}
      data-shown={shown}
      style={
        {
          '--ard-gx': `${dir * 110}px`,
          '--ard-gr': `${spin * 28}deg`,
          ...(delay ? { transitionDelay: `${delay}ms` } : null),
        } as React.CSSProperties
      }
      className={cn('ard-gear', className)}
    >
      {children}
    </Component>
  )
}

/**
 * Headings resolve one word at a time, each tipping up out of the page, and
 * fold back the same way on the way out.
 *
 * Splitting happens in render rather than by rewriting the DOM, so a language
 * switch re-splits for free and there is never a moment where the heading
 * exists as loose text nodes.
 */
export function Words({
  text,
  className,
  as: Tag = 'h2',
}: {
  text: string
  className?: string
  as?: 'h1' | 'h2' | 'h3'
}) {
  const { ref, shown } = useReveal<HTMLHeadingElement>()
  const Component = Tag as 'h2'
  const words = text.split(/\s+/).filter(Boolean)

  return (
    <Component ref={ref} data-shown={shown} className={cn('ard-words', className)}>
      {words.map((word, i) => (
        <span key={`${word}-${i}`}>
          <span className="ard-word" style={{ transitionDelay: `${i * 55}ms` }}>
            {word}
          </span>
          {i < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </Component>
  )
}
