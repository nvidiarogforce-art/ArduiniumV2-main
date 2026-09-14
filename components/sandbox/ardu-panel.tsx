'use client'

import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { toArduinoCode } from '@sandbox/lib/program'
import { ArduAvatar } from '@/components/ai/ardu-avatar'
import { ArduChat } from '@/components/ai/chat'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/**
 * Ardu, in the workshop — spec §3.1's second home for the assistant.
 *
 * One button in the sandbox toolbar opens the same chat component `/ai` uses,
 * in a slide-over, without leaving the 3D scene. The scene keeps running
 * behind it: nothing here pauses, unmounts or remounts the sandbox, which is
 * the whole reason it is a panel rather than a route.
 *
 * The Phase 1 rule that the sandbox's simulation logic is off limits still
 * holds, and this respects it literally — no file under `src/` was changed to
 * make this work. The panel reads the debug hooks the workshop already exposes
 * on `window`, and calls the same `toArduinoCode()` the code tab calls. It is a
 * reader of the sandbox, never a writer.
 */
export function ArduPanel({ lessonSlug }: { lessonSlug: string | null }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  // Escape closes it. A full-height overlay that can only be dismissed by
  // hitting a small × is a trap on a tool people use with both hands on the
  // keyboard.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  /**
   * Snapshot the build and the program at the moment a question is asked.
   *
   * Everything here is read through hooks the workshop publishes for its own
   * test harnesses; each one is guarded because the sandbox may still be
   * booting when the panel opens, and a missing hook must degrade to "no
   * context" rather than throw inside a chat send.
   */
  const getContext = useCallback(() => {
    if (typeof window === 'undefined') return {}
    const w = window as unknown as Record<string, undefined | (() => unknown)>

    let circuit: string | null = null
    let code: string | null = null

    try {
      const summary = w.__ARDUINIUM__?.() as
        | { parts: number; bolts: number; pinMap: Record<string, unknown>; distance: number; running: boolean }
        | undefined

      if (summary) {
        const pins = Object.entries(summary.pinMap ?? {})
          .map(([device, pin]) => `${device}→D${String(pin)}`)
          .join(', ')
        circuit =
          `${summary.parts} parts bolted with ${summary.bolts} bolts. ` +
          `Wiring: ${pins || 'nothing wired to the Arduino yet'}. ` +
          `Sensor reads ${summary.distance} cm. Program is ${summary.running ? 'running' : 'stopped'}.`

        const program = w.__ARDUINIUM_PROG__?.()
        if (program) code = toArduinoCode(program, summary.pinMap ?? {})
      }
    } catch {
      /* The workshop is mid-boot — send the question without context. */
    }

    return { code, circuit }
  }, [])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        data-testid="ardu-button"
        title={t.simulator.aiOpen}
        className={cn(
          'inline-flex items-center gap-2 rounded-[9px] border-2 border-navy px-2 py-1 text-[12.5px] font-bold shadow-hard-sm',
          'transition-[transform,box-shadow] duration-100 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none',
          open ? 'bg-navy text-bg' : 'bg-card text-navy hover:bg-bg-alt',
        )}
      >
        <ArduAvatar size={22} className={open ? 'border-bg' : undefined} />
        <span className="hidden lg:inline">{t.simulator.aiOpen}</span>
      </button>

      {open && (
        <>
          {/* Dim only — clicking it closes. Deliberately not a focus trap: the
              student should be able to keep dragging parts with the panel up. */}
          <div
            className="fixed inset-0 z-[60] bg-navy/25 backdrop-blur-[1px]"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside
            role="dialog"
            aria-label={t.simulator.aiPanel}
            className="fixed inset-y-0 right-0 z-[61] flex w-full max-w-[430px] flex-col border-l-2 border-navy bg-bg shadow-[-6px_0_0_rgba(28,53,71,0.12)]"
          >
            <header className="flex shrink-0 items-center gap-3 border-b-2 border-navy bg-bg-alt px-4 py-3">
              <ArduAvatar size={32} />
              <div className="min-w-0 flex-1">
                <p className="font-display text-[14.5px] font-bold leading-tight text-navy">
                  {t.simulator.aiPanel}
                </p>
                <p className="truncate text-[11.5px] text-navy/55">{t.ai.contextNote}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t.common.close}
                className="grid size-8 shrink-0 place-items-center rounded-[8px] border-2 border-navy bg-card shadow-hard-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                <X size={15} />
              </button>
            </header>

            <div className="min-h-0 flex-1">
              <ArduChat source="sandbox" lessonSlug={lessonSlug} getContext={getContext} dense />
            </div>
          </aside>
        </>
      )}
    </>
  )
}
