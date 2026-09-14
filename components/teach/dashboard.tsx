'use client'

import Link from 'next/link'
import { ArrowRight, MonitorPlay, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, SolderPad } from '@/components/ui/card'
import { Container } from '@/components/site/section'
import { useI18n } from '@/lib/i18n'
import type { ClassBlock } from '@/components/admin/dashboard'

/**
 * `/teach` for a signed-in teacher: their own classes and nothing else.
 *
 * "Their own" is not enforced here — it is enforced by the `classes` and
 * `lesson_progress` policies, which only ever hand this page the rows for
 * classes the caller teaches. The component could not render another teacher's
 * class if it tried.
 *
 * Same aggregate-only rule as the admin panel: completion counts, no per-student
 * work and no conversation content.
 */
export function TeacherDashboard({ name, classes }: { name: string; classes: ClassBlock[] }) {
  const { t, locale } = useI18n()

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(locale === 'en' ? 'en-GB' : 'uz-UZ') : '—'

  const totalStudents = classes.reduce((n, c) => n + c.roster.length, 0)

  const average = (() => {
    const rows = classes.flatMap((c) => c.roster)
    if (!rows.length) return 0
    const done = rows.reduce((n, r) => n + r.completed, 0)
    const total = rows.reduce((n, r) => n + r.total, 0)
    return total ? Math.round((100 * done) / total) : 0
  })()

  return (
    <section className="ard-perf bg-bg py-12 sm:py-16">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-mono text-[12px] font-bold uppercase tracking-[0.16em] text-teal">
              {t.learn.greeting}
              {name ? `, ${name}` : ''}
            </p>
            <h1 className="mt-3 font-display text-[clamp(1.8rem,4.4vw,2.5rem)] text-navy">
              {t.teach.title}
            </h1>
            <p className="mt-3 max-w-[54ch] text-[16px] leading-relaxed text-navy/70">
              {t.teach.sub}
            </p>
          </div>

          <Card tone="alt" className="flex items-center gap-7 p-5">
            <Figure label={t.teach.students} value={totalStudents} />
            <Figure label={t.teach.progress} value={`${average}%`} />
          </Card>
        </div>

        <div className="mt-9 flex items-center gap-3">
          <SolderPad />
          <h2 className="font-display text-[21px] font-bold text-navy">{t.teach.myClasses}</h2>
        </div>

        {classes.length === 0 ? (
          <Card tone="alt" className="mt-5 p-8">
            <p className="text-[15px] text-navy/65">{t.teach.noClasses}</p>
            <Button asChild variant="outline" className="mt-5">
              <Link href="/learn/videos?track=teacher">
                <MonitorPlay size={16} />
                {t.teach.goVideos}
              </Link>
            </Button>
          </Card>
        ) : (
          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            {classes.map((c) => (
              <Card key={c.id} className="overflow-hidden p-0">
                <div className="flex items-center justify-between gap-4 border-b-2 border-navy/12 bg-bg-alt px-5 py-3.5">
                  <p className="truncate font-display text-[16px] font-bold text-navy">{c.name}</p>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-[8px] border-2 border-navy bg-card px-2.5 py-1 font-mono text-[11.5px] font-bold text-navy">
                    <Users size={12} />
                    {c.roster.length}
                  </span>
                </div>

                {c.roster.length === 0 ? (
                  <p className="px-5 py-6 text-center text-[14px] text-navy/55">{t.admin.empty}</p>
                ) : (
                  <ul className="divide-y divide-navy/8">
                    {c.roster.map((s) => (
                      <li key={s.student_id} className="flex items-center gap-4 px-5 py-3">
                        <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold text-navy">
                          {s.full_name || '—'}
                        </span>
                        <span className="shrink-0 font-mono text-[12.5px] text-navy">
                          {s.completed}
                          <span className="text-navy/40">
                            {' '}
                            {t.teach.completedOf} {s.total}
                          </span>
                        </span>
                        <span className="hidden shrink-0 font-mono text-[12px] text-navy/50 sm:inline">
                          {fmt(s.last_active)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ))}
          </div>
        )}

        <Card tone="navy" className="ard-perf-dense mt-10 flex flex-wrap items-center gap-6 p-7">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[19px] font-bold text-bg">{t.teach.trainingTitle}</h2>
            <p className="mt-1.5 max-w-[56ch] text-[14.5px] leading-relaxed text-bg/65">
              {t.teach.trainingSub}
            </p>
          </div>
          <Button asChild variant="onDark">
            <Link href="/learn/videos?track=teacher">
              {t.teach.goVideos}
              <ArrowRight size={17} strokeWidth={2.5} />
            </Link>
          </Button>
        </Card>
      </Container>
    </section>
  )
}

function Figure({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-navy/55">
        {label}
      </span>
      <span className="mt-1 font-display text-[26px] font-bold leading-none text-navy">{value}</span>
    </div>
  )
}
