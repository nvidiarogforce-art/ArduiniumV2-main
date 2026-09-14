import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * The same offset-shadow treatment as the button, minus the press travel —
 * spec §4.3 asks for cards to carry it so the whole surface reads as one
 * printed system rather than two unrelated component libraries.
 *
 * `interactive` re-enables the press behaviour for cards that are themselves
 * links (role pickers, lesson cards, video cards).
 */
export function Card({
  className,
  interactive = false,
  tone = 'card',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean
  tone?: 'card' | 'navy' | 'alt'
}) {
  return (
    <div
      className={cn(
        'rounded-[14px] border-2 border-navy shadow-hard',
        tone === 'card' && 'bg-card text-navy',
        tone === 'alt' && 'bg-bg-alt text-navy',
        tone === 'navy' && 'bg-navy text-bg',
        interactive && [
          'transition-[transform,box-shadow] duration-[90ms] ease-out',
          'hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-hard-lg',
          'active:translate-x-[3px] active:translate-y-[3px] active:shadow-none',
        ],
        className,
      )}
      {...props}
    />
  )
}

/**
 * A solder pad: the small teal ring with an orange LED at its centre that
 * marks section headings and timeline nodes. It is the logo's apex detail
 * reused at UI scale, which is what ties the page back to the brand mark
 * without printing the logo eight times.
 */
export function SolderPad({ className, lit = true }: { className?: string; lit?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-grid size-[18px] shrink-0 place-items-center rounded-full border-2 border-navy bg-teal',
        className,
      )}
    >
      <span className={cn('size-[6px] rounded-full bg-orange', lit && 'ard-led')} />
    </span>
  )
}
