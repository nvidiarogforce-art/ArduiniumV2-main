import type { Locale } from '@/lib/i18n'

type L<T> = Record<Locale, T>

export type PostTag = 'question' | 'idea' | 'success'
export type PostRole = 'teacher' | 'student'

export type Post = {
  id: string
  tag: PostTag
  role: PostRole
  author: string
  /** Days ago, so the feed never shows a date that has gone stale. */
  daysAgo: number
  title: L<string>
  body: L<string>
}

/**
 * Seed posts for the MVP feed.
 *
 * These are written as plausible *sample content*, not as testimonials — no
 * claim is made that a named person said something about the product, and no
 * numbers are quoted (spec §8 forbids fabricated stats and testimonials). A
 * reader-authored post is stored alongside them in localStorage.
 */
export const SEED_POSTS: Post[] = [
  {
    id: 'seed-1',
    tag: 'question',
    role: 'teacher',
    author: 'Nodira O.',
    daysAgo: 2,
    title: {
      uz: '7-sinf uchun birinchi darsni qanday boshlagan ma’qul?',
      en: 'How should I open the first lesson for a 7th-grade class?',
    },
    body: {
      uz: 'Bolalar hech qachon plata ko‘rmagan. Nazariyadan boshlaymanmi yoki to‘g‘ridan-to‘g‘ri LED yoqishga o‘tamanmi? Tajribangiz bo‘lsa, yozing.',
      en: 'The class has never seen a board before. Do I start from theory, or go straight to blinking an LED? Interested in what has worked for others.',
    },
  },
  {
    id: 'seed-2',
    tag: 'idea',
    role: 'teacher',
    author: 'Sardor M.',
    daysAgo: 5,
    title: {
      uz: 'Juftlikda ishlash: biri simlarni ulaydi, ikkinchisi kod yozadi',
      en: 'Pair work: one wires, the other writes the code',
    },
    body: {
      uz: 'Dars o‘rtasida rollarni almashtiramiz. Shunda ikkalasi ham ikkala tomonni tushunadi va «men faqat kod yozaman» degan bo‘linish yo‘qoladi.',
      en: 'We swap roles halfway through the lesson. Both students end up understanding both sides, and the "I only do code" split disappears.',
    },
  },
  {
    id: 'seed-3',
    tag: 'success',
    role: 'student',
    author: 'Javohir',
    daysAgo: 8,
    title: {
      uz: 'Robotim nihoyat devorga urilmay to‘xtadi',
      en: 'My rover finally stops before hitting the wall',
    },
    body: {
      uz: 'Sensor qiymatini 20 dan 35 ga o‘zgartirdim va tormozlash uchun vaqt yetdi. Oldin har safar urilardi.',
      en: 'I changed the sensor threshold from 20 to 35 and that gave it enough time to brake. Before that it hit the wall every single run.',
    },
  },
  {
    id: 'seed-4',
    tag: 'question',
    role: 'student',
    author: 'Malika',
    daysAgo: 11,
    title: {
      uz: 'Nega ikkala g‘ildirak teskari aylanyapti?',
      en: 'Why are my two wheels turning in opposite directions?',
    },
    body: {
      uz: 'Ikkala motorga ham bir xil qiymat berdim, lekin robot joyida aylanadi. Motorlar qarama-qarshi tomonga qaragani uchunmi?',
      en: 'I gave both motors the same value but the rover just spins on the spot. Is it because the motors face opposite ways?',
    },
  },
]

export const TAG_ORDER: PostTag[] = ['question', 'idea', 'success']
