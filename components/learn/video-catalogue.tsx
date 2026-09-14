'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { GraduationCap, Info, User } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Container } from '@/components/site/section'
import { VideoCard } from '@/components/site/video-card'
import { VIDEOS, type VideoTrack } from '@/lib/content/videos'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/**
 * Video catalogue (spec §7.5).
 *
 * The teacher track lives at `?track=teacher` on this same route rather than
 * under /teach/training, because /teach is a stub in this phase and the
 * videos are real — burying live content inside a "coming soon" area would
 * hide the one thing teachers can actually use today. The two tracks are kept
 * visually distinct (navy + pink for teachers, teal for students) and the
 * filter is explicit, so a teacher never wades through kids' content.
 */
export function VideoCatalogue() {
  const { t } = useI18n()
  const router = useRouter()
  const params = useSearchParams()

  const track = (params.get('track') === 'teacher' ? 'teacher' : 'student') as VideoTrack
  const shown = VIDEOS.filter((v) => v.track === track)

  const tabs: Array<{ id: VideoTrack; label: string; icon: typeof User }> = [
    { id: 'student', label: t.videos.trackStudent, icon: User },
    { id: 'teacher', label: t.videos.trackTeacher, icon: GraduationCap },
  ]

  return (
    <section className="ard-perf bg-bg py-14 sm:py-20">
      <Container>
        <h1 className="font-display text-[clamp(1.9rem,4.5vw,2.7rem)] text-navy">{t.videos.title}</h1>
        <p className="mt-3 max-w-[56ch] text-[16px] leading-relaxed text-navy/70">{t.videos.sub}</p>

        <div
          className="mt-8 inline-flex rounded-[11px] border-2 border-navy bg-bg-alt p-[4px] shadow-hard-sm"
          role="tablist"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active = track === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() =>
                  router.replace(tab.id === 'teacher' ? '/learn/videos?track=teacher' : '/learn/videos')
                }
                className={cn(
                  'inline-flex items-center gap-2 rounded-[7px] px-4 py-2 text-[13.5px] font-bold transition-colors',
                  active ? 'bg-navy text-bg' : 'text-navy/60 hover:text-navy',
                )}
              >
                <Icon size={15} strokeWidth={2.3} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {track === 'teacher' && (
          <Card tone="alt" className="mt-6 flex max-w-[62ch] gap-3 p-5">
            <Info size={18} strokeWidth={2.2} className="mt-0.5 shrink-0 text-pink" />
            <p className="text-[14.5px] leading-relaxed text-navy/78">{t.videos.teacherNote}</p>
          </Card>
        )}

        <div className="mt-9 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((v, i) => (
            <VideoCard key={v.slug} video={v} index={i} />
          ))}
        </div>
      </Container>
    </section>
  )
}
