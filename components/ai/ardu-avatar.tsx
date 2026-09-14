import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * Ardu's head, cropped to a circle.
 *
 * `public/brand/ardu.png` is a full-body 1024×1536 illustration — the supplied
 * brand asset, never regenerated. A chat needs a face at 28–36px, so the image
 * is scaled up inside a round window and pinned to the top rather than a second
 * asset being invented. The mascot IS the assistant's identity here (spec
 * §3.1), so using anything else would have introduced a second character.
 */
export function ArduAvatar({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative inline-block shrink-0 overflow-hidden rounded-full border-2 border-navy bg-teal',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src="/brand/ardu.png"
        alt=""
        width={size * 2}
        height={size * 3}
        draggable={false}
        className="absolute left-1/2 top-0 max-w-none -translate-x-1/2 select-none"
        style={{ width: size * 1.6, height: 'auto', marginTop: -size * 0.12 }}
      />
    </span>
  )
}
