'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Clock, Film, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Container } from '@/components/site/section'
import { VideoCard } from '@/components/site/video-card'
import { VIDEOS, getVideo } from '@/lib/content/videos'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export function VideoPlayerView({ slug }: { slug: string }) {
  const { t, locale } = useI18n()
  const video = getVideo(slug)
  const [answers, setAnswers] = useState<Record<number, number>>({})

  if (!video) return null

  const related = VIDEOS.filter((v) => v.track === video.track && v.slug !== video.slug).slice(0, 3)

  return (
    <section className="ard-perf bg-bg py-12 sm:py-16">
      <Container>
        <Link
          href={video.track === 'teacher' ? '/learn/videos?track=teacher' : '/learn/videos'}
          className="inline-flex items-center gap-1.5 rounded-md text-[13.5px] font-bold text-navy/65 transition-colors hover:text-orange"
        >
          <ArrowLeft size={15} />
          {t.videos.title}
        </Link>

        <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            {/**
             * A real <video> element when there is a source, and an explicit
             * placeholder panel when there is not.
             *
             * §11 leaves video hosting an open decision, so no source exists
             * yet. Rendering a <video> with an empty src would show a broken
             * player; embedding someone else's clip would misrepresent the
             * content. This says exactly what it is.
             */}
            {video.src ? (
              <Card className="overflow-hidden p-0">
                <video controls preload="metadata" className="aspect-video w-full bg-navy">
                  <source src={video.src} />
                </video>
              </Card>
            ) : (
              <Card
                tone="navy"
                className="ard-perf-dense flex aspect-video flex-col items-center justify-center gap-4 p-8 text-center"
              >
                <span className="grid size-14 place-items-center rounded-full border-2 border-bg/25 bg-bg/8">
                  <Film size={24} strokeWidth={2} className="text-bg/60" />
                </span>
                <p className="max-w-[34ch] font-mono text-[12.5px] uppercase tracking-[0.12em] text-bg/55">
                  {t.videos.placeholder}
                </p>
              </Card>
            )}

            <div className="mt-7">
              <span className={cn(
                'font-mono text-[11px] font-bold uppercase tracking-[0.14em]',
                video.track === 'teacher' ? 'text-pink' : 'text-teal',
              )}>
                {video.track === 'teacher' ? t.videos.trackTeacher : t.videos.trackStudent}
              </span>
              <h1 className="mt-2 font-display text-[clamp(1.6rem,4vw,2.2rem)] text-navy">
                {video.title[locale]}
              </h1>
              <p className="mt-3 max-w-[62ch] text-[16px] leading-relaxed text-navy/72">
                {video.summary[locale]}
              </p>
              <p className="mt-4 inline-flex items-center gap-1.5 font-mono text-[12px] font-bold uppercase tracking-[0.1em] text-navy/50">
                <Clock size={13} />
                {video.minutes} {t.common.minutes}
              </p>
            </div>

            {/* Self-check (spec §7.5 stretch goal). Local, unscored, no
                submission — it exists to make the reader retrieve the answer,
                not to grade them. */}
            {video.quiz && (
              <Card tone="alt" className="mt-9 p-7">
                <h2 className="font-display text-[18px] font-bold text-navy">{t.videos.check}</h2>
                <p className="mt-1.5 text-[13.5px] text-navy/60">{t.videos.checkNote}</p>

                <ol className="mt-6 flex flex-col gap-7">
                  {video.quiz.map((item, qi) => {
                    const picked = answers[qi]
                    return (
                      <li key={qi}>
                        <p className="font-display text-[15.5px] font-bold text-navy">
                          {item.q[locale]}
                        </p>
                        <div className="mt-3 flex flex-col gap-2">
                          {item.options[locale].map((opt, oi) => {
                            const chosen = picked === oi
                            const correct = oi === item.answer
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                                className={cn(
                                  'flex items-center gap-2.5 rounded-[9px] border-2 px-3.5 py-2.5 text-left text-[14.5px] font-medium transition-colors',
                                  chosen && correct && 'border-navy bg-teal text-white',
                                  chosen && !correct && 'border-navy bg-orange/15 text-navy',
                                  !chosen && 'border-navy/25 bg-card text-navy/80 hover:border-navy',
                                )}
                              >
                                {chosen ? (
                                  correct ? (
                                    <Check size={16} strokeWidth={3} />
                                  ) : (
                                    <X size={16} strokeWidth={3} className="text-orange" />
                                  )
                                ) : (
                                  <span aria-hidden className="size-4 rounded-full border-2 border-navy/30" />
                                )}
                                {opt}
                              </button>
                            )
                          })}
                        </div>
                        {picked !== undefined && (
                          <p
                            className={cn(
                              'mt-2 font-mono text-[12px] font-bold uppercase tracking-[0.1em]',
                              picked === item.answer ? 'text-teal' : 'text-orange',
                            )}
                          >
                            {picked === item.answer ? t.videos.correct : t.videos.wrong}
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ol>
              </Card>
            )}
          </div>

          {/* self-start, or the grid stretches the column to the full row
              height and VideoCard's `h-full` (which it needs in a grid, for
              equal-height rows) turns each related card into a mostly-empty
              tall box. */}
          <aside className="flex flex-col gap-5 self-start">
            {related.map((v, i) => (
              <VideoCard key={v.slug} video={v} index={i} />
            ))}
          </aside>
        </div>
      </Container>
    </section>
  )
}
