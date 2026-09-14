'use client'

import { usePathname } from 'next/navigation'
import { SiteHeader } from '@/components/site/header'
import { SiteFooter } from '@/components/site/footer'

/**
 * Chooses the page furniture for a route.
 *
 * The sandbox is the one route that is an application rather than a document.
 * It gets neither the site header nor the footer:
 *
 *  - the footer would sit in a region below a viewport that cannot scroll, so
 *    nobody could ever reach it;
 *  - the header would be the *third* stacked bar above the 3D stage, after
 *    the lesson chrome and the workshop's own toolbar. Three brand bars is
 *    how an integration announces that it was bolted together. The lesson
 *    chrome absorbs the header's job instead (logo, language, navigation),
 *    which keeps the tool to two bars and gives the stage back ~60px.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isApp = pathname === '/learn/simulator'

  return (
    <>
      {!isApp && <SiteHeader />}
      {/**
       * `overflow-x: clip` contains the gear entrance: cards swing in from
       * ±110px, and a transform still contributes to the scrollable overflow
       * area, so without this the page gains a horizontal scrollbar for the
       * duration of every reveal. `clip` rather than `hidden` because hidden
       * would make this a scroll container and break `position: sticky`
       * inside it; clip leaves the vertical axis alone.
       */}
      <main id="main" className="overflow-x-clip">
        {children}
      </main>
      {!isApp && <SiteFooter />}
    </>
  )
}
