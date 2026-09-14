import { Suspense } from 'react'
import type { Metadata } from 'next'
import { RegisterFlow } from '@/components/register/register-flow'

export const metadata: Metadata = { title: 'Ro‘yxatdan o‘tish' }

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-[70vh]" />}>
      <RegisterFlow />
    </Suspense>
  )
}
