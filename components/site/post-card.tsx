'use client'

import { Card } from '@/components/ui/card'
import { useI18n } from '@/lib/i18n'
import type { Post } from '@/lib/content/community'
import { cn } from '@/lib/utils'

const TAG_STYLE: Record<Post['tag'], string> = {
  question: 'bg-teal text-white',
  idea: 'bg-orange text-white',
  // Pink is the reserved achievement colour (§4.1: "rare highlight only"),
  // and a success story is precisely that. This and the account page's
  // progress badge are its only two uses in the product.
  success: 'bg-pink text-white',
}

export function PostCard({ post, compact = false }: { post: Post; compact?: boolean }) {
  const { t, locale } = useI18n()

  return (
    <Card className={cn('flex h-full flex-col gap-3', compact ? 'p-5' : 'p-6')}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'rounded-[6px] border-2 border-navy px-2 py-0.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.1em]',
            TAG_STYLE[post.tag],
          )}
        >
          {t.community.tags[post.tag]}
        </span>
        <span className="rounded-[6px] border-2 border-navy/25 px-2 py-0.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.1em] text-navy/55">
          {post.role === 'teacher' ? t.community.roleTeacher : t.community.roleStudent}
        </span>
      </div>

      <h3 className={cn('font-display font-bold text-navy', compact ? 'text-[16px]' : 'text-[18px]')}>
        {post.title[locale]}
      </h3>

      <p
        className={cn(
          'flex-1 text-[14.5px] leading-relaxed text-navy/70',
          compact && 'line-clamp-3',
        )}
      >
        {post.body[locale]}
      </p>

      <div className="flex items-center gap-2 border-t-2 border-navy/10 pt-3 text-[13px] text-navy/55">
        <span className="grid size-6 place-items-center rounded-full border-2 border-navy bg-bg-alt font-display text-[11px] font-bold text-navy">
          {post.author.charAt(0)}
        </span>
        <span className="font-semibold text-navy/75">{post.author}</span>
        <span aria-hidden>·</span>
        <span className="font-mono text-[12px]">
          {post.daysAgo}
          {locale === 'uz' ? ' kun oldin' : 'd ago'}
        </span>
      </div>
    </Card>
  )
}
