import { Suspense } from 'react'
import type { Metadata } from 'next'
import { SandboxChrome } from '@/components/sandbox/sandbox-chrome'
import { SandboxMount } from '@/components/sandbox/sandbox-mount'

export const metadata: Metadata = {
  title: 'Sinov maydoni',
  description:
    'Robotni yig‘ing, simlarni ulang, dastur yozing va uni haqiqiy fizikada haydang — brauzerda.',
}

/**
 * The sandbox route.
 *
 * A fixed-height flex column rather than a scrolling document. The site
 * header is suppressed here (SiteChrome explains why), so the lesson bar is
 * the only chrome above the stage and the stage takes everything else.
 * `100dvh` rather than `100vh`, so collapsing mobile browser chrome does not
 * crop the canvas.
 */
export default function SimulatorPage() {
  return (
    <div className="flex h-dvh flex-col">
      {/* useSearchParams needs a Suspense boundary; the fallback holds the
          bar's exact height so the stage below does not jump on hydration. */}
      <Suspense fallback={<div className="h-[54px] shrink-0 border-b-2 border-navy bg-bg-alt" />}>
        <SandboxChrome />
      </Suspense>
      <SandboxMount />
    </div>
  )
}
