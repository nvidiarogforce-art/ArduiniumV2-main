import { useMemo } from 'react'
import { create } from 'zustand'
import en from './en.js'
import ru from './ru.js'
import uz from './uz.js'
import { SENSOR_COPY } from './sensorCopy.js'
import { KIT_COPY } from './kitCopy.js'
import { MAP_COPY } from './mapCopy.js'

/**
 * Three languages, one dictionary shape.
 *
 * Nothing in the interface holds a literal string — every label, every part
 * name and every sentence of the learning log comes through `t()`. That
 * matters more here than in most apps: the explanations *are* the product, so
 * a student reading in Uzbek has to get the same lesson, not a shrug.
 */
const extend = (dict, locale) => ({ ...dict, ...SENSOR_COPY[locale],
  ...MAP_COPY[locale],
  ui: { ...dict.ui, ...KIT_COPY[locale].ui, ...MAP_COPY[locale].ui },
  lab: { ...SENSOR_COPY[locale].lab, ...KIT_COPY[locale].lab },
  parts: { ...dict.parts, ...SENSOR_COPY[locale].parts, ...KIT_COPY[locale].parts },
  blocks: { ...dict.blocks, ...SENSOR_COPY[locale].blocks },
  toasts: { ...dict.toasts, ...SENSOR_COPY[locale].toasts },
  missions: { ...dict.missions, ...MAP_COPY[locale].missions },
  templates: { ...dict.templates, ...MAP_COPY[locale].templates },
})
export const LOCALES = { en: extend(en, 'en'), ru: extend(ru, 'ru'), uz: extend(uz, 'uz') }
export const LOCALE_LIST = Object.values(LOCALES)

function pick(dict, path) {
  let node = dict
  for (const key of path.split('.')) {
    if (node == null) return undefined
    node = node[key]
  }
  return node
}

const fill = (text, params) =>
  typeof text === 'string'
    ? text.replace(/\{(\w+)\}/g, (m, k) => (params[k] != null ? params[k] : m))
    : text

export const useI18n = create((set, get) => ({
  locale: 'en',
  setLocale: (locale) => set({ locale }),

  /** `t('ui.run')`, `t('lessons.plugged.body', { pin: 9 })`. */
  t: (path, params = {}) => {
    const dict = LOCALES[get().locale] ?? en
    const value = pick(dict, path) ?? pick(LOCALES.en, path)
    if (value == null) return path
    if (typeof value === 'string') return fill(value, params)
    return value
  },

  /** Whole sub-tree, already interpolated one level deep (for lessons). */
  block: (path, params = {}) => {
    const dict = LOCALES[get().locale] ?? en
    const value = pick(dict, path) ?? pick(LOCALES.en, path)
    if (!value || typeof value !== 'object') return null
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = fill(v, params)
    return out
  },
}))

/**
 * The hook every component should use.
 *
 * Subscribing to `state.t` alone looks right and is silently broken: `t` is a
 * stable reference, so switching language never re-renders the component. This
 * subscribes to `locale` and hands back a fresh function, which is what makes
 * the whole interface flip languages at once.
 */
export function useT() {
  const locale = useI18n((s) => s.locale)
  return useMemo(
    () => (path, params) => useI18n.getState().t(path, params),
    [locale],
  )
}

/** Same, for whole lesson objects. */
export function useTBlock() {
  const locale = useI18n((s) => s.locale)
  return useMemo(
    () => (path, params) => useI18n.getState().block(path, params),
    [locale],
  )
}

/** Non-reactive helper for stores and the render loop. */
export const t = (path, params) => useI18n.getState().t(path, params)
export const tBlock = (path, params) => useI18n.getState().block(path, params)

/** Translated display name for a part kind. */
export const partName = (kind) => t(`parts.${kind}.name`)
