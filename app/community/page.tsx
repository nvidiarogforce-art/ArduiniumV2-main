'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Info, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Container } from '@/components/site/section'
import { PostCard } from '@/components/site/post-card'
import { TAG_ORDER, type PostTag } from '@/lib/content/community'
import { usePosts } from '@/lib/db/use-posts'
import { useI18n } from '@/lib/i18n'
import { useLocalState } from '@/lib/useLocalState'
import { ACCOUNT_KEY, type Account } from '@/lib/account'
import { cn } from '@/lib/utils'

/**
 * Community feed (spec §7.6, now on real data).
 *
 * Posts are readable signed-out — the feed is part of what convinces a teacher
 * this is worth their class's time — and writing one needs an account. With no
 * backend configured it falls back to exactly the Phase 1 arrangement:
 * localStorage over the seed posts, and the note at the bottom says so.
 */
export default function CommunityPage() {
  const { t } = useI18n()
  const { posts, loading, error, publish, canPost, synced, reload } = usePosts()
  const [account] = useLocalState<Account | null>(ACCOUNT_KEY, null)
  const [filter, setFilter] = useState<PostTag | 'all'>('all')
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const [draft, setDraft] = useState({
    title: '',
    body: '',
    author: '',
    tag: 'question' as PostTag,
  })

  const shown = filter === 'all' ? posts : posts.filter((p) => p.tag === filter)

  const onPublish = async (e: React.FormEvent) => {
    e.preventDefault()
    setProblem(null)
    setSending(true)
    const result = await publish({ ...draft, author: draft.author || account?.fields.name || '' })
    setSending(false)

    if (result === 'ok') {
      setDraft({ title: '', body: '', author: '', tag: 'question' })
      setOpen(false)
      return
    }
    setProblem(result === 'sign-in-required' ? 'signin' : 'failed')
  }

  return (
    <section className="ard-perf bg-bg py-14 sm:py-20">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="font-display text-[clamp(1.9rem,4.5vw,2.7rem)] text-navy">
              {t.community.title}
            </h1>
            <p className="mt-3 max-w-[56ch] text-[16px] leading-relaxed text-navy/70">
              {t.community.sub}
            </p>
          </div>
          <Button onClick={() => setOpen((v) => !v)} variant={open ? 'outline' : 'primary'}>
            {open ? <X size={17} strokeWidth={2.5} /> : <Plus size={17} strokeWidth={2.5} />}
            {open ? t.community.cancel : t.community.newPost}
          </Button>
        </div>

        {open && (
          <Card className="mt-8 p-7">
            {!canPost && (
              <p className="mb-5 rounded-[9px] border-2 border-orange/45 bg-orange/10 px-4 py-3 text-[13.5px] text-navy">
                {t.community.signInToPost}{' '}
                <Link href="/login?next=/community" className="font-bold text-orange hover:underline">
                  {t.auth.signIn}
                </Link>
              </p>
            )}

            <form onSubmit={onPublish} className="grid gap-5 sm:grid-cols-2">
              <Field label={t.community.formTitle} htmlFor="p-title">
                <Input
                  id="p-title"
                  required
                  value={draft.title}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                />
              </Field>
              <Field label={t.community.formAuthor} htmlFor="p-author">
                <Input
                  id="p-author"
                  value={draft.author}
                  placeholder={account?.fields.name ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, author: e.target.value }))}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label={t.community.formBody} htmlFor="p-body">
                  <Textarea
                    id="p-body"
                    required
                    value={draft.body}
                    onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                  />
                </Field>
              </div>
              <Field label={t.community.formTag} htmlFor="p-tag">
                <Select
                  id="p-tag"
                  value={draft.tag}
                  onChange={(e) => setDraft((d) => ({ ...d, tag: e.target.value as PostTag }))}
                >
                  {TAG_ORDER.map((tag) => (
                    <option key={tag} value={tag}>
                      {t.community.tags[tag]}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="flex items-end">
                <Button type="submit" className="w-full" disabled={sending || !canPost}>
                  {sending ? t.common.saving : t.community.publish}
                </Button>
              </div>

              {problem && (
                <p
                  role="alert"
                  className="sm:col-span-2 rounded-[9px] border-2 border-orange bg-orange/10 px-3.5 py-2.5 text-[13.5px] font-semibold text-navy"
                >
                  {problem === 'signin' ? t.community.signInToPost : t.community.failed}
                </p>
              )}
            </form>
          </Card>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-2">
          {(['all', ...TAG_ORDER] as const).map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setFilter(tag)}
              className={cn(
                'rounded-[9px] border-2 px-3.5 py-1.5 text-[13px] font-bold transition-colors',
                filter === tag
                  ? 'border-navy bg-navy text-bg shadow-hard-sm'
                  : 'border-navy/25 bg-card text-navy/70 hover:border-navy',
              )}
            >
              {tag === 'all' ? t.common.all : t.community.tags[tag]}
            </button>
          ))}
        </div>

        {/* Loading and error are first-class states here, not the happy path
            plus a shrug — spec §5.4. The skeleton matches the real card grid so
            the layout does not jump when the rows arrive. */}
        {loading ? (
          <div className="mt-8 grid gap-6 md:grid-cols-2" aria-busy>
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} tone="alt" className="h-[184px] animate-pulse p-7" />
            ))}
          </div>
        ) : error ? (
          <Card tone="alt" className="mt-8 p-10 text-center">
            <AlertTriangle size={22} className="mx-auto text-orange" />
            <p className="mt-3 text-[15px] text-navy/70">{t.common.offline}</p>
            <Button variant="outline" size="sm" className="mt-5" onClick={() => void reload()}>
              {t.common.retry}
            </Button>
          </Card>
        ) : shown.length === 0 ? (
          <Card tone="alt" className="mt-8 p-10 text-center">
            <p className="text-[15px] text-navy/60">{t.community.empty}</p>
          </Card>
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {shown.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        )}

        {!synced && (
          <p className="mt-10 inline-flex items-center gap-2 text-[13px] text-navy/50">
            <Info size={15} />
            {t.community.localNote}
          </p>
        )}
      </Container>
    </section>
  )
}
