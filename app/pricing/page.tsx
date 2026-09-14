import type { Metadata } from 'next'
import { PricingSection } from '@/components/site/pricing-section'

export const metadata: Metadata = { title: 'Narxlar' }

/**
 * The same component the landing page embeds (spec §7.7 asks for pricing in
 * both places). One source, so the two can never disagree about what a tier
 * includes.
 */
export default function PricingPage() {
  return <PricingSection />
}
