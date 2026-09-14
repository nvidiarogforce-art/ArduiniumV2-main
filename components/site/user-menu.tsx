'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronDown, LogOut, ShieldCheck, Sparkles, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import { useViewer } from '@/lib/auth/use-viewer'
import { signOut } from '@/lib/auth/actions'
import { hasSupabase } from '@/lib/supabase/config'
import { cn } from '@/lib/utils'

/**
 * The account control in the site header.
 *
 * Three states, and the order they are checked in matters:
 *
 *   1. No backend — render exactly what Phase 1 rendered, a Register button.
 *      Nothing about auth appears on a site that cannot authenticate anyone.
 *   2. Loading — render the same Register button rather than a spinner or a
 *      gap. The header must not visibly change shape a beat after paint, and
 *      it must never flash "Sign in" at somebody who is signed in.
 *   3. Signed in — a name chip with the role-appropriate destinations behind it.
 */
export function UserMenu() {
  const { t } = useI18n()
  const { viewer, loading } = useViewer()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const router = useRouter()
  const pathname = usePathname()
  const box = useRef<HTMLDivElement | null>(null)

  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!hasSupabase || (loading && !viewer)) {
    return (
      <Button asChild size="sm" className="hidden sm:inline-flex">
        <Link href="/register">{t.nav.start}</Link>
      </Button>
    )
  }

  if (!viewer) {
    return (
      <div className="hidden items-center gap-2 sm:flex">
        <Link
          href="/login"
          className="rounded-md px-2.5 py-2 text-[13.5px] font-bold text-navy/75 transition-colors hover:text-orange"
        >
          {t.nav.login}
        </Link>
        <Button asChild size="sm">
          <Link href="/register">{t.nav.start}</Link>
        </Button>
      </div>
    )
  }

  const role = viewer.profile.role
  const first = (viewer.profile.full_name || viewer.email || '?').trim().split(/\s+/)[0]

  const links = [
    { href: '/ai', label: t.nav.ai, icon: Sparkles },
    role === 'school_admin' ? { href: '/admin', label: t.nav.admin, icon: ShieldCheck } : null,
    role === 'teacher' ? { href: '/teach', label: t.nav.teach, icon: ShieldCheck } : null,
    { href: '/account', label: t.nav.account, icon: User },
  ].filter(Boolean) as { href: string; label: string; icon: typeof User }[]

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-2 rounded-[9px] border-2 border-navy bg-card px-2.5 py-1.5 text-[13px] font-bold text-navy shadow-hard-sm transition-[transform,box-shadow] duration-100 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
      >
        <span className="grid size-5 place-items-center rounded-full bg-teal text-[10px] font-extrabold text-white">
          {first.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden max-w-[10ch] truncate sm:inline">{first}</span>
        <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[220px] overflow-hidden rounded-[12px] border-2 border-navy bg-card shadow-hard"
        >
          <div className="border-b-2 border-navy/10 px-4 py-3">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-navy/50">
              {t.auth.signedInAs}
            </p>
            <p className="mt-0.5 truncate text-[13.5px] font-bold text-navy">
              {viewer.profile.full_name || viewer.email}
            </p>
            <p className="mt-0.5 truncate text-[12px] text-navy/55">
              {role === 'school_admin'
                ? t.nav.admin
                : role === 'teacher'
                  ? t.community.roleTeacher
                  : t.community.roleStudent}
            </p>
          </div>

          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              role="menuitem"
              className="flex items-center gap-2.5 px-4 py-2.5 text-[13.5px] font-semibold text-navy transition-colors hover:bg-bg-alt"
            >
              <Icon size={15} className="text-teal" />
              {label}
            </Link>
          ))}

          <button
            type="button"
            role="menuitem"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await signOut()
                setOpen(false)
                router.replace('/')
                router.refresh()
              })
            }
            className="flex w-full items-center gap-2.5 border-t-2 border-navy/10 px-4 py-2.5 text-left text-[13.5px] font-semibold text-navy transition-colors hover:bg-bg-alt disabled:opacity-50"
          >
            <LogOut size={15} className="text-orange" />
            {t.auth.signOut}
          </button>
        </div>
      )}
    </div>
  )
}
