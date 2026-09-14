'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, Cpu, GraduationCap, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { Container } from '@/components/site/section'
import { Ardu } from '@/components/brand/logo'
import { useI18n } from '@/lib/i18n'
import { useLocalState } from '@/lib/useLocalState'
import { signUp } from '@/lib/auth/actions'
import { hasSupabase } from '@/lib/supabase/config'
import { ROLES, ROLE_FIELDS, ROLE_HOME, isRole, type Account, type Role, ACCOUNT_KEY } from '@/lib/account'
import { cn } from '@/lib/utils'

/* A chip for the student (what they will actually be programming) and the cap
   for the teacher — the cap on a student card read as "graduate", which is
   the wrong end of the journey. */
const ROLE_ICON = { student: Cpu, teacher: GraduationCap } as const
const ROLE_TONE = { student: 'bg-teal', teacher: 'bg-orange' } as const

/**
 * Registration: a role picker, then a short role-specific form, then a
 * confirmation — mirrored on the three-step stepper.
 *
 * Two roles only; see the note in `lib/account.ts`. The database enum knows
 * about `school_admin` and `buyer` too, and deliberately does not offer them
 * here: school access is granted out of band, and the signup metadata is
 * filtered server-side (`handle_new_user()`) so a crafted request cannot mint
 * an admin either.
 *
 * Phase 1 had no auth and faked none — the answers went to localStorage and the
 * form said so. Phase 2 keeps that shape and adds two fields: with a backend
 * configured this creates a real account, and without one it behaves exactly as
 * before, including the honest "stays in your browser" note.
 */
export function RegisterFlow() {
  const { t } = useI18n()
  const router = useRouter()
  const params = useSearchParams()

  const requested = params.get('role')
  const [role, setRole] = useState<Role | null>(isRole(requested) ? requested : null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [done, setDone] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [, setAccount] = useLocalState<Account | null>(ACCOUNT_KEY, null)

  const step = done ? 3 : role ? 2 : 1

  const errorFor = (code: string) => {
    const e = t.auth.errors
    return code === 'email-taken'
      ? e.emailTaken
      : code === 'weak-password'
        ? e.weakPassword
        : code === 'invalid-email'
          ? e.invalidEmail
          : code === 'rate-limited'
            ? e.rateLimited
            : code === 'not-configured'
              ? e.notConfigured
              : e.unknown
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!role) return
    setError(null)

    if (!hasSupabase) {
      setAccount({ role, fields: values, createdAt: new Date().toISOString() })
      setDone(true)
      return
    }

    start(async () => {
      const result = await signUp({
        email: (values.email ?? '').trim(),
        password: values.password ?? '',
        role,
        fullName: (values.name ?? '').trim(),
        locale: document.documentElement.lang === 'en' ? 'en' : 'uz',
        grade: values.grade,
        subject: values.subject,
        experience: values.experience,
        schoolName: values.school,
      })

      if (!result.ok) {
        setError(errorFor(result.error))
        return
      }

      // Keep the local copy too: it is what the Phase 1 greeting on /learn and
      // the community author placeholder read, and it costs nothing.
      setAccount({ role, fields: values, createdAt: new Date().toISOString() })
      setConfirmEmail(Boolean(result.needsConfirmation))
      setDone(true)
      router.refresh()
    })
  }

  const optionsFor = (which: NonNullable<(typeof ROLE_FIELDS)[Role][number]['options']>) => {
    if (which === 'grades') return Array.from({ length: 11 }, (_, i) => String(i + 1))
    if (which === 'subjects') return t.register.subjects
    return t.register.experienceOptions
  }

  return (
    // `.ard-page-dark` already carries the animated gradient; layering the
    // cream GradientBackground over it washed the navy out to grey.
    <section className="ard-page-dark relative isolate overflow-hidden">
      <Container className="relative z-10 grid items-center gap-14 py-16 lg:grid-cols-[0.85fr_1.15fr] lg:py-24">
        {/* Ardu instead of a stock photo — the brand asset is the illustration. */}
        <div className="relative mx-auto hidden w-full max-w-[320px] lg:block">
          <div className="ard-perf-dense rounded-[18px] border-2 border-bg/70 bg-navy-2/60 p-6 shadow-[10px_10px_0_var(--color-teal)]">
            <Ardu width={280} className="h-auto w-full" />
          </div>
          <span className="absolute -top-4 right-2 rotate-3 rounded-[10px] border-2 border-navy bg-orange px-4 py-2 text-[12.5px] font-extrabold text-white shadow-hard-sm">
            {t.register.sticker}
          </span>
        </div>

        <div>
          <span className="ard-kicker">{t.nav.start}</span>
          <h1 className="mt-4 font-display text-[clamp(1.9rem,5vw,2.9rem)] text-bg">
            {t.register.title}
          </h1>
          <p className="mt-4 max-w-[52ch] text-[16.5px] leading-relaxed text-bg/72">
            {t.register.sub}
          </p>

          {/* stepper */}
          <div className="mt-8 flex flex-wrap gap-2.5">
            {[t.register.steps.role, t.register.steps.details, t.register.steps.done].map((label, i) => (
              <span
                key={label}
                className={cn(
                  'inline-flex items-center gap-2.5 rounded-[9px] border-2 px-3.5 py-2 text-[13px] font-extrabold transition-colors',
                  step === i + 1 && 'border-orange text-bg',
                  step > i + 1 && 'border-teal text-bg',
                  step < i + 1 && 'border-bg/30 text-bg/55',
                )}
              >
                <span
                  className={cn(
                    'grid size-5 place-items-center rounded-full text-[11px]',
                    step === i + 1 && 'bg-orange text-white',
                    step > i + 1 && 'bg-teal text-white',
                    step < i + 1 && 'bg-bg/20',
                  )}
                >
                  {step > i + 1 ? <Check size={11} strokeWidth={4} /> : i + 1}
                </span>
                {label}
              </span>
            ))}
          </div>

          {step === 1 && (
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {ROLES.map((r) => {
                const Icon = ROLE_ICON[r]
                const copy = t.register.roles[r]
                return (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={false}
                    onClick={() => setRole(r)}
                    className="ard-role flex items-center gap-4 rounded-[12px] border-2 border-navy bg-card p-5 text-left shadow-hard transition-[transform,box-shadow] duration-100 hover:-translate-x-px hover:-translate-y-px hover:shadow-hard-lg active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
                  >
                    <span
                      className={cn(
                        'grid size-[50px] shrink-0 place-items-center rounded-[12px] border-2 border-navy text-white shadow-hard-sm',
                        ROLE_TONE[r],
                      )}
                    >
                      <Icon size={22} strokeWidth={2.2} />
                    </span>
                    <span>
                      <span className="block font-display text-[16px] font-extrabold leading-tight text-navy">
                        {copy.title}
                      </span>
                      <span className="mt-1 block text-[13.5px] leading-snug text-navy/65">
                        {copy.body}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {step === 2 && role && (
            <>
              <button
                type="button"
                onClick={() => setRole(null)}
                className="mt-7 inline-flex items-center gap-1.5 rounded-md text-[13.5px] font-bold text-bg/70 transition-colors hover:text-orange"
              >
                <ArrowLeft size={15} />
                {t.register.changeRole}
              </button>

              <form
                onSubmit={submit}
                className="mt-4 rounded-[14px] border-2 border-bg/25 bg-navy/45 p-6 backdrop-blur-sm sm:p-7"
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  {ROLE_FIELDS[role].map((f) => {
                    const id = `reg-${f.key}`
                    const label = t.register.fields[f.key as keyof typeof t.register.fields]
                    return (
                      <Field key={f.key} label={label + (f.required ? ' *' : '')} htmlFor={id} tone="dark">
                        {f.type === 'select' && f.options ? (
                          <Select
                            id={id}
                            name={f.key}
                            value={values[f.key] ?? (f.options === 'grades' ? '5' : '')}
                            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                          >
                            {optionsFor(f.options).map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <Input
                            id={id}
                            name={f.key}
                            type={f.type}
                            required={f.required}
                            placeholder={
                              t.register.placeholders[f.key as keyof typeof t.register.placeholders] ?? ''
                            }
                            value={values[f.key] ?? ''}
                            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                          />
                        )}
                      </Field>
                    )
                  })}

                  {/* Only when there is somewhere to create the account. On a
                      clone with no backend these two fields would be a lie. */}
                  {hasSupabase && (
                    <>
                      <Field label={`${t.auth.email} *`} htmlFor="reg-email" tone="dark">
                        <Input
                          id="reg-email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          required
                          value={values.email ?? ''}
                          onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
                        />
                      </Field>
                      <Field label={`${t.auth.password} *`} htmlFor="reg-password" tone="dark">
                        <Input
                          id="reg-password"
                          name="password"
                          type="password"
                          autoComplete="new-password"
                          required
                          minLength={6}
                          placeholder={t.auth.passwordHint}
                          value={values.password ?? ''}
                          onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
                        />
                      </Field>
                    </>
                  )}
                </div>

                {error && (
                  <p
                    role="alert"
                    className="mt-5 rounded-[9px] border-2 border-orange bg-orange/15 px-3.5 py-2.5 text-[13.5px] font-semibold text-bg"
                  >
                    {error}
                  </p>
                )}

                <Button type="submit" size="lg" className="mt-6 w-full" disabled={pending}>
                  {pending ? t.common.saving : t.register.submit}
                  <ArrowRight size={18} strokeWidth={2.5} />
                </Button>
                {hasSupabase ? (
                  <p className="mt-4 text-center text-[12.5px] leading-relaxed text-bg/55">
                    {t.auth.haveAccount}{' '}
                    <Link href="/login" className="font-bold text-orange hover:underline">
                      {t.auth.toLogin}
                    </Link>
                  </p>
                ) : (
                  <p className="mt-4 text-center text-[12.5px] leading-relaxed text-bg/55">
                    {t.register.demoNote}
                  </p>
                )}
              </form>
            </>
          )}

          {step === 3 && role && (
            <Card className="mt-8 flex flex-col items-start gap-4 p-7">
              <span className="grid size-[50px] place-items-center rounded-[12px] border-2 border-navy bg-teal text-white shadow-hard-sm">
                {confirmEmail ? <Mail size={24} strokeWidth={2.6} /> : <Check size={24} strokeWidth={3} />}
              </span>
              <h2 className="font-display text-[24px] font-extrabold text-navy">
                {confirmEmail ? t.auth.confirmTitle : t.register.successTitle}
              </h2>
              <p className="font-display text-[16px] font-extrabold text-orange">
                {t.register.roles[role].title}
                {values.name ? ` · ${values.name}` : ''}
              </p>
              <p className="text-[15px] text-navy/70">
                {confirmEmail ? t.auth.confirmBody : t.register.successBody}
              </p>
              <div className="mt-1 flex flex-wrap gap-3">
                {confirmEmail ? (
                  <Button onClick={() => router.push('/login')}>{t.auth.toLogin}</Button>
                ) : (
                  <Button onClick={() => router.push(ROLE_HOME[role])}>{t.register.successGo}</Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    setDone(false)
                    setConfirmEmail(false)
                    setRole(null)
                  }}
                >
                  {t.register.changeRole}
                </Button>
              </div>
            </Card>
          )}
        </div>
      </Container>
    </section>
  )
}
