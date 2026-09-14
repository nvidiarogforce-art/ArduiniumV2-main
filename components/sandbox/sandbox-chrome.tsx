'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SolderPad } from '@/components/ui/card'
import { LogoMark } from '@/components/brand/logo'
import { LangToggle } from '@/components/site/lang-toggle'
import { ArduPanel } from '@/components/sandbox/ardu-panel'
import { getLesson } from '@/lib/content/lessons'
import { useI18n } from '@/lib/i18n'
import { useProgress } from '@/lib/useProgress'

/**
 * Site chrome wrapped AROUND the sandbox — spec §7.3.3 asks for lesson
 * context, a breadcrumb back to the catalogue, and a save-progress action,
 * added additively rather than by reaching into the sandbox's internals.
 *
 * It is also the site header for this route (see SiteChrome for why), so it
 * carries the brand mark and the language switch too.
 *
 * It communicates with the workshop only through the URL (`?lesson=<slug>`)
 * and, for language, through the sandbox's own public zustand action. The
 * workshop neither knows nor cares that it is embedded in a site.
 */
export function SandboxChrome() {
  const { t, locale } = useI18n()
  const params = useSearchParams()
  const { isDone, toggle, hydrated } = useProgress()

  const slug = params.get('lesson')
  const lesson = slug ? getLesson(slug) : undefined
  const done = lesson ? isDone(lesson.slug) : false

  return (
    <div className="flex h-[54px] shrink-0 items-center gap-x-3 border-b-2 border-navy bg-bg-alt px-3 sm:gap-x-4 sm:px-5">
      <Link href="/" aria-label="Arduinium" className="shrink-0 rounded-md">
        <LogoMark size={28} />
      </Link>

      <span aria-hidden className="h-5 w-[2px] shrink-0 bg-navy/15" />

      <Link
        href="/learn/lessons"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md text-[13px] font-bold text-navy/70 transition-colors hover:text-orange"
      >
        <ArrowLeft size={15} />
        <span className="hidden sm:inline">{t.simulator.backToLessons}</span>
      </Link>

      <div className="flex min-w-0 items-center gap-2">
        <SolderPad className="size-[14px] shrink-0 border-[1.5px]" lit={!done} />
        <span className="hidden shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] text-navy/55 md:inline">
          {lesson ? t.simulator.lessonContext : t.simulator.freeMode}
        </span>
        {lesson && (
          <span className="truncate font-display text-[14px] font-bold text-navy">
            {lesson.title[locale]}
          </span>
        )}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {/* Phase 1 shipped this as a disabled placeholder because a button that
            pretends to answer is worse than one that admits it is not ready.
            Phase 2 §3.1 makes it real: one button, the same assistant as /ai,
            opened in place with the current lesson and build as context. */}
        <ArduPanel lessonSlug={slug} />

        <LangToggle className="hidden sm:inline-flex" />

        {lesson && (
          <Button
            size="sm"
            variant={done ? 'teal' : 'outline'}
            onClick={() => toggle(lesson.slug)}
            disabled={!hydrated}
          >
            {done ? <Check size={15} /> : null}
            <span className="hidden md:inline">
              {done ? t.simulator.completed : t.simulator.markComplete}
            </span>
            <span className="md:hidden">{done ? t.simulator.completed : '✓'}</span>
          </Button>
        )}
      </div>
    </div>
  )
}
