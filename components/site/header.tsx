'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { LangToggle } from '@/components/site/lang-toggle'
import { UserMenu } from '@/components/site/user-menu'
import { Container } from '@/components/site/section'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export function SiteHeader() {
  const { t } = useI18n()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const links = [
    { href: '/learn/simulator', label: t.nav.sandbox },
    { href: '/learn/lessons', label: t.nav.lessons },
    { href: '/learn/videos', label: t.nav.videos },
    { href: '/community', label: t.nav.community },
    { href: '/teach', label: t.nav.teach },
    { href: '/pricing', label: t.nav.pricing },
  ]

  // Close the mobile sheet on navigation — leaving it open over the new page
  // is the classic broken-feeling mobile nav.
  useEffect(() => setOpen(false), [pathname])

  return (
    <header className="sticky top-0 z-50 w-full border-b-2 border-navy bg-bg/85 backdrop-blur-md">
      <Container className="flex h-[62px] items-center justify-between gap-4">
        <Link href="/" className="rounded-md" aria-label="Arduinium">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + '/')
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  'rounded-md px-3 py-2 text-[14px] font-bold transition-colors',
                  active ? 'text-orange' : 'text-navy/75 hover:text-navy',
                )}
              >
                {l.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-2.5">
          <LangToggle />
          <UserMenu />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={t.nav.menu}
            className="grid size-10 place-items-center rounded-[9px] border-2 border-navy bg-card shadow-hard-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none lg:hidden"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </Container>

      {open && (
        <div className="border-t-2 border-navy bg-card lg:hidden">
          <Container className="flex flex-col py-3">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="border-b border-navy/10 py-3 text-[15px] font-bold text-navy last:border-0"
              >
                {l.label}
              </Link>
            ))}
            <Button asChild className="mt-3 sm:hidden">
              <Link href="/register">{t.nav.start}</Link>
            </Button>
          </Container>
        </div>
      )}
    </header>
  )
}
