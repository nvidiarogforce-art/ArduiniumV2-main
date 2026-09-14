'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { uz, type Dict } from './uz'
import { en } from './en'

export type Locale = 'uz' | 'en'

const DICTS: Record<Locale, Dict> = { uz, en }
const STORAGE_KEY = 'arduinium.locale'

type I18nValue = {
  locale: Locale
  setLocale: (l: Locale) => void
  /**
   * The whole dictionary rather than a `t('some.key')` lookup function.
   *
   * `t.hero.titleA` is checked by TypeScript at the call site, so a typo or a
   * key removed from `uz.ts` breaks the build. A string-path helper would
   * have failed silently and rendered the raw key in front of a reader.
   */
  t: Dict
}

const I18nContext = createContext<I18nValue>({
  locale: 'uz',
  setLocale: () => {},
  t: uz,
})

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Uzbek is the product default (spec §1), so it is also what the server
  // renders. The stored preference is applied on mount; only a reader who has
  // actively chosen English ever sees a switch, and it happens before paint
  // in practice because the effect runs synchronously after hydration.
  const [locale, setLocaleState] = useState<Locale>('uz')

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'uz') setLocaleState(saved)
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Private-mode browsers throw on write; the toggle still works for the
      // current session, which is all the demo needs.
    }
  }, [])

  const value = useMemo<I18nValue>(
    () => ({ locale, setLocale, t: DICTS[locale] }),
    [locale, setLocale],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  return useContext(I18nContext)
}
