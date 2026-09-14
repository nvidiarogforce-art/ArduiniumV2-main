'use client'

import Link from 'next/link'
import { LogoMark } from '@/components/brand/logo'
import { Container } from '@/components/site/section'
import { useI18n } from '@/lib/i18n'

export function SiteFooter() {
  const { t } = useI18n()
  const year = 2026

  const columns = [
    {
      title: t.footer.product,
      links: [
        { href: '/learn/simulator', label: t.nav.sandbox },
        { href: '/pricing', label: t.nav.pricing },
        { href: '/community', label: t.nav.community },
      ],
    },
    {
      title: t.footer.learn,
      links: [
        { href: '/learn/lessons', label: t.nav.lessons },
        { href: '/learn/videos', label: t.nav.videos },
        { href: '/teach/training', label: t.teach.trainingTitle },
      ],
    },
    {
      title: t.footer.company,
      links: [
        { href: '/teach', label: t.nav.teach },
        { href: '/account', label: t.footer.account },
        { href: '/register', label: t.nav.start },
      ],
    },
  ]

  return (
    <footer className="ard-perf border-t-2 border-navy bg-bg-alt">
      <Container className="py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2.5">
              <LogoMark size={30} />
              <span className="font-display text-[17px] font-bold uppercase tracking-[0.14em] text-navy">
                Arduinium
              </span>
            </span>
            <p className="mt-3 max-w-[34ch] text-[14px] leading-relaxed text-navy/70">
              {t.footer.tagline}
            </p>
          </div>

          {columns.map((col, ci) => (
            <div key={ci}>
              <h3 className="font-mono text-[11.5px] font-bold uppercase tracking-[0.16em] text-teal">
                {col.title}
              </h3>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link
                      href={l.href}
                      className="rounded text-[14px] font-medium text-navy/75 transition-colors hover:text-orange"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t-2 border-navy/15 pt-6 text-[13px] text-navy/60 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} Arduinium. {t.footer.rights}
          </p>
          <p className="font-mono text-[12px] uppercase tracking-[0.1em]">{t.footer.madeIn}</p>
        </div>
      </Container>
    </footer>
  )
}
