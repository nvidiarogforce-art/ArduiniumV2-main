import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { VIDEOS, getVideo } from '@/lib/content/videos'
import { VideoPlayerView } from '@/components/learn/video-player-view'

export function generateStaticParams() {
  return VIDEOS.map((v) => ({ slug: v.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const video = getVideo(slug)
  return video ? { title: video.title.uz, description: video.summary.uz } : {}
}

export default async function VideoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!getVideo(slug)) notFound()
  return <VideoPlayerView slug={slug} />
}
