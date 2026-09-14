'use client'

import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { Card, SolderPad } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/site/section'
import { ArduAvatar } from '@/components/ai/ardu-avatar'
import { ArduChat, type Bubble } from '@/components/ai/chat'
import { useI18n } from '@/lib/i18n'

/**
 * `/ai` — the standalone assistant (spec §3.1).
 *
 * Same component as the sandbox slide-over renders, in the site's own furniture
 * rather than a separate implementation, so a fix to the chat is a fix in both
 * places. Height is pinned to the viewport minus the header so the composer
 * stays put and only the transcript scrolls — a chat whose input box walks down
 * the page as the conversation grows is the classic tell of a chat built out of
 * a blog layout.
 */
export function AiPage({
  seed,
  configured,
}: {
  seed: { conversationId: string | null; messages: Bubble[] }
  configured: boolean
}) {
  const { t } = useI18n()

  return (
    <section className="ard-perf bg-bg py-10 sm:py-14">
      <Container>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <ArduAvatar size={54} className="mt-1 shadow-hard-sm" />
            <div>
              <p className="ard-kicker">
                <Sparkles size={13} />
                {t.nav.ai}
              </p>
              <h1 className="mt-2 font-display text-[clamp(1.7rem,4vw,2.4rem)] text-navy">
                {t.ai.title}
              </h1>
              <p className="mt-2 max-w-[58ch] text-[15.5px] leading-relaxed text-navy/70">
                {t.ai.sub}
              </p>
            </div>
          </div>

          <Button asChild variant="outline" size="sm">
            <Link href="/learn/simulator">
              <SolderPad className="size-[13px] border-[1.5px]" lit={false} />
              {t.nav.sandbox}
            </Link>
          </Button>
        </div>

        <Card className="mt-8 flex h-[min(70vh,640px)] flex-col overflow-hidden p-0">
          <div className="flex min-h-0 flex-1 flex-col px-5 py-3 sm:px-7">
            {configured ? (
              <ArduChat seed={seed} source="standalone" />
            ) : (
              <div className="grid flex-1 place-items-center p-8 text-center">
                <div>
                  <ArduAvatar size={48} className="mx-auto" />
                  <p className="mt-4 font-display text-[17px] font-bold text-navy">
                    {t.ai.notConfiguredTitle}
                  </p>
                  <p className="mx-auto mt-2 max-w-[46ch] text-[14.5px] leading-relaxed text-navy/65">
                    {t.ai.notConfiguredBody}
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>
      </Container>
    </section>
  )
}
