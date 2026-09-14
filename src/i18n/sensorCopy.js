// Vocabulary shared by the palette, inspector, sensor lab and block editor.
const parts = {
  en: [
    ['lineSensor', 'Line sensor', 'Looks down for the dark tape. 0% = floor, 100% = line.'],
    ['lightSensor', 'Light sensor', 'Reads the experiment light level from 0 to 100%.'],
    ['temperatureSensor', 'Temperature sensor', 'Measures the temperature set in the experiment.'],
    ['touchSensor', 'Bumper sensor', 'Detects a surface just in front of its contact tip.'],
    ['tiltSensor', 'Tilt sensor', 'Measures the angle between its top and gravity.'],
    ['encoderSensor', 'Wheel encoder', 'Measures wheel rotation in degrees.'],
  ],
  uz: [
    ['lineSensor', 'Chiziq sensori', 'Pastdagi qora tasmani ko‘radi. 0% = pol, 100% = chiziq.'],
    ['lightSensor', 'Yorug‘lik sensori', 'Tajribadagi yorug‘likni 0–100% oralig‘ida o‘lchaydi.'],
    ['temperatureSensor', 'Harorat sensori', 'Tajribada belgilangan haroratni o‘lchaydi.'],
    ['touchSensor', 'Tegish sensori', 'Oldidagi kontakt uchiga yaqin sirtni aniqlaydi.'],
    ['tiltSensor', 'Qiyalik sensori', 'Sensor tepasi va gravitatsiya orasidagi qiyalikni o‘lchaydi.'],
    ['encoderSensor', 'G‘ildirak enkoderi', 'G‘ildirak aylanishini graduslarda o‘lchaydi.'],
  ],
  ru: [
    ['lineSensor', 'Датчик линии', 'Смотрит вниз на чёрную ленту. 0% = пол, 100% = линия.'],
    ['lightSensor', 'Датчик света', 'Измеряет освещённость эксперимента от 0 до 100%.'],
    ['temperatureSensor', 'Датчик температуры', 'Измеряет заданную в эксперименте температуру.'],
    ['touchSensor', 'Датчик касания', 'Находит поверхность перед контактным наконечником.'],
    ['tiltSensor', 'Датчик наклона', 'Измеряет наклон относительно силы тяжести.'],
    ['encoderSensor', 'Энкодер колеса', 'Измеряет вращение колеса в градусах.'],
  ],
}

const lab = {
  en: {
    title: 'Sensor lab', live: 'LIVE', stopped: 'Press Run to measure', empty: 'Give your robot a new sense.', add: 'Explore sensors', ready: 'Circuit ready', needs: 'Check connections', wiring: 'Show wires', sensorPin: 'Sensor pin', graph: 'Last 12 seconds', environment: 'Experiment conditions', simulated: 'These sliders model the room. They do not read your computer’s sensors.', light: 'Light', temperature: 'Temperature', connectDistance: 'Connect the distance sensor: 5V, GND, TRIG and ECHO on separate pins.', connectSensor: 'No ready sensor on pin {pin}. Check power, ground and signal.', missing: 'Missing: {pins}', SIGNAL_CONFLICT: 'A signal pin is shared', BOARD_MISMATCH: 'Use the same board', WHEEL: 'Attach a wheel to this assembly', PHYSICS: 'Waiting for physics', ENVIRONMENT: 'Check the experiment conditions', transform: 'Position & rotation', units: '1 unit = 25.4 mm', copy: 'Copy part', move: 'Pick up', snap: 'Snap to holes', rotate: 'Rotate about {axis}', reverse: 'Reverse about {axis}', testProgram: 'Add a sensor experiment', added: 'Sensor experiment added to the top of your blocks.', experiment: 'Read → compare → light the LED', showCode: 'Open blocks', range: 'Range', sample: 'Value', noSignal: 'No reading', lineNote: 'Aim down at the painted ring; a raised or sideways module cannot see the floor.', touchNote: 'A short contact probe models a bumper switch.', encoderNote: 'Rotation is derived from wheel motion; it is not a hardware pulse simulation.', thermalNote: 'Change the room conditions and watch the graph.', tiltNote: 'Rotate the supporting plate, then Run.', angle: 'Quarter turns',
  },
  uz: {
    title: 'Sensor laboratoriyasi', live: 'JONLI', stopped: 'O‘lchash uchun Run bosing', empty: 'Robotingizga yangi sezgi bering.', add: 'Sensorlarni ko‘rish', ready: 'Sxema tayyor', needs: 'Ulanishlarni tekshiring', wiring: 'Simlarni ko‘rsatish', sensorPin: 'Sensor pini', graph: 'Oxirgi 12 soniya', environment: 'Tajriba sharoiti', simulated: 'Bu slayderlar xona sharoitini modellashtiradi. Kompyuteringiz sensorlarini o‘qimaydi.', light: 'Yorug‘lik', temperature: 'Harorat', connectDistance: 'Masofa sensorini ulang: 5V, GND, alohida pinlarga TRIG va ECHO.', connectSensor: '{pin}-pinda tayyor sensor yo‘q. Quvvat, yer va signalni tekshiring.', missing: 'Yetishmayapti: {pins}', SIGNAL_CONFLICT: 'Signal pini boshqa qurilmada ham ishlatilgan', BOARD_MISMATCH: 'Bitta plataga ulang', WHEEL: 'Shu yig‘maga g‘ildirak o‘rnating', PHYSICS: 'Fizika tayyorlanmoqda', ENVIRONMENT: 'Tajriba sharoitini tekshiring', transform: 'Joylashuv va burilish', units: '1 birlik = 25,4 mm', copy: 'Nusxa olish', move: 'Ko‘tarish', snap: 'Teshiklarga ilashtirish', rotate: '{axis} bo‘yicha burish', reverse: '{axis} bo‘yicha teskari burish', testProgram: 'Sensor tajribasini qo‘shish', added: 'Sensor tajribasi dastur boshiga qo‘shildi.', experiment: 'O‘qi → taqqosla → LEDni yoq', showCode: 'Bloklarni ochish', range: 'Oraliq', sample: 'Qiymat', noSignal: 'O‘lchov yo‘q', lineNote: 'Qora halqaga pastga qarating; baland yoki yon tomondagi modul polni ko‘rmaydi.', touchNote: 'Qisqa kontakt tekshiruvi bumper tugmasini modellashtiradi.', encoderNote: 'Aylanish g‘ildirak harakatidan hisoblanadi; apparat impulslarini modellashtirmaydi.', thermalNote: 'Xona sharoitini o‘zgartirib, grafikni kuzating.', tiltNote: 'Tagidagi plastinani burang, keyin Run bosing.', angle: '90° qadamlar',
  },
  ru: {
    title: 'Лаборатория датчиков', live: 'ОНЛАЙН', stopped: 'Нажми Run для измерения', empty: 'Дай роботу новое чувство.', add: 'Выбрать датчик', ready: 'Схема готова', needs: 'Проверь соединения', wiring: 'Показать провода', sensorPin: 'Пин датчика', graph: 'Последние 12 секунд', environment: 'Условия эксперимента', simulated: 'Ползунки моделируют комнату, а не считывают датчики компьютера.', light: 'Освещённость', temperature: 'Температура', connectDistance: 'Подключи датчик: 5V, GND, TRIG и ECHO к разным пинам.', connectSensor: 'На пине {pin} нет готового датчика. Проверь питание, землю и сигнал.', missing: 'Не хватает: {pins}', SIGNAL_CONFLICT: 'Сигнальный пин занят', BOARD_MISMATCH: 'Используй одну плату', WHEEL: 'Прикрепи колесо к этой сборке', PHYSICS: 'Ожидание физики', ENVIRONMENT: 'Проверь условия эксперимента', transform: 'Положение и поворот', units: '1 единица = 25,4 мм', copy: 'Копировать', move: 'Поднять', snap: 'Привязка к отверстиям', rotate: 'Повернуть по {axis}', reverse: 'Обратно по {axis}', testProgram: 'Добавить опыт с датчиком', added: 'Опыт с датчиком добавлен в начало программы.', experiment: 'Считай → сравни → зажги LED', showCode: 'Открыть блоки', range: 'Диапазон', sample: 'Значение', noSignal: 'Нет измерения', lineNote: 'Направь вниз на кольцо: высоко или боком датчик не видит пол.', touchNote: 'Короткий контактный луч моделирует концевой выключатель.', encoderNote: 'Угол рассчитан из движения колеса, без моделирования аппаратных импульсов.', thermalNote: 'Меняй условия комнаты и наблюдай график.', tiltNote: 'Поверни опорную пластину, затем нажми Run.', angle: 'Шаги по 90°',
  },
}

export const SENSOR_COPY = Object.fromEntries(['en', 'uz', 'ru'].map((locale) => [locale, {
  parts: Object.fromEntries(parts[locale].map(([kind, name, desc]) => [kind, { name, desc }])),
  lab: lab[locale],
  toasts: { placementOverlap: { en: 'Parts overlap. Move to a free position or align the mounting holes.', uz: 'Detallar ustma-ust tushdi. Bo‘sh joyga suring yoki ulash teshiklarini tekislang.', ru: 'Детали пересекаются. Выбери свободное место или совмести отверстия.' }[locale] },
  blocks: { srcSensor: { en: 'Sensor on pin', uz: 'Pindagi sensor', ru: 'Датчик на пине' }[locale] },
}]))
