import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Inputs get the same 2px navy border as everything else, and an inset
 * pressed-look shadow rather than the outset one — a field is a hole in the
 * board, not a key sitting on top of it. That inversion is what keeps the
 * form recognisably part of the same system without making it look clickable.
 */
const base =
  'w-full rounded-[9px] border-2 border-navy bg-bg-alt px-3.5 py-2.5 text-[15px] text-navy ' +
  'shadow-[inset_2px_2px_0_rgba(28,53,71,0.12)] placeholder:text-navy/35 ' +
  'transition-colors focus:bg-card focus-visible:outline-3'

export function Field({
  label,
  children,
  htmlFor,
  tone = 'light',
}: {
  label: string
  children: React.ReactNode
  htmlFor: string
  /** `dark` for fields sitting on a navy surface (the registration form). */
  tone?: 'light' | 'dark'
}) {
  return (
    <label className="flex flex-col gap-1.5" htmlFor={htmlFor}>
      <span
        className={cn(
          'font-mono text-[11px] font-bold uppercase tracking-[0.12em]',
          tone === 'dark' ? 'text-bg/70' : 'text-navy/60',
        )}
      >
        {label}
      </span>
      {children}
    </label>
  )
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(base, className)} {...props} />,
)
Input.displayName = 'Input'

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(base, 'min-h-[120px] resize-y', className)} {...props} />
))
Textarea.displayName = 'Textarea'

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn(base, 'cursor-pointer appearance-none', className)} {...props} />
))
Select.displayName = 'Select'
