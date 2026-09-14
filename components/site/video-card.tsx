'use client'

import Link from 'next/link'
import { Play, Clock } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { useI18n } from '@/lib/i18n'
import type { VideoLesson } from '@/lib/content/videos'
import { cn } from '@/lib/utils'

/**
 * Thumbnails are drawn, not photographed.
 *
 * Spec §9 rules out generic stock imagery, and there is no real footage yet
 * (§11 leaves hosting open). A stock "kid at a laptop" would have been both
 * a cliché and a lie about what the video contains. Instead each card gets a
 * perfboard tile in the track's colour with a large index numeral — cheap,
 * on-brand, and honest about being a placeholder.
 */
export function VideoCard({ video, index }: { video: VideoLesson; index: number }) {
  const { t, locale } = useI18n()
  const teacher = video.track === 'teacher'

  return (
    <Card interactive className="group flex h-full flex-col overflow-hidden p-0">
      <Link href={`/learn/videos/${video.slug}`} className="flex h-full flex-col">
        <div
          className={cn(
            'ard-perf-dense relative flex h-[152px] items-center justify-center border-b-2 border-navy',
            teacher ? 'bg-navy' : 'bg-teal',
          )}
        >
          <span
            aria-hidden
            className={cn(
              'font-display text-[76px] font-bold leading-none',
              teacher ? 'text-bg/15' : 'text-navy/20',
            )}
          >
            {String(index + 1).padStart(2, '0')}
          </span>

          <span className="absolute grid size-[52px] place-items-center rounded-full border-2 border-navy bg-bg shadow-hard transition-transform duration-100 group-hover:scale-105">
            <Play size={20} className="ml-0.5 fill-navy text-navy" />
          </span>

          <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 rounded-[6px] border-2 border-navy bg-bg px-1.5 py-0.5 font-mono text-[11px] font-bold text-navy">
            <Clock size={11} />
            {video.minutes} {t.common.minutes}
          </span>
        </div>

        <div className="flex flex-1 flex-col p-5">
          <span
            className={cn(
              'font-mono text-[10.5px] font-bold uppercase tracking-[0.14em]',
              teacher ? 'text-pink' : 'text-teal',
            )}
          >
            {teacher ? t.videos.trackTeacher : t.videos.trackStudent}
          </span>
          <h3 className="mt-1.5 font-display text-[17px] font-bold text-navy">
            {video.title[locale]}
          </h3>
          <p className="mt-2 text-[14px] leading-relaxed text-navy/65">{video.summary[locale]}</p>
        </div>
      </Link>
    </Card>
  )
}
