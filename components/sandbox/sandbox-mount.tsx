'use client'

import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import { useI18n } from '@/lib/i18n'
// The workshop's own i18n store. Importing the store (not a component) is
// safe outside the dynamic boundary: it is a plain zustand store with no
// window access at module scope.
import { useI18n as useWorkshopI18n } from '@sandbox/i18n/index.js'

// The sandbox's own stylesheet. It is scoped — see the SCOPING note at the top
// of src/styles.css — so loading it here cannot affect the rest of the site
// even after the reader navigates away and the chunk stays in the document.
import '@sandbox/styles.css'

/**
 * The 3D workshop, mounted inside the Next.js site.
 *
 * `ssr: false` is mandatory rather than an optimisation: the sandbox reads
 * `window` during mount (keyboard handlers, the `__ARDUINIUM_*__` debug hooks)
 * and R3F needs a real canvas. There is nothing meaningful to prerender.
 *
 * NOTE FOR MAINTAINERS — nothing in `src/` was rewritten to make this work.
 * The simulation layer (store, geometry, parts, terminals, program, physics)
 * is byte-for-byte what the standalone Vite app runs, which is why the nine
 * harnesses in `tools/` remain a valid regression gate for this page.
 */
const Workshop = dynamic(() => import('@sandbox/App.jsx'), {
  ssr: false,
  loading: () => <SandboxLoading />,
})

function SandboxLoading() {
  return (
    <div className="absolute inset-0 grid place-items-center bg-bg">
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="size-2.5 rounded-full bg-teal"
              style={{ animation: `ard-led 1.1s ease-in-out ${i * 140}ms infinite` }}
            />
          ))}
        </div>
        <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-navy/60">
          Loading…
        </p>
      </div>
    </div>
  )
}

export function SandboxMount() {
  const { t, locale } = useI18n()

  /**
   * Keep the workshop's language in step with the site's.
   *
   * The sandbox ships its own three-language dictionary (uz/ru/en) and
   * defaults to English, so without this a reader browsing the site in Uzbek
   * opened the tool and found it in another language — the single most
   * obvious "these are two different products" tell. Both of the site's
   * locales exist in the workshop's set, so the mapping is direct.
   *
   * This drives a public action on the workshop's store rather than editing
   * anything inside `src/`.
   */
  useEffect(() => {
    useWorkshopI18n.getState().setLocale(locale)
  }, [locale])

  /**
   * Switch on the sandbox's full-screen layout rules for exactly as long as
   * this component is mounted, and switch them off again on the way out.
   *
   * Without the cleanup, navigating from the sandbox to any other route would
   * leave `overflow: hidden` on <html> and the whole site would silently stop
   * scrolling — the exact failure this scoping exists to prevent.
   */
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('ard-sandbox-page')
    return () => root.classList.remove('ard-sandbox-page')
  }, [])

  return (
    <div className="ard-sandbox-root">
      <Workshop />
      <span className="sr-only">{t.simulator.title}</span>
    </div>
  )
}
