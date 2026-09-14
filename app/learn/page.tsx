'use client'

import Link from 'next/link'
import { ArrowRight, BookOpen, MonitorPlay, Sparkles, Users, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, SolderPad } from '@/components/ui/card'
import { Container } from '@/components/site/section'
import { LESSONS } from '@/lib/content/lessons'
import { useI18n } from '@/lib/i18n'
import { useProgress } from '@/lib/useProgress'
import { useLocalState } from '@/lib/useLocalState'
import { useViewer } from '@/lib/auth/use-viewer'
import { hasSupabase } from '@/lib/supabase/config'
import { ACCOUNT_KEY, type Account } from '@/lib/account'

/** Student dashboard (spec §5, [MVP] "basic"). */
export default function LearnPage() {
  const { t, locale } = useI18n()
  const { done, hydrated } = useProgress()
  const [account] = useLocalState<Account | null>(ACCOUNT_KEY, null)
  const { viewer } = useViewer()

  // The signed-in name is the authoritative one; the local copy is the fallback
  // for a browser that registered before there was a backend to register with.
  const name = viewer?.profile.full_name || account?.fields.name || ''

  const available = LESSONS.filter((l) => l.available)
  const nextLesson = available.find((l) => !done.includes(l.slug)) ?? available[0]
  const completed = hydrated ? done.filter((s) => available.some((l) => l.slug === s)).length : 0
  const pct = Math.round((completed / available.length) * 100)

  const cards = [
    { href: '/learn/lessons', icon: BookOpen, copy: t.learn.cards.lessons, tone: 'teal' },
    { href: '/learn/simulator', icon: Wrench, copy: t.learn.cards.sandbox, tone: 'orange' },
    { href: '/learn/videos', icon: MonitorPlay, copy: t.learn.cards.videos, tone: 'teal' },
    // The assistant only appears where it can actually work. On a clone with no
    // backend this card would lead to a "not configured" page, which is a worse
    // introduction to the product than not offering it.
    ...(hasSupabase
      ? ([{ href: '/ai', icon: Sparkles, copy: { title: t.nav.ai, body: t.ai.sub }, tone: 'orange' }] as const)
      : []),
    { href: '/community', icon: Users, copy: t.learn.cards.community, tone: 'orange' },
  ] as const

  return (
    <section className="ard-perf bg-bg py-14 sm:py-20">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-mono text-[12px] font-bold uppercase tracking-[0.16em] text-teal">
              {t.learn.greeting}
              {name ? `, ${name}` : ''}
            </p>
            <h1 className="mt-3 font-display text-[clamp(1.9rem,4.5vw,2.7rem)] text-navy">
              {t.learn.title}
            </h1>
            <p className="mt-3 max-w-[52ch] text-[16px] leading-relaxed text-navy/70">
              {t.learn.sub}
            </p>
          </div>

          {/* Progress as a row of solder pads rather than a bar — it reads at a
              glance for a 10-year-old and matches the board motif. */}
          <Card tone="alt" className="flex items-center gap-4 p-5">
            <div className="flex flex-col">
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-navy/55">
                {t.learn.progress}
              </span>
              <span className="mt-1 font-display text-[26px] font-bold leading-none text-navy">
                {completed}
                <span className="text-navy/35"> / {available.length}</span>
              </span>
            </div>
            <div className="flex gap-1.5" aria-label={`${pct}%`}>
              {available.map((l) => (
                <SolderPad key={l.slug} lit={false} className={done.includes(l.slug) ? '' : 'bg-bg opacity-45'} />
              ))}
            </div>
          </Card>
        </div>

        {nextLesson && (
          <Card tone="navy" className="ard-perf-dense mt-10 flex flex-wrap items-center gap-6 p-7">
            <div className="min-w-0 flex-1">
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-orange">
                {t.learn.continue}
              </span>
              <h2 className="mt-2 font-display text-[21px] font-bold text-bg">
                {nextLesson.title[locale]}
              </h2>
              <p className="mt-1.5 max-w-[56ch] text-[14.5px] leading-relaxed text-bg/65">
                {nextLesson.summary[locale]}
              </p>
            </div>
            <Button asChild size="lg">
              <Link href={`/learn/lessons/${nextLesson.slug}`}>
                {t.lessons.open}
                <ArrowRight size={18} strokeWidth={2.5} />
              </Link>
            </Button>
          </Card>
        )}

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(({ href, icon: Icon, copy, tone }) => (
            <Card key={href} interactive className="h-full p-0">
              <Link href={href} className="flex h-full flex-col gap-3 p-6">
                <span
                  className={`grid size-11 place-items-center rounded-[10px] border-2 border-navy ${
                    tone === 'teal' ? 'bg-teal/12' : 'bg-orange/12'
                  }`}
                >
                  <Icon
                    size={20}
                    strokeWidth={2.2}
                    className={tone === 'teal' ? 'text-teal' : 'text-orange'}
                  />
                </span>
                <span className="font-display text-[17px] font-bold text-navy">{copy.title}</span>
                <span className="text-[14px] leading-relaxed text-navy/65">{copy.body}</span>
              </Link>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  )
}
