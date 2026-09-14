'use client'

import Link from 'next/link'
import { ServerCog } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Container } from '@/components/site/section'
import { useI18n } from '@/lib/i18n'

/**
 * What a backend-dependent route renders when there is no backend.
 *
 * A fresh clone has no `.env.local`, and the honest answer for `/ai` and
 * `/admin` there is "this needs a server that is not set up", not a redirect to
 * a sign-in page that could never succeed. It names the file to fill in, so the
 * person who hit this can act on it.
 */
export function NotConfigured() {
  const { t } = useI18n()

  return (
    <section className="ard-perf bg-bg py-20">
      <Container>
        <Card tone="alt" className="mx-auto max-w-[54ch] p-8 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-[12px] border-2 border-navy bg-orange/15">
            <ServerCog size={22} className="text-orange" />
          </span>
          <h1 className="mt-5 font-display text-[22px] font-bold text-navy">
            {t.common.notConfiguredTitle}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-navy/70">
            {t.common.notConfiguredBody}
          </p>
          <p className="mt-4 font-mono text-[12.5px] text-navy/55">
            .env.local &larr; .env.example
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link href="/learn">{t.learn.title}</Link>
          </Button>
        </Card>
      </Container>
    </section>
  )
}
