'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Info, LogOut, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Container } from '@/components/site/section'
import { LangToggle } from '@/components/site/lang-toggle'
import { useI18n } from '@/lib/i18n'
import { useLocalState } from '@/lib/useLocalState'
import { useProgress } from '@/lib/useProgress'
import { useViewer } from '@/lib/auth/use-viewer'
import { signOut } from '@/lib/auth/actions'
import { ACCOUNT_KEY, type Account } from '@/lib/account'
import { LESSONS } from '@/lib/content/lessons'

/**
 * Profile. Still no subscription or billing — that stays out of scope
 * (Phase 2 §7) — but with a backend the details come from the `profiles` row
 * rather than from whatever happens to be in this browser's localStorage.
 */
export default function AccountPage() {
  const { t, locale } = useI18n()
  const [account, setAccount, hydrated] = useLocalState<Account | null>(ACCOUNT_KEY, null)
  const { done, reset } = useProgress()
  const { viewer, loading } = useViewer()
  const [pending, start] = useTransition()
  const router = useRouter()

  const available = LESSONS.filter((l) => l.available)
  const completed = done.filter((s) => available.some((l) => l.slug === s)).length

  const clear = () => {
    setAccount(null)
    reset()
  }

  /**
   * A real profile wins over the local one.
   *
   * Somebody who registers on one machine and signs in on another has an empty
   * localStorage there; reading the server row first is what makes the page
   * show them rather than "you have not registered yet".
   */
  const rows: Array<[string, string]> = viewer
    ? ([
        [t.register.fields.name, viewer.profile.full_name],
        [t.account.email, viewer.email ?? '—'],
        viewer.profile.grade ? [t.register.fields.grade, viewer.profile.grade] : null,
        viewer.profile.subject ? [t.register.fields.subject, viewer.profile.subject] : null,
        viewer.profile.school_name ? [t.account.school, viewer.profile.school_name] : null,
      ].filter(Boolean) as Array<[string, string]>)
    : Object.entries(account?.fields ?? {}).map(([k, v]) => [
        t.register.fields[k as keyof typeof t.register.fields] ?? k,
        v,
      ])

  const roleLabel = viewer
    ? viewer.profile.role === 'school_admin'
      ? t.nav.admin
      : viewer.profile.role === 'teacher'
        ? t.community.roleTeacher
        : t.community.roleStudent
    : account
      ? t.register.roles[account.role].title
      : ''

  const known = Boolean(viewer || account)

  return (
    <section className="ard-perf bg-bg py-14 sm:py-20">
      <Container className="max-w-[720px]">
        <h1 className="font-display text-[clamp(1.9rem,4.5vw,2.7rem)] text-navy">{t.account.title}</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-navy/70">{t.account.sub}</p>

        {!hydrated || loading ? (
          <Card className="mt-9 p-8">
            <p className="text-[15px] text-navy/50">{t.common.loading}</p>
          </Card>
        ) : !known ? (
          <Card tone="alt" className="mt-9 flex flex-col items-start gap-4 p-8">
            <p className="text-[15.5px] text-navy/75">{t.account.noAccount}</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/register">{t.account.register}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/login">{t.auth.signIn}</Link>
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="mt-9 divide-y-2 divide-navy/10 p-0">
            <Row label={t.account.role} value={roleLabel} />
            {rows.map(([label, v]) => (
              <Row key={label} label={label} value={v} />
            ))}
            <Row
              label={t.learn.progress}
              value={
                <span className="inline-flex items-center gap-2">
                  {completed} / {available.length}
                  {completed === available.length && completed > 0 && (
                    // Pink is the reserved achievement colour (§4.1).
                    <span className="rounded-[6px] border-2 border-navy bg-pink px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-white">
                      100%
                    </span>
                  )}
                </span>
              }
            />
            <div className="flex items-center justify-between gap-4 px-6 py-4">
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-navy/55">
                {t.account.language}
              </span>
              <LangToggle />
            </div>
            <div className="flex flex-wrap gap-2 px-6 py-5">
              {viewer ? (
                <Button
                  variant="ghost"
                  className="text-orange"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await signOut()
                      router.replace('/')
                      router.refresh()
                    })
                  }
                >
                  <LogOut size={16} strokeWidth={2.3} />
                  {t.account.signOut}
                </Button>
              ) : (
                <Button variant="ghost" onClick={clear} className="text-orange">
                  <Trash2 size={16} strokeWidth={2.3} />
                  {t.account.reset}
                </Button>
              )}
            </div>
          </Card>
        )}

        <p className="mt-8 inline-flex items-center gap-2 text-[13px] text-navy/50">
          <Info size={15} />
          {t.account.stubNote}
        </p>
      </Container>
    </section>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-4">
      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-navy/55">
        {label}
      </span>
      <span className="text-right font-display text-[15px] font-bold text-navy">{value}</span>
    </div>
  )
}
