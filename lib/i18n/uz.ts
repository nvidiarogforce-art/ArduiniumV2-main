/**
 * Uzbek — the source dictionary and the product default.
 *
 * This object's shape IS the contract: `en.ts` is typed as `Dict`, so an
 * English translation that forgets a key fails the build instead of rendering
 * an empty string in a demo.
 *
 * Landing copy is the approved wording from the build spec, verbatim.
 */
export const uz = {
  common: {
    soon: 'Tez orada',
    back: 'Orqaga',
    loading: 'Yuklanmoqda…',
    contentPending: 'Matn tayyorlanmoqda',
    minutes: 'daqiqa',
    all: 'Barchasi',
    retry: 'Qayta urinish',
    close: 'Yopish',
    error: 'Xatolik yuz berdi',
    saving: 'Saqlanmoqda…',
    offline: 'Ma’lumotlarni yuklab bo‘lmadi.',
    notConfiguredTitle: 'Server hali sozlanmagan',
    notConfiguredBody:
      'Bu bo‘lim uchun ma’lumotlar bazasi kerak. Loyihaning .env.local faylini to‘ldiring — qolgan bo‘limlar shusiz ham ishlaydi.',
  },

  nav: {
    sandbox: 'Sinov maydoni',
    lessons: 'Darslar',
    videos: 'Video darslar',
    community: 'Hamjamiyat',
    pricing: 'Narxlar',
    teach: "O'qituvchilarga",
    start: 'Ro‘yxatdan o‘tish',
    menu: 'Menyu',
    ai: 'AI yordamchi',
    admin: 'Maktab paneli',
    login: 'Kirish',
    account: 'Profil',
  },

  hero: {
    badge: 'Robotika • Arduino • Kod',
    titleA: 'Robotikani brauzerda o‘rganing —',
    titleB: 'qurilma shart emas',
    sub: 'Arduinium — maktab o‘quvchilari uchun virtual sxema va kod sandbox’i. Real platalar xarid qilmasdan LED yondiring, tugmalarni ulang va robotlarni dasturlashni o‘rganing.',
    ctaPrimary: 'Bepul boshlash',
    ctaSecondary: 'Narxlarni ko‘rish',
    hint: 'Biror joyga bosing — butun sahifa jonlanadi',
  },

  ticker: ['Arduino', 'LED', 'Servo', 'Sensor', 'Breadboard', 'pinMode', 'digitalWrite', 'delay', 'Robotika', 'Kod'],

  problem: {
    eyebrow: 'Muammo',
    title: 'Nega virtual laboratoriya?',
    body: 'Robotika ta’limi yo‘lida uchta katta to‘siq turadi. Arduinium uchalasini ham yechadi.',
    items: [
      {
        title: 'Qimmat uskunalar',
        body: 'Arduino to‘plamlari har bir o‘quvchi uchun qimmatga tushadi. Virtual sandbox har bir bolaga bepul ish stansiyasini beradi.',
      },
      {
        title: 'O‘qituvchilar tanqis',
        body: 'Robotika o‘qituvchilari kam. Biz informatika o‘qituvchilarini tayyorlaymiz va tayyor darsliklar beramiz.',
      },
      {
        title: 'Singan detallar qo‘rquvi',
        body: 'Virtual sxemada noto‘g‘ri ulanish hech narsani kuydirmaydi — bolalar bemalol eksperiment qiladi.',
      },
    ],
  },

  features: {
    eyebrow: 'Imkoniyatlar',
    title: 'Bitta platforma — hammasi ichida',
    sub: 'O‘rganish, o‘qitish va ulashish uchun kerak bo‘lgan barcha asboblar.',
    items: [
      { title: 'Virtual sandbox', body: 'Tinkercad uslubidagi sxema va kod muharriri: LED, tugma, sensorlar — hammasi brauzerda.' },
      { title: 'O‘zbek tilidagi darslar', body: 'Bosqichma-bosqich matn darslar, har biri sandbox mashqlari bilan.' },
      { title: 'Video darslar', body: 'Qisqa va aniq videolar — bolalar uchun ham, o‘qituvchilar uchun alohida trek.' },
      { title: 'Hamjamiyat', body: 'O‘qituvchilar va o‘quvchilar loyihalar, savollar va g‘oyalar bilan o‘rtoqlashadi.' },
      { title: 'O‘qituvchi treki', body: 'Informatika o‘qituvchisini robotika o‘qituvchisiga aylantiruvchi sertifikatlash kurslari.' },
      { title: 'Nishonlar va progress', body: 'Har bir yakunlangan dars uchun nishon — motivatsiya doim yuqori.' },
    ],
  },

  how: {
    eyebrow: 'Qanday ishlaydi',
    title: 'To‘rt qadamda birinchi loyihangiz',
    sub: 'Bu ketma-ketlik haqiqiy robototexnika loyihasining ish tartibi bilan bir xil.',
    steps: [
      { n: '01', title: 'Ro‘yxatdan o‘ting', body: 'Rolni tanlang: o‘quvchi yoki o‘qituvchi.' },
      { n: '02', title: 'Sxema yig‘ing', body: 'Komponentlarni tanlang va virtual breadboard’ga joylashtiring.' },
      { n: '03', title: 'Kod yozing', body: 'pinMode, digitalWrite, delay — yozing va ishga tushiring.' },
      { n: '04', title: 'Ulashing', body: 'Loyihani hamjamiyatda ko‘rsating, nishonlar to‘plang.' },
    ],
  },

  achieve: {
    eyebrow: 'Natijalar',
    title: 'Kim nimalarga erishadi',
    kidsTitle: 'O‘quvchi',
    kids: [
      'Elektr zanjirlarini mustaqil yig‘ish',
      'Arduino kodini yozish va o‘qish',
      'Muammolarni bartaraf etish ko‘nikmasi',
      'Shaxsiy loyiha portfoliosi',
    ],
    teachersTitle: 'O‘qituvchi',
    teachers: [
      'Robotika bo‘yicha sertifikatlash treki',
      'Tayyor dars rejalari va materiallar',
      'Sinfda virtual laboratoriya',
      'Hamjamiyatda tajriba almashish',
    ],
  },

  quote: {
    /**
     * Papert, Mindstorms (1980) — reproduced verbatim from the approved
     * source and never translated. The Uzbek rendering below is a clearly
     * labelled separate line, shown only in UZ.
     */
    text: 'In many schools today, the phrase “computer-aided instruction” means making the computer teach the child. One might say the computer is being used to program the child. In my vision, the child programs the computer and, in doing so, both acquires a sense of mastery over a piece of the most modern and powerful technology and establishes an intimate contact with some of the deepest ideas from science, from mathematics, and from the art of intellectual model building.',
    author: 'Seymour Papert',
    source: 'Mindstorms: Children, Computers, and Powerful Ideas, 1980',
    lead: 'Arduinium shu fikr ustiga qurilgan:',
    translation:
      'Tarjima: Bugungi ko‘pgina maktablarda «kompyuter yordamida o‘qitish» iborasi kompyuter bolani o‘qitishini anglatadi. Mening tasavvurimda esa bola kompyuterni o‘zi dasturlaydi — va shu orqali zamonaviy texnologiya ustidan o‘zlashtirish hissini hamda fan, matematika va intellektual modellar qurish san’atining eng chuqur g‘oyalari bilan yaqin aloqani qo‘lga kiritadi.',
  },

  videosTeaser: {
    eyebrow: 'Video darslar',
    title: 'Ko‘rib o‘rganing',
    sub: 'Qisqa, aniq va amaliy — sinab ko‘rish uchun tayyor.',
    all: 'Barchasini ko‘rish',
  },

  communityTeaser: {
    eyebrow: 'Hamjamiyat',
    title: 'Birga o‘samiz',
    sub: 'O‘qituvchilar va o‘quvchilar — bitta do‘stona maydonda.',
    join: 'Qo‘shilish',
    joinTitle: 'Hamjamiyatga qo‘shiling',
    joinBody: 'Savol bering, loyihangizni ko‘rsating, tajriba almashing.',
  },

  pricing: {
    eyebrow: 'Narxlar',
    title: 'Oddiy va halol narxlar',
    sub: 'Bepul boshlang — maktablar uchun moslashuvchan taklif.',
    free: {
      name: 'Shaxsiy',
      price: 'Bepul',
      note: 'Har bir o‘quvchi uchun',
      cta: 'Bepul boshlash',
      features: [
        'Virtual sandbox',
        'Matn darslari',
        'Boshlang‘ich video darslar',
        'Hamjamiyat',
      ],
    },
    school: {
      name: 'Maktab / Sinf',
      price: 'So‘rov asosida',
      note: 'Butun sinf uchun',
      cta: 'So‘rov yuborish',
      features: [
        'Shaxsiy tarafdagi hamma narsa',
        'O‘qituvchi treki va sertifikat',
        'Sinf paneli va progress',
        'Dars rejalari va metodika',
        'Ustuvor yordam',
      ],
    },
    popular: 'Maktablar uchun',
  },

  finalCta: {
    title: 'Kelajakni bugun quring',
    sub: 'Birinchi dars — bepul, karta talab qilinmaydi.',
    button: 'Ro‘yxatdan o‘tish',
  },

  footer: {
    tagline: 'Maktab o‘quvchilari uchun brauzerda Arduino, elektronika va robotika platformasi.',
    product: 'Platforma',
    learn: 'O‘rganish',
    company: 'Rollar',
    account: 'Profil',
    rights: 'Barcha huquqlar himoyalangan.',
    madeIn: 'Seymour Papert, Mindstorms (1980) — iqtibos tasdiqlangan.',
  },

  register: {
    title: 'Rolingizni tanlang',
    sub: 'Keyinroq yana rol qo‘shish mumkin — hozircha o‘zingizga mosini tanlang.',
    sticker: 'Bepul • Karta shart emas',
    roles: {
      student: { title: 'O‘quvchiman', body: 'Robotikani o‘rganmoqchiman' },
      teacher: { title: 'O‘qituvchiman', body: 'Sinfimda robotika o‘qitmoqchiman' },
    },
    fields: {
      name: 'Ism familiya',
      age: 'Yosh',
      grade: 'Sinf',
      school: 'Maktab',
      city: 'Shahar / tuman',
      subject: 'Fan',
      experience: 'Robototexnika bo‘yicha tajriba',
      phone: 'Telefon raqami',
      email: 'Email',
    },
    placeholders: {
      name: 'Masalan: Ali Valiyev',
      school: 'Masalan: 12-maktab',
    },
    subjects: ['Informatika', 'Texnologiya', 'Boshqa'],
    experienceOptions: ['Umuman yo‘q', 'Biroz bor', 'Tajribam yetarli'],
    steps: { role: 'Rol', details: 'Ma’lumotlar', done: 'Tayyor' },
    submit: 'Yuborish',
    successTitle: 'Xush kelibsiz!',
    successBody: 'Hisobingiz (demo) yaratildi. Endi o‘z panelingizga o‘ting.',
    successGo: 'Panelga o‘tish',
    changeRole: 'Rolni o‘zgartirish',
    demoNote: 'Bu MVP namunasi — ma’lumotlar faqat brauzeringizda saqlanadi va hech qayerga yuborilmaydi.',
  },

  learn: {
    title: 'Ish stoli',
    sub: 'Qayerda to‘xtagan bo‘lsangiz, o‘sha yerdan davom eting.',
    greeting: 'Xush kelibsiz',
    continue: 'Davom etish',
    openSandbox: 'Sinov maydoni',
    progress: 'Tugallangan darslar',
    cards: {
      lessons: { title: 'Matnli darslar', body: 'Nazariya va amaliy topshiriqlar' },
      videos: { title: 'Video darslar', body: 'Qadam-baqadam ko‘rsatmalar' },
      sandbox: { title: 'Sinov maydoni', body: 'Yig‘ing, ulang, dasturlang' },
      community: { title: 'Hamjamiyat', body: 'Savollar va loyihalar' },
    },
  },

  lessons: {
    title: 'Matnli darslar',
    sub: 'Har bir dars sinov maydonidagi aniq topshiriq bilan tugaydi.',
    open: 'Darsni ochish',
    openSandbox: 'Sinov maydonida bajarish',
    markDone: 'Tugallandi deb belgilash',
    done: 'Tugallandi',
    difficulty: 'Daraja',
    duration: 'Davomiyligi',
    levels: { easy: 'Boshlang‘ich', medium: 'O‘rta', hard: 'Murakkab' },
    objectives: 'Nimani o‘rganasiz',
    next: 'Keyingi dars',
  },

  videos: {
    title: 'Video darslar',
    sub: 'Qisqa, aniq va amaliy modullar.',
    trackStudent: 'O‘quvchilar uchun',
    trackTeacher: 'O‘qituvchilar tayyorgarligi',
    teacherNote: 'Bu trek o‘qituvchilarni robotika darsini olib borishga tayyorlaydi.',
    watch: 'Ko‘rish',
    check: 'O‘zingizni tekshiring',
    checkNote: 'Javoblar hech qayerga yuborilmaydi.',
    correct: 'To‘g‘ri',
    wrong: 'Yana urinib ko‘ring',
    placeholder: 'Namuna video — yakuniy kontent tayyorlanmoqda',
  },

  community: {
    title: 'Hamjamiyat',
    sub: 'Savol bering, dars g‘oyasini ulashing yoki o‘quvchingiz loyihasini ko‘rsating.',
    newPost: 'Yangi post',
    formTitle: 'Sarlavha',
    formBody: 'Matn',
    formTag: 'Turkum',
    formAuthor: 'Ismingiz',
    publish: 'Joylashtirish',
    cancel: 'Bekor qilish',
    empty: 'Bu turkumda hozircha post yo‘q.',
    roleTeacher: 'O‘qituvchi',
    roleStudent: 'O‘quvchi',
    tags: { question: 'Savol', idea: 'G‘oya', success: 'Muvaffaqiyat hikoyasi' },
    localNote: 'Postlar hozircha faqat sizning brauzeringizda saqlanadi.',
    signInToPost: 'Post joylashtirish uchun hisobingizga kiring.',
    failed: 'Postni joylashtirib bo‘lmadi. Qayta urinib ko‘ring.',
  },

  simulator: {
    title: 'Sinov maydoni',
    lessonContext: 'Dars',
    freeMode: 'Erkin rejim',
    backToLessons: 'Darslar ro‘yxatiga',
    markComplete: 'Darsni tugallandi deb belgilash',
    completed: 'Tugallandi',
    loading: 'Ustaxona yuklanmoqda…',
    loadingNote: '3D dvigatel va fizika ishga tushirilmoqda',
    aiHelp: 'AI yordamchi',
    aiSoon: 'AI yordamchi keyingi bosqichda ishga tushadi',
    aiOpen: 'Ardudan so‘rash',
    aiPanel: 'Ardu — yordamchi',
    fullscreenNote: 'Eng qulay ishlash uchun kompyuter ekranidan foydalaning.',
  },

  teach: {
    title: 'O‘qituvchilar uchun',
    sub: 'Sinfni boshqarish, o‘quvchilar faoliyati va qayta tayyorlash treki.',
    stubTitle: 'Bu bo‘lim tayyorlanmoqda',
    stubBody: 'O‘qituvchi paneli keyingi bosqichda ishga tushadi. Hozircha video darslar va hamjamiyatdan foydalanishingiz mumkin.',
    trainingTitle: 'Qayta tayyorlash kurslari',
    trainingSub: 'Informatika o‘qituvchisidan robotika o‘qituvchisigacha.',
    goVideos: 'O‘qituvchilar videolariga o‘tish',
    myClasses: 'Mening sinflarim',
    noClasses: 'Sizga hali sinf biriktirilmagan.',
    students: 'o‘quvchi',
    progress: 'O‘rtacha progress',
    roster: 'Ro‘yxat',
    lastActive: 'So‘nggi faollik',
    completedOf: 'dan',
  },

  account: {
    title: 'Profil',
    sub: 'Asosiy ma’lumotlar.',
    role: 'Rol',
    language: 'Til',
    noAccount: 'Siz hali ro‘yxatdan o‘tmagansiz.',
    register: 'Ro‘yxatdan o‘tish',
    reset: 'Ma’lumotlarni tozalash',
    stubNote: 'Obuna va to‘lovlar keyingi bosqichda qo‘shiladi.',
    email: 'Email',
    school: 'Maktab',
    signOut: 'Chiqish',
  },

  auth: {
    loginTitle: 'Hisobingizga kiring',
    loginSub: 'Progressingiz va sinf ma’lumotlaringiz shu yerda saqlanadi.',
    email: 'Email',
    password: 'Parol',
    passwordHint: 'Kamida 6 ta belgi',
    signIn: 'Kirish',
    signOut: 'Chiqish',
    signingIn: 'Kirilmoqda…',
    noAccount: 'Hisobingiz yo‘qmi?',
    haveAccount: 'Hisobingiz bormi?',
    toRegister: 'Ro‘yxatdan o‘tish',
    toLogin: 'Kirish',
    signedInAs: 'Kirdingiz:',
    confirmTitle: 'Emailingizni tasdiqlang',
    confirmBody: 'Xatingizga tasdiqlash havolasi yubordik. Havolani bosgach, shu yerdan kiring.',
    errors: {
      invalidCredentials: 'Email yoki parol noto‘g‘ri.',
      emailTaken: 'Bu email allaqachon ro‘yxatdan o‘tgan.',
      weakPassword: 'Parol juda qisqa — kamida 6 ta belgi kerak.',
      invalidEmail: 'Email manzili noto‘g‘ri.',
      rateLimited: 'Juda ko‘p urinish. Birozdan so‘ng qayta urinib ko‘ring.',
      unknown: 'Nimadir noto‘g‘ri ketdi. Qayta urinib ko‘ring.',
      notConfigured: 'Server hali sozlanmagan — hisob yaratib bo‘lmaydi.',
    },
  },

  ai: {
    title: 'Ardu — AI yordamchi',
    sub: 'Sxema yoki kod bo‘yicha savolingizni bering. Ardu javobni aytib qo‘ymaydi — yo‘l ko‘rsatadi.',
    placeholder: 'Savolingizni yozing…',
    send: 'Yuborish',
    thinking: 'Ardu o‘ylayapti…',
    newChat: 'Yangi suhbat',
    emptyTitle: 'Nimadan boshlaymiz?',
    suggestions: [
      'LED nega yonmayapti?',
      'digitalWrite va analogWrite farqi nima?',
      'Robotim devorga urilmasligi uchun nima qilay?',
    ],
    remaining: 'Bugun qolgan savollar:',
    limitTitle: 'Bugungi limit tugadi',
    limitBody: 'Ertaga yana davom etamiz. Shu orada darsni o‘qib chiqing yoki sinov maydonida sinab ko‘ring.',
    errorTitle: 'Javob olinmadi',
    errorBody: 'Ulanishda muammo bo‘ldi. Qayta urinib ko‘ring.',
    notConfiguredTitle: 'AI yordamchi sozlanmagan',
    notConfiguredBody: 'Server administratori ANTHROPIC_API_KEY kalitini qo‘shishi kerak. Qolgan bo‘limlar ishlaydi.',
    signInTitle: 'Kirish talab qilinadi',
    signInBody: 'Ardu bilan suhbatlashish uchun hisobingizga kiring.',
    privacy: 'Suhbatlaringiz faqat sizga ko‘rinadi — o‘qituvchi ham, maktab ma’muri ham o‘qiy olmaydi.',
    contextNote: 'Ardu hozirgi sxemangiz va kodingizni ko‘rib turibdi.',
  },

  admin: {
    title: 'Maktab paneli',
    sub: 'Maktabingiz bo‘yicha umumiy ko‘rsatkichlar.',
    denied: 'Bu bo‘lim faqat maktab ma’muri uchun.',
    stats: {
      students: 'O‘quvchilar',
      teachers: 'O‘qituvchilar',
      classes: 'Sinflar',
      completion: 'Darslar bajarilishi',
    },
    activityTitle: 'O‘qituvchilar faolligi',
    activitySub: 'Kim yordamga muhtoj bo‘lishi mumkin — nazorat emas, qo‘llab-quvvatlash uchun.',
    levels: {
      today: 'Bugun faol',
      week: 'Shu hafta faol',
      fortnight: 'Ikki haftadan beri',
      dormant: '2+ hafta faol emas',
      never: 'Hali boshlamagan',
    },
    checkIn: 'Bu o‘qituvchilar bilan bog‘lanib ko‘ring',
    allActive: 'Hamma o‘qituvchi shu hafta faol bo‘lgan.',
    classesTitle: 'Sinflar va ro‘yxatlar',
    classesSub: 'Har bir sinfdagi o‘quvchilar va ularning umumiy progressi.',
    noClasses: 'Hali sinf yaratilmagan.',
    noTeachers: 'Hali o‘qituvchi qo‘shilmagan.',
    student: 'O‘quvchi',
    grade: 'Sinf',
    completed: 'Tugallangan',
    lastActive: 'So‘nggi faollik',
    never: 'hech qachon',
    privacyNote:
      'Bu yerda o‘quvchilarning AI bilan suhbatlari ko‘rsatilmaydi va ko‘rsatilmaydi ham — faqat umumiy faollik.',
    empty: 'Ma’lumot yo‘q.',
  },
}

export type Dict = typeof uz
