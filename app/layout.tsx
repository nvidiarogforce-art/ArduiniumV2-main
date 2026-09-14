import type { Metadata, Viewport } from 'next'
import { Space_Grotesk, Manrope, JetBrains_Mono } from 'next/font/google'
import { I18nProvider } from '@/lib/i18n'
import { SiteChrome } from '@/components/site/chrome'
import { Backdrop } from '@/components/site/backdrop'
import { ScrollProgress } from '@/components/site/scroll-progress'
import './globals.css'

/**
 * Type pairing (spec §4.2 asks for bold geometric sans).
 *
 * Space Grotesk for display: a geometric grotesk with deliberately odd
 * terminals, so headings read technical rather than as the default Inter /
 * Poppins that makes every startup page look alike. Manrope for body — warm,
 * open, comfortable at the 15–16px the spec asks for. JetBrains Mono carries
 * the "engineering" register on eyebrows, pin labels and code.
 */
const display = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--ard-font-display',
  display: 'swap',
})

const sans = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--ard-font-sans',
  display: 'swap',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--ard-font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Arduinium — brauzerda robototexnika ustaxonasi',
    template: '%s · Arduinium',
  },
  description:
    'Arduino’ni o‘rganish uchun Arduino kerak emas. Robot yig‘ing, simlarni ulang, dastur yozing va uni haqiqiy fizikada haydang — brauzerda.',
  icons: { icon: '/brand/logo.png' },
}

export const viewport: Viewport = {
  themeColor: '#F8F1DE',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `lang` is corrected client-side by I18nProvider when the reader has
    // chosen English; Uzbek is the server default per spec §1.
    <html lang="uz" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh antialiased">
        <I18nProvider>
          {/* Decoration only, and every layer of it is fixed, pointer-events
              none and behind the document. Mounted once here so a single
              canvas serves every route. */}
          <Backdrop />
          <ScrollProgress />
          <SiteChrome>{children}</SiteChrome>
        </I18nProvider>
      </body>
    </html>
  )
}
