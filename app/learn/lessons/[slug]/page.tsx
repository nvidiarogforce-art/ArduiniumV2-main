import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { LESSONS, getLesson } from '@/lib/content/lessons'
import { LessonView } from '@/components/learn/lesson-view'

/** Static params for the whole catalogue — these are files, not a database. */
export function generateStaticParams() {
  return LESSONS.filter((l) => l.available).map((l) => ({ slug: l.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const lesson = getLesson(slug)
  // Uzbek is the default locale, so it is what the static metadata uses.
  return lesson ? { title: lesson.title.uz, description: lesson.summary.uz } : {}
}

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const lesson = getLesson(slug)
  if (!lesson || !lesson.available) notFound()

  return <LessonView slug={slug} />
}
