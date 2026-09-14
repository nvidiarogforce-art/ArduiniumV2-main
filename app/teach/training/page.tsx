'use client'

import { StubPage } from '@/components/site/stub-page'
import { useI18n } from '@/lib/i18n'

/**
 * [stub] — the certification catalogue itself is a later phase, but the
 * teacher video track it will wrap is real and live, so this page routes
 * there rather than dead-ending.
 */
export default function TrainingPage() {
  const { t } = useI18n()
  return (
    <StubPage
      title={t.teach.trainingTitle}
      sub={t.teach.trainingSub}
      action={{ href: '/learn/videos?track=teacher', label: t.teach.goVideos }}
    />
  )
}
