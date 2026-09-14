import type { Locale } from '@/lib/i18n'

type L<T> = Record<Locale, T>

export type LessonBlock =
  | { kind: 'p'; text: L<string> }
  | { kind: 'h'; text: L<string> }
  | { kind: 'list'; items: L<string[]> }
  | { kind: 'code'; code: string; caption: L<string> }
  | { kind: 'note'; text: L<string> }

export type Lesson = {
  slug: string
  level: 'easy' | 'medium' | 'hard'
  minutes: number
  /** Whether the lesson has a matching task in the 3D sandbox. */
  sandbox: boolean
  /**
   * `false` means the lesson is announced but not written. Section 7.4 asks
   * for honest placeholders — a card that says "coming soon" rather than a
   * detail page full of invented filler.
   */
  available: boolean
  title: L<string>
  summary: L<string>
  objectives: L<string[]>
  body: LessonBlock[]
}

export const LESSONS: Lesson[] = [
  {
    slug: 'arduino-nima',
    level: 'easy',
    minutes: 8,
    sandbox: false,
    available: true,
    title: { uz: 'Arduino nima?', en: 'What is Arduino?' },
    summary: {
      uz: 'Plata nima qiladi, pinlar nima uchun kerak va dastur qanday ishga tushadi.',
      en: 'What the board does, what the pins are for, and how a program starts running.',
    },
    objectives: {
      uz: [
        'Arduino Uno platasining asosiy qismlarini nomlash',
        'Raqamli va analog pinlar farqini tushuntirish',
        'setup() va loop() nima uchun kerakligini aytish',
      ],
      en: [
        'Name the main parts of an Arduino Uno board',
        'Explain the difference between digital and analog pins',
        'Say what setup() and loop() are for',
      ],
    },
    body: [
      {
        kind: 'p',
        text: {
          uz: 'Arduino Uno — kichkina kompyuter. Uning ichida bitta dastur ishlaydi va u faqat shu dasturni bajaradi. Kompyuteringizdan farqi shundaki, u ekran yoki klaviatura bilan emas, balki simlar orqali tashqi dunyo bilan gaplashadi.',
          en: 'An Arduino Uno is a small computer. It runs exactly one program and does only that. Unlike your laptop, it talks to the outside world through wires rather than a screen and keyboard.',
        },
      },
      { kind: 'h', text: { uz: 'Pinlar — platanin qo‘llari', en: 'Pins — the board’s hands' } },
      {
        kind: 'p',
        text: {
          uz: 'Plataning chetidagi teshiklar pin deb ataladi. Ular orqali plata signal yuboradi yoki qabul qiladi. Ikki xil pin bor:',
          en: 'The holes along the edge of the board are called pins. The board sends and receives signals through them. There are two kinds:',
        },
      },
      {
        kind: 'list',
        items: {
          uz: [
            'Raqamli pinlar (D0–D13) — faqat ikki holat: yoqilgan (HIGH) yoki o‘chirilgan (LOW).',
            'Analog pinlar (A0–A5) — 0 dan 1023 gacha bo‘lgan qiymatni o‘qiydi, masalan yorug‘lik darajasi.',
            'Quvvat pinlari (5V, 3.3V, GND) — bular signal emas, ular tok beradi.',
          ],
          en: [
            'Digital pins (D0–D13) — only two states: on (HIGH) or off (LOW).',
            'Analog pins (A0–A5) — read a value from 0 to 1023, for example a light level.',
            'Power pins (5V, 3.3V, GND) — these carry current, not signal.',
          ],
        },
      },
      {
        kind: 'note',
        text: {
          uz: 'GND — «yer». Har bir zanjir GND ga qaytishi kerak, aks holda tok aylanmaydi va hech narsa ishlamaydi. Bu boshlovchilar eng ko‘p qiladigan xato.',
          en: 'GND is "ground". Every circuit has to return to GND, or current cannot flow and nothing works. This is the single most common beginner mistake.',
        },
      },
      { kind: 'h', text: { uz: 'Dastur qanday ishlaydi', en: 'How the program runs' } },
      {
        kind: 'code',
        code: `void setup() {
  pinMode(13, OUTPUT);   // bir marta bajariladi
}

void loop() {
  digitalWrite(13, HIGH);  // cheksiz takrorlanadi
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
}`,
        caption: {
          uz: 'setup() bir marta ishga tushadi, loop() esa plata o‘chgunicha qayta-qayta takrorlanadi.',
          en: 'setup() runs once; loop() repeats forever until the board loses power.',
        },
      },
      {
        kind: 'p',
        text: {
          uz: 'Shuning uchun sozlashni — masalan «13-pin chiqish bo‘lsin» — setup() ichiga yozamiz, harakatni esa loop() ichiga. Keyingi darsda buni o‘zingiz sinab ko‘rasiz.',
          en: 'That is why setup is where you configure things — "pin 13 is an output" — and loop is where the behaviour goes. In the next lesson you will try it yourself.',
        },
      },
    ],
  },

  {
    slug: 'led-yoqish',
    level: 'easy',
    minutes: 12,
    sandbox: true,
    available: true,
    title: { uz: 'LED’ni yoqish', en: 'Blinking an LED' },
    summary: {
      uz: 'Birinchi zanjir va birinchi dastur: chiroqni yoqib-o‘chirish.',
      en: 'Your first circuit and first program: turning a light on and off.',
    },
    objectives: {
      uz: [
        'LED’ni raqamli pinga to‘g‘ri ulash',
        'pinMode va digitalWrite buyruqlarini ishlatish',
        'delay yordamida vaqtni boshqarish',
      ],
      en: [
        'Wire an LED to a digital pin correctly',
        'Use the pinMode and digitalWrite commands',
        'Control timing with delay',
      ],
    },
    body: [
      {
        kind: 'p',
        text: {
          uz: 'LED — yo‘nalishi bor detal. Uni teskari ulasangiz, u shunchaki yonmaydi (buzilmaydi, lekin ishlamaydi). Uzun oyoq — musbat (anod), u pinga ketadi; kalta oyoq — manfiy (katod), u GND ga ketadi.',
          en: 'An LED has a direction. Wire it backwards and it simply will not light — it is not damaged, it just does nothing. The long leg is positive (anode) and goes to the pin; the short leg is negative (cathode) and goes to GND.',
        },
      },
      { kind: 'h', text: { uz: 'Zanjirni yig‘ish', en: 'Building the circuit' } },
      {
        kind: 'list',
        items: {
          uz: [
            'Sinov maydonini oching va LED detalini chassiga qo‘ying.',
            'Bitta simni LED’ning musbat uchidan D13 pinga torting.',
            'Ikkinchi simni LED’ning manfiy uchidan GND pinga torting.',
          ],
          en: [
            'Open the sandbox and place the LED part on the chassis.',
            'Drag one lead from the LED’s positive end to pin D13.',
            'Drag a second lead from the LED’s negative end to a GND pin.',
          ],
        },
      },
      {
        kind: 'code',
        code: `void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(500);
  digitalWrite(13, LOW);
  delay(500);
}`,
        caption: {
          uz: 'Bu dastur chiroqni yarim soniyada bir marta yoqib-o‘chiradi.',
          en: 'This program turns the light on and off twice a second.',
        },
      },
      {
        kind: 'note',
        text: {
          uz: 'delay ni olib tashlab ko‘ring. Chiroq shu qadar tez yonib-o‘chadiki, ko‘zingiz uni doim yoniq deb ko‘radi — bu xato emas, bu tezlik.',
          en: 'Try removing the delay. The light blinks so fast your eye reads it as permanently on — that is not a bug, that is speed.',
        },
      },
      {
        kind: 'p',
        text: {
          uz: 'Bloklar bo‘limida ham xuddi shu dasturni yig‘ishingiz mumkin. Kod bo‘limini ochsangiz, bloklaringiz aynan yuqoridagi C++ ga aylanganini ko‘rasiz.',
          en: 'You can build the same program in the blocks panel. Open the code tab and you will see your blocks turn into exactly the C++ above.',
        },
      },
    ],
  },

  {
    slug: 'tugma-va-kirish',
    level: 'medium',
    minutes: 15,
    sandbox: true,
    available: true,
    title: { uz: 'Tugmalar va raqamli kirish', en: 'Buttons & Digital Input' },
    summary: {
      uz: 'Plata tashqaridan signal qabul qilganda nima bo‘ladi va shart qanday yoziladi.',
      en: 'What happens when the board receives a signal, and how to write a condition.',
    },
    objectives: {
      uz: [
        'INPUT va OUTPUT rejimlari farqini tushunish',
        'digitalRead bilan tugma holatini o‘qish',
        'if sharti bilan qaror qabul qiladigan dastur yozish',
      ],
      en: [
        'Understand the difference between INPUT and OUTPUT modes',
        'Read a button state with digitalRead',
        'Write a program that makes a decision using an if condition',
      ],
    },
    body: [
      {
        kind: 'p',
        text: {
          uz: 'Hozirgacha plata faqat buyruq berdi. Endi u eshitadi. digitalRead(pin) o‘sha pinda kuchlanish bor-yo‘qligini tekshiradi va HIGH yoki LOW qaytaradi.',
          en: 'So far the board has only given orders. Now it listens. digitalRead(pin) checks whether there is voltage on that pin and returns HIGH or LOW.',
        },
      },
      { kind: 'h', text: { uz: 'Nega shart kerak', en: 'Why you need a condition' } },
      {
        kind: 'p',
        text: {
          uz: 'Qiymatni o‘qish o‘zi hech narsa qilmaydi. Uni tekshirib, natijaga qarab boshqacha ish qilish kerak. Buni if bajaradi.',
          en: 'Reading a value on its own does nothing. You have to test it and act differently depending on the result. That is what if does.',
        },
      },
      {
        kind: 'code',
        code: `void setup() {
  pinMode(2, INPUT);
  pinMode(13, OUTPUT);
}

void loop() {
  if (digitalRead(2) == HIGH) {
    digitalWrite(13, HIGH);
  } else {
    digitalWrite(13, LOW);
  }
}`,
        caption: {
          uz: 'Tugma bosilganda chiroq yonadi, qo‘yib yuborilganda o‘chadi.',
          en: 'The light comes on while the button is pressed and goes off when released.',
        },
      },
      {
        kind: 'note',
        text: {
          uz: 'Sinov maydonida masofa sensori ham xuddi shu tarzda ishlaydi: readDistanceCm() son qaytaradi, siz uni if ichida tekshirasiz. Robot to‘siqni «ko‘rishi» shundan boshlanadi.',
          en: 'The distance sensor in the sandbox works the same way: readDistanceCm() returns a number and you test it inside an if. That is where a rover "seeing" an obstacle begins.',
        },
      },
    ],
  },

  {
    slug: 'sensorlar',
    level: 'medium',
    minutes: 0,
    sandbox: false,
    available: false,
    title: { uz: 'Sensorlar', en: 'Sensors' },
    summary: {
      uz: 'Masofa, yorug‘lik va harorat sensorlari bilan ishlash.',
      en: 'Working with distance, light and temperature sensors.',
    },
    objectives: { uz: [], en: [] },
    body: [],
  },

  {
    slug: 'servo-motorlar',
    level: 'hard',
    minutes: 0,
    sandbox: false,
    available: false,
    title: { uz: 'Servo motorlar', en: 'Servo Motors' },
    summary: {
      uz: 'Burchak bo‘yicha aniq boshqariladigan motorlar.',
      en: 'Motors you can steer to a precise angle.',
    },
    objectives: { uz: [], en: [] },
    body: [],
  },
]

export const getLesson = (slug: string) => LESSONS.find((l) => l.slug === slug)
