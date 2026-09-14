import { Suspense } from 'react'
import type { Metadata } from 'next'
import { VideoCatalogue } from '@/components/learn/video-catalogue'

export const metadata: Metadata = { title: 'Video darslar' }

export default function VideosPage() {
  return (
    <Suspense fallback={<div className="min-h-[70vh]" />}>
      <VideoCatalogue />
    </Suspense>
  )
}
