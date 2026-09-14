'use client'

import Link from 'next/link'
import { Building2, Check, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/site/section'
import { Gear, Rise, Words } from '@/components/site/reveal'
import { Tilt } from '@/components/site/tilt'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/**
 * Two tiers, reused verbatim on `/` and `/pricing`.
 *
 * Structure follows the 21st.dev product-packs pattern — a light card beside a
 * dark one, each with a hard-shadow action — recoloured to our palette. The
 * school tier deliberately carries no number: school pricing here is
 * negotiated per institution, and printing a fixed figure would be a
 * fabrication that has to be walked back in the first sales conversation.
 */
export function PricingSection({ withHeading = true }: { withHeading?: boolean }) {
  const { t } = useI18n()

  const tiers = [
    { key: 'free' as const, icon: User, data: t.pricing.free, href: '/register?role=student', dark: false },
    { key: 'school' as const, icon: Building2, data: t.pricing.school, href: '/register?role=teacher', dark: true },
  ]

  return (
    <section id="pricing" className="py-24 sm:py-28">
      <Container>
        {withHeading && (
          <div className="text-center">
            <Rise>
              <span className="ard-kicker">{t.pricing.eyebrow}</span>
            </Rise>
            <Words
              text={t.pricing.title}
              className="mx-auto mt-4 max-w-[20ch] font-display text-[clamp(1.75rem,4.2vw,2.75rem)] font-extrabold leading-[1.08] tracking-[-0.02em] text-navy"
            />
            <Rise delay={90}>
              <p className="mx-auto mt-4 max-w-[52ch] text-[17px] leading-relaxed text-navy/72">
                {t.pricing.sub}
              </p>
            </Rise>
          </div>
        )}

        <div className="mx-auto mt-14 grid max-w-[900px] gap-7 md:grid-cols-2">
          {tiers.map((tier, i) => {
            const Icon = tier.icon
            return (
              // Two tiers, so they counter-rotate into each other.
              <Gear key={tier.key} dir={i === 0 ? -1 : 1} spin={i === 0 ? -1 : 1} delay={i * 130}>
                <Tilt dark={tier.dark} className="h-full rounded-[14px]" max={5}>
                  <div
                    className={cn(
                      'relative flex h-full flex-col gap-5 rounded-[14px] border-2 border-navy p-9',
                      tier.dark
                        ? 'bg-navy text-bg shadow-[6px_6px_0_var(--color-orange)]'
                        : 'bg-card text-navy shadow-hard',
                    )}
                  >
                    {tier.dark && (
                      <span className="absolute -top-3.5 right-7 rounded-[7px] border-2 border-navy bg-orange px-2.5 py-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] text-white">
                        {t.pricing.popular}
                      </span>
                    )}

                    <div>
                      <h3 className="flex items-center gap-2.5 font-display text-[22px] font-extrabold">
                        <Icon size={22} strokeWidth={2.2} className={tier.dark ? 'text-orange' : 'text-teal'} />
                        {tier.data.name}
                      </h3>
                      <p className={cn('mt-1.5 text-[14.5px]', tier.dark ? 'text-bg/65' : 'text-navy/65')}>
                        {tier.data.note}
                      </p>
                    </div>

                    <div className="font-display text-[clamp(2rem,4.4vw,2.75rem)] font-extrabold leading-none">
                      {tier.data.price}
                    </div>

                    <ul
                      className={cn(
                        'flex flex-1 flex-col gap-3 border-t-2 pt-6',
                        tier.dark ? 'border-bg/18' : 'border-navy/14',
                      )}
                    >
                      {tier.data.features.map((f, fi) => (
                        <li key={fi} className="flex items-start gap-2.5 text-[15px] font-semibold">
                          <span className="mt-0.5 grid size-[20px] shrink-0 place-items-center rounded-full bg-teal text-white">
                            <Check size={12} strokeWidth={3.5} />
                          </span>
                          <span className={tier.dark ? 'text-bg/88' : 'text-navy/82'}>{f}</span>
                        </li>
                      ))}
                    </ul>

                    <Button asChild variant={tier.dark ? 'onDark' : 'outline'} size="lg" className="w-full">
                      <Link href={tier.href}>{tier.data.cta}</Link>
                    </Button>
                  </div>
                </Tilt>
              </Gear>
            )
          })}
        </div>
      </Container>
    </section>
  )
}
