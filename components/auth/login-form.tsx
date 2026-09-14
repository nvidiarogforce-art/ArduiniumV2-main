'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { Container } from '@/components/site/section'
import { Ardu } from '@/components/brand/logo'
import { signIn } from '@/lib/auth/actions'
import { useI18n } from '@/lib/i18n'

/** Map the server action's error codes onto the dictionary. */
function messageFor(t: ReturnType<typeof useI18n>['t'], code: string): string {
  const e = t.auth.errors
  switch (code) {
    case 'invalid-credentials':
      return e.invalidCredentials
    case 'rate-limited':
      return e.rateLimited
    case 'not-configured':
      return e.notConfigured
    default:
      return e.unknown
  }
}

/**
 * Sign-in.
 *
 * Deliberately its own route rather than a tab on `/register`: registration is
 * a three-step decision with a role picker, and a returning teacher on a school
 * laptop wants two fields and a button. It reuses the registration page's dark
 * band so the two read as one flow.
 */
export function LoginForm({ next }: { next: string }) {
  const { t } = useI18n()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    start(async () => {
      const result = await signIn(email.trim(), password)
      if (!result.ok) {
        setError(messageFor(t, result.error))
        return
      }
      router.replace(next)
      // The header and every server component above this route read the session
      // during render, so the tree has to be rebuilt rather than just navigated.
      router.refresh()
    })
  }

  return (
    <section className="ard-page-dark relative isolate overflow-hidden">
      <Container className="relative z-10 grid items-center gap-14 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
        <div>
          <span className="ard-kicker">{t.nav.login}</span>
          <h1 className="mt-4 font-display text-[clamp(1.8rem,4.6vw,2.7rem)] text-bg">
            {t.auth.loginTitle}
          </h1>
          <p className="mt-4 max-w-[48ch] text-[16px] leading-relaxed text-bg/72">
            {t.auth.loginSub}
          </p>

          <Card className="mt-8 max-w-[440px] p-7">
            <form onSubmit={submit} className="grid gap-5">
              <Field label={t.auth.email} htmlFor="login-email">
                <Input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field label={t.auth.password} htmlFor="login-password">
                <Input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>

              {error && (
                <p
                  role="alert"
                  className="rounded-[9px] border-2 border-orange bg-orange/10 px-3.5 py-2.5 text-[13.5px] font-semibold text-navy"
                >
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" disabled={pending}>
                <LogIn size={17} strokeWidth={2.5} />
                {pending ? t.auth.signingIn : t.auth.signIn}
              </Button>

              <p className="text-center text-[13.5px] text-navy/65">
                {t.auth.noAccount}{' '}
                <Link href="/register" className="font-bold text-orange hover:underline">
                  {t.auth.toRegister}
                </Link>
              </p>
            </form>
          </Card>
        </div>

        <div className="relative mx-auto hidden w-full max-w-[300px] lg:block">
          <div className="ard-perf-dense rounded-[18px] border-2 border-bg/70 bg-navy-2/60 p-6 shadow-[10px_10px_0_var(--color-teal)]">
            <Ardu width={260} className="h-auto w-full" />
          </div>
          <Link
            href="/register"
            className="absolute -bottom-5 left-2 inline-flex -rotate-2 items-center gap-1.5 rounded-[10px] border-2 border-navy bg-orange px-4 py-2 text-[12.5px] font-extrabold text-white shadow-hard-sm"
          >
            {t.register.sticker}
            <ArrowRight size={14} strokeWidth={3} />
          </Link>
        </div>
      </Container>
    </section>
  )
}
