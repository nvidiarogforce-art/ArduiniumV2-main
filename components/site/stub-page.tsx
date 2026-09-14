'use client'

import Link from 'next/link'
import { Construction } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Container } from '@/components/site/section'
import { useI18n } from '@/lib/i18n'

/**
 * The shared "[stub]" page (spec §5/§6): a route that exists and is reachable
 * from navigation, so clicking around does not hit a 404, but that does not
 * pretend to have functionality it lacks.
 *
 * Every stub offers at least one real thing to do instead of dead-ending —
 * a "coming soon" page with no exit is how a demo loses its audience.
 */
export function StubPage({
  title,
  sub,
  bodyOverride,
  action,
}: {
  title: string
  sub?: string
  bodyOverride?: string
  action?: { href: string; label: string }
}) {
  const { t } = useI18n()

  return (
    <section className="ard-perf bg-bg py-20 sm:py-28">
      <Container>
        <div className="mx-auto max-w-[620px]">
          <h1 className="font-display text-[clamp(1.9rem,4.5vw,2.7rem)] text-navy">{title}</h1>
          {sub && <p className="mt-4 text-[16px] leading-relaxed text-navy/70">{sub}</p>}

          <Card tone="alt" className="mt-9 flex flex-col gap-4 p-8">
            <span className="grid size-11 place-items-center rounded-[10px] border-2 border-navy bg-card">
              <Construction size={20} strokeWidth={2.2} className="text-orange" />
            </span>
            <h2 className="font-display text-[19px] font-bold text-navy">{t.teach.stubTitle}</h2>
            <p className="text-[14.5px] leading-relaxed text-navy/70">
              {bodyOverride ?? t.teach.stubBody}
            </p>
            {action && (
              <div className="mt-1 flex flex-wrap gap-3">
                <Button asChild>
                  <Link href={action.href}>{action.label}</Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link href="/learn/simulator">{t.nav.sandbox}</Link>
                </Button>
              </div>
            )}
          </Card>
        </div>
      </Container>
    </section>
  )
}
