'use client'

import { useRef } from 'react'
import { cn } from '@/lib/utils'

/**
 * Cursor-reactive card: a small 3D tilt plus a sheen that follows the pointer.
 *
 * The transform is owned here rather than by a `:hover` rule so the lift and
 * the tilt angle compose into one value instead of fighting. Position is
 * published as `--ard-mx/--ard-my` and the sheen is a CSS gradient keyed on
 * them, so with JS idle the card simply never lights — it never breaks.
 *
 * Touch pointers are ignored: there is no hover on a phone, and applying a
 * tilt on tap makes cards feel like they are slipping out from under a finger.
 */
export function Tilt({
  children,
  className,
  dark = false,
  max = 7,
}: {
  children: React.ReactNode
  className?: string
  dark?: boolean
  max?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const raf = useRef(0)
  const angle = useRef({ x: 0, y: 0 })

  const apply = () => {
    raf.current = 0
    const el = ref.current
    if (!el) return
    el.style.transform =
      `translate3d(-3px,-3px,0) perspective(760px) ` +
      `rotateX(${angle.current.y.toFixed(2)}deg) rotateY(${angle.current.x.toFixed(2)}deg)`
  }

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    el.style.setProperty('--ard-mx', `${(px * 100).toFixed(1)}%`)
    el.style.setProperty('--ard-my', `${(py * 100).toFixed(1)}%`)
    angle.current = { x: (px - 0.5) * max, y: -(py - 0.5) * max }
    if (!raf.current) raf.current = requestAnimationFrame(apply)
  }

  const reset = () => {
    const el = ref.current
    if (!el) return
    el.style.transform = ''
    el.style.removeProperty('--ard-mx')
    el.style.removeProperty('--ard-my')
  }

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      className={cn('ard-tilt', dark && 'ard-tilt-dark', className)}
    >
      {children}
    </div>
  )
}
