import type { Locale } from '@/lib/i18n'

type L<T> = Record<Locale, T>

export type VideoTrack = 'student' | 'teacher'

export type VideoLesson = {
  slug: string
  track: VideoTrack
  minutes: number
  level: 'easy' | 'medium' | 'hard'
  title: L<string>
  summary: L<string>
  /**
   * Real media URL, once there is any.
   *
   * `null` is meaningful: the player renders an honest placeholder panel
   * rather than a dead <video> with no source. Spec §11 lists video
   * hosting/CDN as an open decision, so nothing here commits to one — swapping
   * these strings for real URLs (or YouTube embed ids) is the whole change.
   */
  src: string | null
  /** Optional 2–3 question self-check (spec §7.5 stretch goal). */
  quiz?: Array<{ q: L<string>; options: L<string[]>; answer: number }>
}

export const VIDEOS: VideoLesson[] = [
  {
    slug: 'plata-bilan-tanishuv',
    track: 'student',
    minutes: 6,
    level: 'easy',
    title: { uz: 'Plata bilan tanishuv', en: 'Meet the board' },
    summary: {
      uz: 'Arduino Uno’ning har bir qismi nima qilishini ko‘rib chiqamiz.',
      en: 'A walk around every part of the Arduino Uno and what it does.',
    },
    src: null,
    quiz: [
      {
        q: { uz: 'GND pini nima uchun kerak?', en: 'What is the GND pin for?' },
        options: {
          uz: ['Tokni qaytarish uchun', 'Signal kuchaytirish uchun', 'Platani sovutish uchun'],
          en: ['To return the current', 'To amplify signal', 'To cool the board'],
        },
        answer: 0,
      },
      {
        q: { uz: 'Raqamli pin nechta holatda bo‘ladi?', en: 'How many states does a digital pin have?' },
        options: { uz: ['Ikkita', 'O‘nta', 'Cheksiz'], en: ['Two', 'Ten', 'Unlimited'] },
        answer: 0,
      },
    ],
  },
  {
    slug: 'birinchi-zanjir',
    track: 'student',
    minutes: 9,
    level: 'easy',
    title: { uz: 'Birinchi zanjir: LED', en: 'Your first circuit: an LED' },
    summary: {
      uz: 'Simni qayerga ulash kerak va nima uchun LED yo‘nalishga ega.',
      en: 'Where each lead goes, and why an LED has a direction.',
    },
    src: null,
    quiz: [
      {
        q: { uz: 'LED teskari ulansa nima bo‘ladi?', en: 'What happens if an LED is wired backwards?' },
        options: {
          uz: ['Shunchaki yonmaydi', 'Portlaydi', 'Platani buzadi'],
          en: ['It simply does not light', 'It explodes', 'It damages the board'],
        },
        answer: 0,
      },
    ],
  },
  {
    slug: 'robotni-yigish',
    track: 'student',
    minutes: 12,
    level: 'medium',
    title: { uz: 'Robotni yig‘ish', en: 'Assembling the rover' },
    summary: {
      uz: 'Shassi, motorlar va g‘ildiraklar — nima nimaga biriktiriladi.',
      en: 'Chassis, motors and wheels — what bolts to what.',
    },
    src: null,
  },
  {
    slug: 'sinfda-boshlash',
    track: 'teacher',
    minutes: 14,
    level: 'easy',
    title: { uz: 'Sinfda birinchi dars', en: 'Your first lesson in class' },
    summary: {
      uz: '45 daqiqalik darsni qanday tuzish va nimadan boshlash kerak.',
      en: 'How to structure a 45-minute lesson and where to start.',
    },
    src: null,
  },
  {
    slug: 'xatolarni-tushuntirish',
    track: 'teacher',
    minutes: 11,
    level: 'medium',
    title: { uz: 'Xatolarni tushuntirish', en: 'Teaching through mistakes' },
    summary: {
      uz: 'O‘quvchi xato qilganda javobni aytmasdan qanday yo‘naltirish kerak.',
      en: 'How to guide a student who is stuck without handing them the answer.',
    },
    src: null,
  },
  {
    slug: 'baholash',
    track: 'teacher',
    minutes: 8,
    level: 'medium',
    title: { uz: 'Loyihani baholash', en: 'Assessing a project' },
    summary: {
      uz: 'Robototexnika loyihasini nimaga qarab baholash mumkin.',
      en: 'What to actually assess in a robotics project.',
    },
    src: null,
  },
]

export const getVideo = (slug: string) => VIDEOS.find((v) => v.slug === slug)
