import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/auth/login-form'
import { NotConfigured } from '@/components/site/not-configured'
import { getViewer, hasSupabase } from '@/lib/auth/session'
import { ROLE_HOME } from '@/lib/account'

export const metadata: Metadata = { title: 'Kirish' }

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  if (!hasSupabase) return <NotConfigured />

  const { next } = await searchParams

  // Already signed in: send them where they were going, or to their own home.
  const viewer = await getViewer()
  if (viewer) {
    const home =
      viewer.profile.role === 'school_admin'
        ? '/admin'
        : (ROLE_HOME[viewer.profile.role === 'teacher' ? 'teacher' : 'student'] ?? '/learn')
    redirect(next && next.startsWith('/') ? next : home)
  }

  // Only same-origin paths — a `?next=https://…` would make this an open
  // redirect, which is exactly the shape phishing wants from a login page.
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/learn'

  return <LoginForm next={target} />
}
