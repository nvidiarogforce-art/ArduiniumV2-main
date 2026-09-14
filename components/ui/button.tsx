import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * The signature retro button (spec §4.3).
 *
 * Technique carried over from the supplied `pricing` reference component —
 * a solid offset shadow that the element slides into on press, so the button
 * physically travels the shadow's distance instead of dimming or scaling.
 * Recoloured from that component's black/amber to our navy.
 *
 * Note the shadow is a *token* (`--shadow-hard`, `--shadow-hard-lg`) rather
 * than an inline arbitrary value, so the offset stays identical across every
 * button, card and pricing tier in the product.
 *
 * source: 21st.dev pricing component, adapted — colours, sizing and variants
 * rebuilt against §4.1.
 */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap select-none',
    'rounded-[10px] border-2 border-navy',
    'font-display font-extrabold uppercase tracking-[0.03em]',
    'transition-[transform,box-shadow,background-color] duration-[80ms] ease-out',
    'active:translate-x-[3px] active:translate-y-[3px] active:shadow-none',
    'disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none',
    'disabled:translate-x-[3px] disabled:translate-y-[3px]',
    '[&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        /* Loud CTA. Orange is the product's power/LED colour, so it marks the
           one action a section most wants. */
        primary: 'bg-orange text-white shadow-hard hover:bg-[color-mix(in_srgb,var(--color-orange)_88%,black)]',
        /* Equal weight, quieter voice — and the orange moves into the shadow,
           which keeps the accent present at a much better text contrast. */
        secondary: 'bg-navy text-bg shadow-[3px_3px_0_var(--color-orange)] hover:bg-navy-2',
        outline: 'bg-card text-navy shadow-hard hover:bg-bg-alt',
        teal: 'bg-teal text-white shadow-hard hover:bg-[color-mix(in_srgb,var(--color-teal)_88%,black)]',
        /* For dark bands: the navy border and navy shadow both vanish against
           navy, so both flip to cream. */
        onDark:
          'bg-orange text-white border-bg shadow-[3px_3px_0_var(--color-bg)] hover:bg-[color-mix(in_srgb,var(--color-orange)_88%,black)]',
        cream: 'bg-card text-navy border-navy shadow-hard hover:bg-bg-alt',
        /* No border, no shadow — for tertiary actions where a third boxed
           button would turn the layout into a wall of rectangles. */
        ghost:
          'border-transparent bg-transparent text-navy shadow-none normal-case tracking-normal font-bold hover:bg-navy/8 active:translate-x-0 active:translate-y-0',
      },
      size: {
        sm: 'h-9 px-3.5 text-[12.5px]',
        md: 'h-11 px-5 text-[14px]',
        lg: 'h-[52px] px-7 text-[15.5px]',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
