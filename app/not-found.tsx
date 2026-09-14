'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/site/section'
import { Ardu } from '@/components/brand/logo'
import { useI18n } from '@/lib/i18n'

export default function NotFound() {
  const { t, locale } = useI18n()

  return (
    <section className="ard-perf bg-bg py-20 sm:py-28">
      <Container className="flex flex-col items-center gap-8 text-center">
        <Ardu width={170} />
        <div>
          <p className="font-mono text-[13px] font-bold uppercase tracking-[0.18em] text-orange">
            404
          </p>
          <h1 className="mt-3 font-display text-[clamp(1.8rem,4.5vw,2.6rem)] text-navy">
            {locale === 'uz' ? 'Bunday sahifa topilmadi' : 'That page does not exist'}
          </h1>
          <p className="mx-auto mt-3 max-w-[44ch] text-[16px] leading-relaxed text-navy/70">
            {locale === 'uz'
              ? 'Havola eskirgan bo‘lishi mumkin. Ustaxonaga qaytib, ishni davom ettiring.'
              : 'The link may be out of date. Head back to the workshop and carry on.'}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/learn/simulator">{t.nav.sandbox}</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/">{locale === 'uz' ? 'Bosh sahifa' : 'Home'}</Link>
          </Button>
        </div>
      </Container>
    </section>
  )
}
