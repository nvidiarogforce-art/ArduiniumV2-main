'use client'

import Link from 'next/link'
import { ArrowRight, MousePointerClick } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/site/section'
import { HeroRipple } from '@/components/site/backdrop'
import { Ardu } from '@/components/brand/logo'
import { Rise } from '@/components/site/reveal'
import { useI18n } from '@/lib/i18n'

const CHIPS = ['pinMode()', 'digitalWrite()', 'digitalRead()', 'delay()']

/**
 * Hero: a dark animated band with its own contained ripple.
 *
 * The ripple canvas sits inside this section at z-index 0 and every piece of
 * content sits at z-index 1, so a wave passes *behind* the headline. That
 * ordering is the whole point — see the note on `.ard-fx` in globals.css.
 */
export function Hero() {
  const { t } = useI18n()

  return (
    <section className="ard-band-dark relative isolate overflow-hidden">
      <HeroRipple />

      <Container className="relative z-[1] grid items-center gap-14 py-20 lg:grid-cols-[1.06fr_0.94fr] lg:py-28">
        <div>
          <Rise>
            <span className="inline-flex items-center gap-2.5 rounded-full border-2 border-teal px-4 py-1.5 font-display text-[12.5px] font-extrabold uppercase tracking-[0.1em] text-bg">
              <span className="ard-led size-2.5 rounded-full bg-orange" />
              {t.hero.badge}
            </span>
          </Rise>

          <Rise delay={80}>
            <h1 className="mt-6 font-display text-[clamp(2.1rem,5.4vw,3.9rem)] leading-[1.06] text-bg">
              <span className="block">{t.hero.titleA}</span>
              <span className="relative mt-1 inline-block text-orange after:absolute after:inset-x-0 after:bottom-[3px] after:h-[5px] after:rounded-[3px] after:bg-teal after:content-['']">
                {t.hero.titleB}
              </span>
            </h1>
          </Rise>

          <Rise delay={160}>
            <p className="mt-6 max-w-[52ch] text-[17.5px] leading-relaxed text-bg/78">{t.hero.sub}</p>
          </Rise>

          <Rise delay={240}>
            <div className="mt-9 flex flex-wrap gap-3.5">
              <Button asChild size="lg">
                <Link href="/register">
                  {t.hero.ctaPrimary}
                  <ArrowRight size={18} strokeWidth={2.5} />
                </Link>
              </Button>
              <Button asChild size="lg" variant="onDark">
                <Link href="#pricing">{t.hero.ctaSecondary}</Link>
              </Button>
            </div>
          </Rise>

          {/* Real function names from the language the student will actually
              write — a datasheet detail, not a decorative badge row. */}
          <Rise delay={320}>
            <ul className="mt-8 flex flex-wrap gap-2.5">
              {CHIPS.map((c) => (
                <li
                  key={c}
                  className="rounded-[9px] border-2 border-bg/30 bg-navy/45 px-3 py-2 font-mono text-[12.5px] font-bold text-bg/90 transition-[transform,border-color] duration-150 hover:-translate-y-[3px] hover:border-teal"
                >
                  {c}
                </li>
              ))}
            </ul>
          </Rise>

          <Rise delay={380}>
            <p className="mt-6 inline-flex items-center gap-2 text-[13.5px] text-bg/60">
              <MousePointerClick size={15} />
              {t.hero.hint}
            </p>
          </Rise>
        </div>

        <Rise delay={200} className="relative mx-auto w-full max-w-[300px] lg:max-w-[380px]">
          <Ardu
            width={380}
            priority
            className="h-auto w-full drop-shadow-[7px_9px_0_rgba(28,53,71,0.55)]"
          />

          {/* The first program, sitting at the mascot's feet. Overlaps the
              wheels only — a depth cue, not a mask. */}
          <div className="absolute -bottom-8 -left-10 hidden w-[248px] rotate-[-3deg] rounded-[12px] border-2 border-bg bg-navy p-4 font-mono text-[11px] leading-[1.62] shadow-[5px_5px_0_var(--color-teal)] sm:block">
            <span className="mb-2 block font-mono text-[10.5px] uppercase tracking-[0.1em] text-bg/55">
              Blink.ino
            </span>
            <pre className="overflow-hidden whitespace-pre text-bg">
              <span className="text-slate">{'// birinchi dastur'}</span>
              {'\n'}
              <span className="text-teal">void</span>{' setup() {\n  pinMode('}
              <span className="text-orange">13</span>
              {', OUTPUT);\n}\n'}
              <span className="text-teal">void</span>{' loop() {\n  digitalWrite('}
              <span className="text-orange">13</span>
              {', HIGH);\n  delay('}
              <span className="text-orange">500</span>
              {');\n  digitalWrite('}
              <span className="text-orange">13</span>
              {', LOW);\n  delay('}
              <span className="text-orange">500</span>
              {');\n}'}
            </pre>
          </div>
        </Rise>
      </Container>
    </section>
  )
}
