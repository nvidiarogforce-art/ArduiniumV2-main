import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * Brand mark — the user-supplied asset, used as-is (spec §4.4 forbids
 * regenerating it). `public/brand/logo.png`, 1254×1254.
 */
export function LogoMark({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/brand/logo.png"
      alt=""
      width={size}
      height={size}
      priority
      className={cn('rounded-[7px]', className)}
    />
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'font-display text-[19px] font-bold tracking-[0.14em] text-navy uppercase',
        className,
      )}
    >
      Arduinium
    </span>
  )
}

export function Logo({ className, size }: { className?: string; size?: number }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={size} />
      <Wordmark />
    </span>
  )
}

/**
 * Ardu, the mascot — also a user-supplied asset (`public/brand/ardu.png`,
 * 1024×1536). Never regenerated, never recoloured.
 */
export function Ardu({
  className,
  width = 300,
  priority = false,
}: {
  className?: string
  width?: number
  priority?: boolean
}) {
  return (
    <Image
      src="/brand/ardu.png"
      alt="Ardu"
      width={width}
      height={Math.round((width * 1536) / 1024)}
      priority={priority}
      className={cn('select-none', className)}
      draggable={false}
    />
  )
}
