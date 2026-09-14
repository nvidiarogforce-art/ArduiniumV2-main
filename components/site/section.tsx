import { cn } from '@/lib/utils'

/**
 * The standard page gutter. One value, so nothing drifts out of alignment.
 *
 * This file used to also export `SectionHeading` and `TraceDivider` from the
 * previous landing design. Both became unreachable when the landing was
 * rebuilt — headings are now `ard-kicker` + `<Words>` — and were removed
 * rather than left as a second, silently-diverging way to set a heading.
 */
export function Container({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <div className={cn('mx-auto w-full max-w-[1180px] px-5 sm:px-8', className)}>{children}</div>
}
