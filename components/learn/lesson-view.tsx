'use client'

import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, Clock, Info, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, SolderPad } from '@/components/ui/card'
import { Container } from '@/components/site/section'
import { LESSONS, getLesson } from '@/lib/content/lessons'
import { useI18n } from '@/lib/i18n'
import { useProgress } from '@/lib/useProgress'

export function LessonView({ slug }: { slug: string }) {
  const { t, locale } = useI18n()
  const { isDone, toggle, hydrated } = useProgress()

  const lesson = getLesson(slug)
  if (!lesson) return null

  const done = isDone(lesson.slug)
  const available = LESSONS.filter((l) => l.available)
  const idx = available.findIndex((l) => l.slug === lesson.slug)
  const next = available[idx + 1]

  return (
    <article className="bg-bg">
      {/* Lesson header, on the dark surface so the reading area below it is
          unambiguously where the content starts. */}
      <div className="ard-perf-dense border-b-2 border-navy bg-navy py-12 text-bg sm:py-16">
        <Container>
          <Link
            href="/learn/lessons"
            className="inline-flex items-center gap-1.5 rounded-md text-[13.5px] font-bold text-bg/65 transition-colors hover:text-orange"
          >
            <ArrowLeft size={15} />
            {t.lessons.title}
          </Link>

          <h1 className="mt-5 max-w-[22ch] font-display text-[clamp(1.9rem,5vw,3rem)] text-bg">
            {lesson.title[locale]}
          </h1>
          <p className="mt-4 max-w-[58ch] text-[16.5px] leading-relaxed text-bg/72">
            {lesson.summary[locale]}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[12px] font-bold uppercase tracking-[0.1em] text-bg/55">
            <span className="inline-flex items-center gap-1.5">
              <Clock size={13} />
              {lesson.minutes} {t.common.minutes}
            </span>
            <span aria-hidden className="h-3 w-[2px] bg-bg/20" />
            <span>
              {t.lessons.difficulty}: {t.lessons.levels[lesson.level]}
            </span>
          </div>
        </Container>
      </div>

      <Container className="grid gap-12 py-14 lg:grid-cols-[minmax(0,1fr)_300px] lg:py-20">
        <div>
          {lesson.body.map((block, i) => {
            switch (block.kind) {
              case 'h':
                return (
                  <h2
                    key={i}
                    className="mt-11 flex items-center gap-2.5 font-display text-[22px] font-bold text-navy first:mt-0"
                  >
                    <SolderPad lit={false} className="size-[14px] border-[1.5px]" />
                    {block.text[locale]}
                  </h2>
                )
              case 'p':
                return (
                  <p key={i} className="mt-5 max-w-[68ch] text-[16px] leading-[1.7] text-navy/80">
                    {block.text[locale]}
                  </p>
                )
              case 'list':
                return (
                  <ul key={i} className="mt-5 flex max-w-[68ch] flex-col gap-2.5">
                    {block.items[locale].map((item, ii) => (
                      <li key={ii} className="flex items-start gap-3 text-[16px] leading-[1.65] text-navy/80">
                        <span aria-hidden className="mt-[9px] size-2 shrink-0 rounded-full bg-teal" />
                        {item}
                      </li>
                    ))}
                  </ul>
                )
              case 'code':
                return (
                  <figure key={i} className="mt-7">
                    <Card tone="navy" className="overflow-hidden p-0">
                      <pre className="overflow-x-auto p-5 font-mono text-[13.5px] leading-[1.6] text-bg">
                        <code>{block.code}</code>
                      </pre>
                    </Card>
                    <figcaption className="mt-2.5 text-[13.5px] italic text-navy/60">
                      {block.caption[locale]}
                    </figcaption>
                  </figure>
                )
              case 'note':
                return (
                  <Card key={i} tone="alt" className="mt-7 flex max-w-[68ch] gap-3.5 p-5">
                    <Info size={19} strokeWidth={2.2} className="mt-0.5 shrink-0 text-orange" />
                    <p className="text-[15px] leading-relaxed text-navy/80">{block.text[locale]}</p>
                  </Card>
                )
            }
          })}
        </div>

        {/* Sticky rail: objectives, the sandbox jump, and completion. */}
        <aside className="flex flex-col gap-5 lg:sticky lg:top-[86px] lg:self-start">
          <Card className="p-6">
            <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-teal">
              {t.lessons.objectives}
            </h2>
            <ul className="mt-4 flex flex-col gap-3">
              {lesson.objectives[locale].map((o, oi) => (
                <li key={oi} className="flex items-start gap-2.5 text-[14px] leading-relaxed text-navy/78">
                  <Check size={15} strokeWidth={3} className="mt-0.5 shrink-0 text-teal" />
                  {o}
                </li>
              ))}
            </ul>
          </Card>

          {lesson.sandbox && (
            <Button asChild size="lg" className="w-full">
              <Link href={`/learn/simulator?lesson=${lesson.slug}`}>
                <Wrench size={17} strokeWidth={2.4} />
                {t.lessons.openSandbox}
              </Link>
            </Button>
          )}

          <Button
            variant={done ? 'teal' : 'outline'}
            size="lg"
            className="w-full"
            disabled={!hydrated}
            onClick={() => toggle(lesson.slug)}
          >
            {done ? <Check size={17} strokeWidth={3} /> : null}
            {done ? t.lessons.done : t.lessons.markDone}
          </Button>

          {next && (
            <Card tone="alt" className="p-5">
              <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-navy/50">
                {t.lessons.next}
              </span>
              <Link
                href={`/learn/lessons/${next.slug}`}
                className="mt-2 flex items-center gap-2 rounded font-display text-[15.5px] font-bold text-navy transition-colors hover:text-orange"
              >
                {next.title[locale]}
                <ArrowRight size={16} strokeWidth={2.5} />
              </Link>
            </Card>
          )}
        </aside>
      </Container>
    </article>
  )
}
