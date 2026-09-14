'use client'

import { StubPage } from '@/components/site/stub-page'
import { useI18n } from '@/lib/i18n'

/**
 * What `/teach` shows to someone who is not a signed-in teacher.
 *
 * This is the Phase 1 page, unchanged and still honest: the dashboard exists
 * now, but it belongs to a teacher's own classes, so a visitor who is not one
 * gets the same "here is what is here for you" landing rather than an empty
 * table with nobody's name in it.
 */
export function TeachStub() {
  const { t } = useI18n()
  return (
    <StubPage
      title={t.teach.title}
      sub={t.teach.sub}
      action={{ href: '/learn/videos?track=teacher', label: t.teach.goVideos }}
    />
  )
}
