import { Hero } from '@/components/landing/hero'
import { Ticker } from '@/components/landing/ticker'
import {
  Achieve,
  CommunityTeaser,
  Features,
  FinalCta,
  HowItWorks,
  Problem,
  Quote,
  VideosTeaser,
} from '@/components/landing/sections'
import { PricingSection } from '@/components/site/pricing-section'

/**
 * Landing page.
 *
 * Section rhythm alternates surface on purpose — dark band, teal ticker, then
 * tinted / transparent / dark / transparent — so a long scroll reads as a
 * sequence of rooms rather than one endless column. Nav and footer come from
 * the root layout.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <Ticker />
      <Problem />
      <Features />
      <HowItWorks />
      <Achieve />
      <Quote />
      <VideosTeaser />
      <CommunityTeaser />
      <PricingSection />
      <FinalCta />
    </>
  )
}
