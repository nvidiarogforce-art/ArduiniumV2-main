'use client'

import Link from 'next/link'
import {
  ArrowRight,
  Award,
  BookOpen,
  Check,
  CircleDollarSign,
  Cpu,
  GraduationCap,
  MessagesSquare,
  PlayCircle,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/site/section'
import { Gear, Rise, Words } from '@/components/site/reveal'
import { Tilt } from '@/components/site/tilt'
import { VideoCard } from '@/components/site/video-card'
import { PostCard } from '@/components/site/post-card'
import { VIDEOS } from '@/lib/content/videos'
import { SEED_POSTS } from '@/lib/content/community'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/**
 * Gear props for the card at index `i` in a grid `cols` wide.
 *
 * Outer columns swing in from their own edge and the middle rises straight
 * up; every neighbouring column turns the opposite way, so a row meshes like
 * a gear train instead of tilting in unison. The stagger runs across the row
 * rather than down the list, so a 6-card grid arrives as two turning rows.
 */
const gear = (i: number, cols: number) => {
  const col = i % cols
  return {
    dir: (cols < 2 ? 0 : col === 0 ? -1 : col === cols - 1 ? 1 : 0) as -1 | 0 | 1,
    spin: (col % 2 === 0 ? -1 : 1) as 1 | -1,
    delay: col * 120,
  }
}

/* ------------------------------------------------------------ shared head */

function Head({
  eyebrow,
  title,
  sub,
  center,
  dark,
}: {
  eyebrow: string
  title: string
  sub?: string
  center?: boolean
  dark?: boolean
}) {
  return (
    <div className={cn(center && 'text-center')}>
      <Rise>
        <span className="ard-kicker">{eyebrow}</span>
      </Rise>
      <Words
        text={title}
        className={cn(
          'mt-4 font-display text-[clamp(1.75rem,4.2vw,2.75rem)] font-extrabold leading-[1.08] tracking-[-0.02em]',
          center && 'mx-auto max-w-[20ch]',
          dark ? 'text-bg' : 'text-navy',
        )}
      />
      {sub && (
        <Rise delay={90}>
          <p
            className={cn(
              'mt-4 max-w-[58ch] text-[17px] leading-relaxed',
              center && 'mx-auto',
              dark ? 'text-bg/72' : 'text-navy/72',
            )}
          >
            {sub}
          </p>
        </Rise>
      )}
    </div>
  )
}

/** Cream card surface, shared by most sections. */
function CardBox({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'h-full rounded-[14px] border-2 border-navy bg-card p-7 shadow-hard',
        className,
      )}
    >
      {children}
    </div>
  )
}

function Tile({ tone, children }: { tone: 'teal' | 'orange' | 'pink'; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'grid size-[50px] place-items-center rounded-[12px] border-2 border-navy text-white shadow-hard-sm transition-transform duration-200',
        tone === 'teal' && 'bg-teal',
        tone === 'orange' && 'bg-orange',
        tone === 'pink' && 'bg-pink',
      )}
    >
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------ problem */

const PROBLEM_ICONS = [CircleDollarSign, Users, ShieldCheck]
const PROBLEM_TONES = ['orange', 'teal', 'pink'] as const

export function Problem() {
  const { t } = useI18n()
  return (
    <section
      id="problem"
      className="border-y-2 border-navy bg-[color-mix(in_srgb,var(--color-bg-alt)_62%,transparent)] py-24 sm:py-28"
    >
      <Container>
        <Head eyebrow={t.problem.eyebrow} title={t.problem.title} sub={t.problem.body} />
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {t.problem.items.map((item, i) => {
            const Icon = PROBLEM_ICONS[i]
            return (
              <Gear key={i} {...gear(i, 3)}>
                <Tilt className="h-full rounded-[14px]">
                  <CardBox>
                    <Tile tone={PROBLEM_TONES[i]}>
                      <Icon size={23} strokeWidth={2.2} />
                    </Tile>
                    <h3 className="mt-5 font-display text-[19px] font-extrabold text-navy">
                      {item.title}
                    </h3>
                    <p className="mt-2.5 text-[15px] leading-relaxed text-navy/72">{item.body}</p>
                  </CardBox>
                </Tilt>
              </Gear>
            )
          })}
        </div>
      </Container>
    </section>
  )
}

/* ----------------------------------------------------------------- features */

const FEATURE_ICONS = [Cpu, BookOpen, PlayCircle, MessagesSquare, GraduationCap, Award]
const FEATURE_TONES = ['teal', 'orange', 'pink', 'teal', 'orange', 'pink'] as const

export function Features() {
  const { t } = useI18n()
  return (
    <section id="features" className="py-24 sm:py-28">
      <Container>
        <Head eyebrow={t.features.eyebrow} title={t.features.title} sub={t.features.sub} />
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {t.features.items.map((item, i) => {
            const Icon = FEATURE_ICONS[i]
            return (
              <Gear key={i} {...gear(i, 3)}>
                <Tilt className="h-full rounded-[14px]">
                  <CardBox>
                    <div className="flex items-center justify-between">
                      <Tile tone={FEATURE_TONES[i]}>
                        <Icon size={23} strokeWidth={2.2} />
                      </Tile>
                      <span className="font-mono text-[12px] font-bold tracking-[0.14em] text-navy/25">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <h3 className="mt-5 font-display text-[19px] font-extrabold text-navy">
                      {item.title}
                    </h3>
                    <p className="mt-2.5 text-[15px] leading-relaxed text-navy/72">{item.body}</p>
                  </CardBox>
                </Tilt>
              </Gear>
            )
          })}
        </div>
      </Container>
    </section>
  )
}

/* --------------------------------------------------------------- how it works */

export function HowItWorks() {
  const { t } = useI18n()
  return (
    <section id="how" className="ard-band-dark relative isolate overflow-hidden py-24 sm:py-28">
      <Container>
        <Head eyebrow={t.how.eyebrow} title={t.how.title} sub={t.how.sub} dark />
        <ol className="relative mt-16 grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* The dashed track only makes sense when all four steps are on one
              row; below lg the steps stack and it would run through nothing. */}
          <span
            aria-hidden
            className="absolute left-[12%] right-[12%] top-[27px] hidden border-t-[3px] border-dashed border-bg/30 lg:block"
          />
          {t.how.steps.map((step, i) => (
            <Rise as="li" key={step.n} delay={i * 120} className="relative">
              <span className="grid size-[54px] place-items-center rounded-[14px] border-2 border-bg bg-orange font-display text-[19px] font-extrabold text-white shadow-[4px_4px_0_var(--color-navy-2)] transition-transform duration-200 hover:rotate-[-6deg] hover:scale-110">
                {i + 1}
              </span>
              <span className="mt-5 block font-mono text-[12px] font-bold tracking-[0.16em] text-orange">
                {step.n}
              </span>
              <h3 className="mt-2 font-display text-[19px] font-extrabold text-bg">{step.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-bg/72">{step.body}</p>
            </Rise>
          ))}
        </ol>
      </Container>
    </section>
  )
}

/* ----------------------------------------------------------------- outcomes */

export function Achieve() {
  const { t } = useI18n()
  const cols = [
    { title: t.achieve.kidsTitle, items: t.achieve.kids, dark: false, icon: GraduationCap },
    { title: t.achieve.teachersTitle, items: t.achieve.teachers, dark: true, icon: Award },
  ]

  return (
    <section id="outcomes" className="py-24 sm:py-28">
      <Container>
        <Head eyebrow={t.achieve.eyebrow} title={t.achieve.title} />
        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {cols.map((col, i) => {
            const Icon = col.icon
            return (
              <Gear key={i} {...gear(i, 2)}>
                <Tilt dark={col.dark} className="h-full rounded-[14px]" max={5}>
                  <CardBox className={cn(col.dark && 'bg-navy text-bg')}>
                    <Tile tone={col.dark ? 'orange' : 'teal'}>
                      <Icon size={23} strokeWidth={2.2} />
                    </Tile>
                    <h3
                      className={cn(
                        'mt-5 font-display text-[21px] font-extrabold',
                        col.dark ? 'text-bg' : 'text-navy',
                      )}
                    >
                      {col.title}
                    </h3>
                    <ul className="mt-5 flex flex-col gap-3.5">
                      {col.items.map((item, li) => (
                        <li key={li} className="flex items-start gap-3 text-[15.5px] font-semibold leading-snug">
                          <span
                            className={cn(
                              'mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-full text-white',
                              col.dark ? 'bg-orange' : 'bg-teal',
                            )}
                          >
                            <Check size={13} strokeWidth={3.5} />
                          </span>
                          <span className={col.dark ? 'text-bg/88' : 'text-navy/82'}>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardBox>
                </Tilt>
              </Gear>
            )
          })}
        </div>
      </Container>
    </section>
  )
}

/* -------------------------------------------------------------- Papert quote */

export function Quote() {
  const { t, locale } = useI18n()
  return (
    <section
      id="quote"
      className="border-y-2 border-navy bg-[color-mix(in_srgb,var(--color-bg-alt)_62%,transparent)] py-24 sm:py-28"
    >
      <Container>
        <Rise className="relative mx-auto max-w-[900px]">
          <div className="relative rounded-[14px] border-2 border-navy bg-card p-10 shadow-hard sm:p-12">
            <span className="absolute -top-6 left-8 grid size-[52px] place-items-center rounded-[14px] border-2 border-navy bg-orange pb-3 font-display text-[34px] font-extrabold leading-none text-white shadow-hard-sm">
              ”
            </span>
            <p className="ard-kicker">{t.quote.lead}</p>
            <blockquote className="mt-5">
              <p className="text-[clamp(1.05rem,2.1vw,1.35rem)] font-semibold leading-[1.6] text-navy">
                {t.quote.text}
              </p>
              <cite className="mt-6 block font-display text-[14.5px] font-extrabold not-italic text-orange">
                {t.quote.author} — {t.quote.source}
              </cite>
            </blockquote>
            {/* The quote itself is never translated; this is a clearly
                labelled rendering, shown to Uzbek readers only. */}
            {locale === 'uz' && t.quote.translation && (
              <p className="mt-6 border-t-2 border-navy/12 pt-5 text-[15px] leading-relaxed text-navy/72">
                {t.quote.translation}
              </p>
            )}
          </div>
        </Rise>
      </Container>
    </section>
  )
}

/* ------------------------------------------------------------------ teasers */

export function VideosTeaser() {
  const { t } = useI18n()
  const sample = VIDEOS.filter((v) => v.track === 'student').slice(0, 3)

  return (
    <section id="videos" className="py-24 sm:py-28">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Head eyebrow={t.videosTeaser.eyebrow} title={t.videosTeaser.title} sub={t.videosTeaser.sub} />
          <Rise>
            <Button asChild variant="outline">
              <Link href="/learn/videos">
                {t.videosTeaser.all}
                <ArrowRight size={16} strokeWidth={2.5} />
              </Link>
            </Button>
          </Rise>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sample.map((v, i) => (
            <Gear key={v.slug} {...gear(i, 3)}>
              <Tilt className="h-full rounded-[14px]" max={5}>
                <VideoCard video={v} index={i} />
              </Tilt>
            </Gear>
          ))}
        </div>
      </Container>
    </section>
  )
}

export function CommunityTeaser() {
  const { t } = useI18n()
  const sample = SEED_POSTS.slice(0, 2)

  return (
    <section
      id="community"
      className="border-y-2 border-navy bg-[color-mix(in_srgb,var(--color-bg-alt)_62%,transparent)] py-24 sm:py-28"
    >
      <Container>
        <Head eyebrow={t.communityTeaser.eyebrow} title={t.communityTeaser.title} sub={t.communityTeaser.sub} />
        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {sample.map((p, i) => (
            <Gear key={p.id} {...gear(i, 3)}>
              <Tilt className="h-full rounded-[14px]" max={5}>
                <PostCard post={p} />
              </Tilt>
            </Gear>
          ))}
          <Gear {...gear(2, 3)}>
            <Tilt dark className="h-full rounded-[14px]" max={5}>
              <CardBox className="flex flex-col justify-center gap-4 bg-navy text-bg shadow-[4px_4px_0_var(--color-orange)]">
                <h3 className="font-display text-[21px] font-extrabold text-bg">
                  {t.communityTeaser.joinTitle}
                </h3>
                <p className="text-[15px] leading-relaxed text-bg/74">{t.communityTeaser.joinBody}</p>
                <Button asChild variant="onDark" className="mt-1 self-start">
                  <Link href="/community">{t.communityTeaser.join}</Link>
                </Button>
              </CardBox>
            </Tilt>
          </Gear>
        </div>
      </Container>
    </section>
  )
}

/* ---------------------------------------------------------------- final CTA */

export function FinalCta() {
  const { t } = useI18n()
  return (
    <section className="border-y-2 border-navy bg-orange py-20 sm:py-24">
      <Container className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        <Rise>
          <h2 className="font-display text-[clamp(1.6rem,3.6vw,2.5rem)] font-extrabold leading-tight text-navy">
            {t.finalCta.title}
          </h2>
          <p className="mt-4 max-w-[46ch] text-[17px] text-navy/80">{t.finalCta.sub}</p>
          <Button asChild size="lg" variant="cream" className="mt-8">
            <Link href="/register">
              {t.finalCta.button}
              <ArrowRight size={18} strokeWidth={2.5} />
            </Link>
          </Button>
        </Rise>
        <Rise delay={120} className="hidden justify-self-end lg:block">
          <div className="ard-perf-dense rotate-2 rounded-[14px] border-2 border-navy bg-card p-6 shadow-[6px_6px_0_var(--color-navy)] transition-transform duration-200 hover:-rotate-2 hover:scale-[1.02]">
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 9 }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    'size-10 rounded-[8px] border-2 border-navy',
                    i % 4 === 0 ? 'bg-teal' : i % 3 === 0 ? 'bg-orange' : 'bg-bg-alt',
                  )}
                />
              ))}
            </div>
          </div>
        </Rise>
      </Container>
    </section>
  )
}
