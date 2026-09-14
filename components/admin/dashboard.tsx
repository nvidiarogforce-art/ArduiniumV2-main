'use client'

import { GraduationCap, Layers, ShieldCheck, TrendingUp, Users } from 'lucide-react'
import { Card, SolderPad } from '@/components/ui/card'
import { Container } from '@/components/site/section'
import { useI18n } from '@/lib/i18n'
import type { ActivityLevel } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

export type Overview = {
  students: number
  teachers: number
  classes: number
  lessons: number
  completions: number
  completionRate: number
}

export type TeacherRow = {
  teacher_id: string
  full_name: string
  last_active: string | null
  level: ActivityLevel
  class_count: number
  student_count: number
}

export type RosterEntry = {
  student_id: string
  full_name: string
  grade: string | null
  completed: number
  total: number
  last_active: string | null
}

export type ClassBlock = { id: string; name: string; teacher: string | null; roster: RosterEntry[] }

/**
 * `/admin` — the school dashboard.
 *
 * Every number on this page comes from a real aggregate over whatever is in the
 * database (see `admin_overview()` / `admin_teacher_activity()`); nothing is
 * padded, and a school with four students says four. A dashboard that rounds an
 * empty database up to a plausible-looking figure is worse than an empty
 * dashboard, because after that nobody can trust the numbers that are real.
 */
export function AdminDashboard({
  schoolName,
  overview,
  teachers,
  classes,
}: {
  schoolName: string
  overview: Overview
  teachers: TeacherRow[]
  classes: ClassBlock[]
}) {
  const { t, locale } = useI18n()

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(locale === 'en' ? 'en-GB' : 'uz-UZ') : t.admin.never

  // "Worth checking in with" — the two quietest buckets, plus anyone who has
  // not started. This is the list an admin acts on, so it leads.
  const quiet = teachers.filter((x) => x.level === 'dormant' || x.level === 'never')

  const stats = [
    { icon: Users, label: t.admin.stats.students, value: overview.students, tone: 'teal' },
    { icon: GraduationCap, label: t.admin.stats.teachers, value: overview.teachers, tone: 'orange' },
    { icon: Layers, label: t.admin.stats.classes, value: overview.classes, tone: 'teal' },
    {
      icon: TrendingUp,
      label: t.admin.stats.completion,
      value: `${overview.completionRate}%`,
      tone: 'orange',
    },
  ] as const

  return (
    <section className="ard-perf bg-bg py-12 sm:py-16">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="ard-kicker">
              <ShieldCheck size={13} />
              {schoolName}
            </p>
            <h1 className="mt-3 font-display text-[clamp(1.8rem,4.4vw,2.6rem)] text-navy">
              {t.admin.title}
            </h1>
            <p className="mt-3 max-w-[56ch] text-[16px] leading-relaxed text-navy/70">
              {t.admin.sub}
            </p>
          </div>
          <p className="max-w-[34ch] rounded-[10px] border-2 border-teal/40 bg-teal/8 px-4 py-3 text-[12.5px] leading-relaxed text-navy/75">
            <ShieldCheck size={14} className="mr-1.5 inline text-teal" />
            {t.admin.privacyNote}
          </p>
        </div>

        {/* ------------------------------------------------------- overview */}
        <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(({ icon: Icon, label, value, tone }) => (
            <Card key={label} className="p-6">
              <span
                className={cn(
                  'grid size-10 place-items-center rounded-[10px] border-2 border-navy',
                  tone === 'teal' ? 'bg-teal/12' : 'bg-orange/12',
                )}
              >
                <Icon size={19} strokeWidth={2.2} className={tone === 'teal' ? 'text-teal' : 'text-orange'} />
              </span>
              <p className="mt-4 font-display text-[34px] font-bold leading-none text-navy">{value}</p>
              <p className="mt-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-navy/55">
                {label}
              </p>
            </Card>
          ))}
        </div>

        {/* ------------------------------------------------------- activity */}
        <div className="mt-12">
          <div className="flex items-center gap-3">
            <SolderPad />
            <h2 className="font-display text-[22px] font-bold text-navy">{t.admin.activityTitle}</h2>
          </div>
          <p className="mt-2 max-w-[62ch] text-[14.5px] leading-relaxed text-navy/65">
            {t.admin.activitySub}
          </p>

          {teachers.length === 0 ? (
            <Card tone="alt" className="mt-5 p-8 text-center text-[14.5px] text-navy/60">
              {t.admin.noTeachers}
            </Card>
          ) : (
            <>
              {quiet.length > 0 && (
                <Card tone="alt" className="mt-5 p-5">
                  <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-orange">
                    {t.admin.checkIn}
                  </p>
                  <p className="mt-2 text-[14.5px] text-navy/80">
                    {quiet.map((x) => x.full_name).join(' · ')}
                  </p>
                </Card>
              )}
              {quiet.length === 0 && (
                <Card tone="alt" className="mt-5 p-5 text-[14.5px] text-navy/70">
                  {t.admin.allActive}
                </Card>
              )}

              <Card className="mt-5 overflow-hidden p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse text-left">
                    <thead>
                      <tr className="border-b-2 border-navy/12 bg-bg-alt">
                        <Th>{t.admin.stats.teachers}</Th>
                        <Th>{t.admin.stats.classes}</Th>
                        <Th>{t.admin.stats.students}</Th>
                        <Th>{t.admin.lastActive}</Th>
                        <Th>{t.admin.activityTitle}</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {teachers.map((x) => (
                        <tr key={x.teacher_id} className="border-b border-navy/8 last:border-0">
                          <Td className="font-bold">{x.full_name || '—'}</Td>
                          <Td>{x.class_count}</Td>
                          <Td>{x.student_count}</Td>
                          <Td className="font-mono text-[12.5px] text-navy/65">{fmt(x.last_active)}</Td>
                          <Td>
                            <LevelChip level={x.level} label={t.admin.levels[x.level]} />
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>

        {/* -------------------------------------------------------- classes */}
        <div className="mt-12">
          <div className="flex items-center gap-3">
            <SolderPad lit={false} />
            <h2 className="font-display text-[22px] font-bold text-navy">{t.admin.classesTitle}</h2>
          </div>
          <p className="mt-2 max-w-[62ch] text-[14.5px] leading-relaxed text-navy/65">
            {t.admin.classesSub}
          </p>

          {classes.length === 0 ? (
            <Card tone="alt" className="mt-5 p-8 text-center text-[14.5px] text-navy/60">
              {t.admin.noClasses}
            </Card>
          ) : (
            <div className="mt-5 grid gap-6 lg:grid-cols-2">
              {classes.map((c) => (
                <Card key={c.id} className="overflow-hidden p-0">
                  <div className="flex items-center justify-between gap-4 border-b-2 border-navy/12 bg-bg-alt px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate font-display text-[16px] font-bold text-navy">{c.name}</p>
                      {c.teacher && <p className="truncate text-[12.5px] text-navy/60">{c.teacher}</p>}
                    </div>
                    <span className="shrink-0 rounded-[8px] border-2 border-navy bg-card px-2.5 py-1 font-mono text-[11.5px] font-bold text-navy">
                      {c.roster.length}
                    </span>
                  </div>

                  {c.roster.length === 0 ? (
                    <p className="px-5 py-6 text-center text-[14px] text-navy/55">{t.admin.empty}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[420px] border-collapse text-left">
                        <thead>
                          <tr className="border-b border-navy/10">
                            <Th>{t.admin.student}</Th>
                            <Th>{t.admin.grade}</Th>
                            <Th>{t.admin.completed}</Th>
                            <Th>{t.admin.lastActive}</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.roster.map((s) => (
                            <tr key={s.student_id} className="border-b border-navy/8 last:border-0">
                              <Td className="font-semibold">{s.full_name || '—'}</Td>
                              <Td>{s.grade ?? '—'}</Td>
                              <Td>
                                <span className="font-mono text-[12.5px]">
                                  {s.completed}
                                  <span className="text-navy/40"> / {s.total}</span>
                                </span>
                              </Td>
                              <Td className="font-mono text-[12.5px] text-navy/65">
                                {fmt(s.last_active)}
                              </Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </Container>
    </section>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.1em] text-navy/55">
      {children}
    </th>
  )
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn('px-4 py-3 text-[14px] text-navy', className)}>{children}</td>
}

/**
 * Deliberately not a green/red dot.
 *
 * Even the "quiet for 2+ weeks" chip is neutral navy rather than an alarm
 * colour — the frame is "someone the school might want to talk to", not a
 * performance flag, and colour is where that intent leaks first.
 */
function LevelChip({ level, label }: { level: ActivityLevel; label: string }) {
  const tone =
    level === 'today' || level === 'week'
      ? 'border-teal/50 bg-teal/12 text-navy'
      : level === 'fortnight'
        ? 'border-navy/25 bg-navy/6 text-navy/80'
        : 'border-orange/45 bg-orange/10 text-navy'

  return (
    <span
      className={cn(
        'inline-block rounded-[7px] border-2 px-2.5 py-1 text-[12px] font-bold whitespace-nowrap',
        tone,
      )}
    >
      {label}
    </span>
  )
}
