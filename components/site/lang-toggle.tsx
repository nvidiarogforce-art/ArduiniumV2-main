'use client'

import { useI18n, type Locale } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const OPTIONS: Locale[] = ['uz', 'en']

/**
 * UZ/EN switch (spec §1, §8 — required on every MVP page, default Uzbek).
 *
 * Drawn as a two-position hardware switch rather than a dropdown: with only
 * two languages a select is one extra click for no information, and the
 * physical-switch read is on-brand for a product about electronics.
 */
export function LangToggle({ className }: { className?: string }) {
  const { locale, setLocale } = useI18n()

  return (
    <div
      className={cn(
        'relative inline-flex items-center rounded-[9px] border-2 border-navy bg-bg-alt p-[3px] shadow-hard-sm',
        className,
      )}
      role="group"
      aria-label="Language"
    >
      {/* The travelling knob. Sliding one element beats cross-fading two
          backgrounds — the eye tracks the movement and reads it as a switch. */}
      <span
        aria-hidden
        className="absolute top-[3px] bottom-[3px] left-[3px] w-[calc(50%-3px)] rounded-[6px] bg-navy transition-transform duration-150 ease-out"
        style={{ transform: `translateX(${OPTIONS.indexOf(locale) * 100}%)` }}
      />
      {OPTIONS.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => setLocale(opt)}
          aria-pressed={locale === opt}
          className={cn(
            'relative z-10 w-[38px] rounded-[6px] py-1 text-[11.5px] font-extrabold uppercase tracking-[0.08em] transition-colors duration-150',
            locale === opt ? 'text-bg' : 'text-navy/60 hover:text-navy',
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}
