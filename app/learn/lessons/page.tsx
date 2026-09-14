'use client'

import Link from 'next/link'
import { ArrowRight, Check, Clock, Lock } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Container } from '@/components/site/section'
import { LESSONS } from '@/lib/content/lessons'
import { useI18n } from '@/lib/i18n'
import { useProgress } from '@/lib/useProgress'
import { cn } from '@/lib/utils'

const LEVEL_TONE = {
  easy: 'bg-teal text-white',
  medium: 'bg-orange text-white',
  hard: 'bg-navy text-bg',
} as const

export default function LessonsPage() {
  const { t, locale } = useI18n()
  const { isDone } = useProgress()

  return (
    <section className="ard-perf bg-bg py-14 sm:py-20">
      <Container>
        <h1 className="font-display text-[clamp(1.9rem,4.5vw,2.7rem)] text-navy">
          {t.lessons.title}
        </h1>
        <p className="mt-3 max-w-[56ch] text-[16px] leading-relaxed text-navy/70">{t.lessons.sub}</p>

        <ol className="mt-10 flex flex-col gap-4">
          {LESSONS.map((lesson, i) => {
            const done = isDone(lesson.slug)
            const body = (
              <>
                <span className="grid size-12 shrink-0 place-items-center rounded-[10px] border-2 border-navy bg-bg-alt font-display text-[17px] font-bold text-navy">
                  {done ? <Check size={20} strokeWidth={3} className="text-teal" /> : String(i + 1).padStart(2, '0')}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-[18px] font-bold text-navy">
                      {lesson.title[locale]}
                    </span>
                    <span
                      className={cn(
                        'rounded-[6px] border-2 border-navy px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em]',
                        LEVEL_TONE[lesson.level],
                      )}
                    >
                      {t.lessons.levels[lesson.level]}
                    </span>
                    {!lesson.available && (
                      <span className="inline-flex items-center gap-1 rounded-[6px] border-2 border-dashed border-navy/35 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-navy/45">
                        <Lock size={10} />
                        {t.common.soon}
                      </span>
                    )}
                  </span>
                  <span className="mt-1.5 block text-[14.5px] leading-relaxed text-navy/68">
                    {lesson.summary[locale]}
                  </span>
                </span>

                {lesson.available && (
                  <span className="flex shrink-0 items-center gap-4">
                    <span className="hidden items-center gap-1.5 font-mono text-[12px] font-bold text-navy/50 sm:inline-flex">
                      <Clock size={13} />
                      {lesson.minutes} {t.common.minutes}
                    </span>
                    <ArrowRight size={18} strokeWidth={2.5} className="text-orange" />
                  </span>
                )}
              </>
            )

            // An unavailable lesson is a card, not a link. Making it clickable
            // and then showing an empty page is worse than showing it locked.
            return (
              <li key={lesson.slug}>
                {lesson.available ? (
                  <Card interactive className="p-0">
                    <Link
                      href={`/learn/lessons/${lesson.slug}`}
                      className="flex items-center gap-4 p-5 sm:p-6"
                    >
                      {body}
                    </Link>
                  </Card>
                ) : (
                  <Card className="flex items-center gap-4 p-5 opacity-65 shadow-hard-sm sm:p-6">
                    {body}
                  </Card>
                )}
              </li>
            )
          })}
        </ol>
      </Container>
    </section>
  )
}
