(() => {
  'use strict';

  const signs = ['Овен', 'Телец', 'Близнецы', 'Рак', 'Лев', 'Дева', 'Весы', 'Скорпион', 'Стрелец', 'Козерог', 'Водолей', 'Рыбы'];
  const glyphs = [...'♈♉♊♋♌♍♎♏♐♑♒♓'];
  const sampleOffset = 24 * 60 + 13;
  const maxMistakes = 3;
  const kailashSteps = [
    { title: 'Что такое эклиптика?', play: traceSun },
    { title: 'Собери зодиак', play: buildWheel },
    { title: 'Знак и созвездие', prompt: 'На карте неба ты видишь созвездие Льва. А что такое знак Льва на зодиакальном круге?', choices: ['Группа звёзд, образующая фигуру Льва.', 'Участок зодиакального круга шириной 30°.', 'Точка, в которой сейчас находится Солнце.'], answer: 1, hint: 'Вспомни размер каждого сектора на круге, который ты собрал.', explanation: 'Созвездие — область звёздного неба. Знак Льва, как и каждый из 12 знаков, занимает ровно 30° зодиакального круга.' },
    { title: 'Настрой два кольца', play: calibrate },
    { title: 'Две записи об одной грахе', prompt: 'На приборе с айанамшей 24°13′ наблюдатели записали «10° Овна» и «15°47′ Рыб». Граха и момент наблюдения одни и те же. Почему обе записи верны?', choices: ['Один наблюдатель отсчитывал градусы внутри знака, другой — по всему кругу.', 'Один записал долготу, другой — расстояние до соседней грахи.', 'Один использовал тропическую шкалу, другой — сидерическую.'], answer: 2, hint: 'Вспомни, что именно вращалось на приборе. Где стояла сама граха?', explanation: 'Начала шкал разнесены на 24°13′. Граха остаётся в одной точке, а показания меняются.' },
    { title: 'Старая запись наблюдателя', prompt: 'Бхригу открыл журнал, составленный несколько веков назад. Какую айанамшу Лахири использовать, чтобы пересчитать старую запись?', choices: ['Значение на дату записи.', 'Сегодняшнее значение: оно постоянно.', 'Отдельное значение для каждой грахи.'], answer: 0, hint: 'Вспомни, почему точки отсчёта постепенно расходятся.', explanation: 'Из-за прецессии точка равноденствия смещается относительно звёзд. Айанамшу берут на дату наблюдения.' },
    { title: 'Поставь Гуру на круг', play: placeGuru },
    { title: 'Перейди границу знака', play: crossBoundary },
    { title: 'Две минуты для Луны', prompt: 'Луна прошла вперёд на 2′ от 29°59′ Рыб. Какая отметка будет на приборе?', choices: ['0°00′ Овна', '0°02′ Овна', '0°01′ Овна'], answer: 2, hint: 'Первая минута доводит Луну до границы. Где она окажется после второй?', explanation: 'Первая минута — 0°00′ Овна. Вторая — 0°01′ Овна.' },
    { title: 'Журнал · запись о Шани', prompt: 'В журнале написано: «Шани в 17° Скорпиона. Долгота — 217°». Нажми на число, чтобы исправить запись.', choices: ['197°', '227°', '237°'], answer: 1, edit: 'Шани в 17° Скорпиона. Долгота —', original: '217°', hint: 'Начало Скорпиона — 210°. От него отсчитай ещё 17°.', explanation: 'Семь полных знаков дают 210°. Ещё 17° внутри Скорпиона — долгота 227°.' },
    { title: 'Журнал · запись о лагне', play: placeHouse },
    { title: 'Журнал · перепутанные записи', play: reconcileRecords },
  ];

  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
  }

  function button(text, action, primary = false) {
    const node = element('button', 'btn ' + (primary ? 'btn-primary' : 'btn-secondary'), text);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  }

  const svgNS = 'http://www.w3.org/2000/svg';
  function svg(tag, attributes) {
    const node = document.createElementNS(svgNS, tag);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    return node;
  }

  function point(degrees, radius) {
    const radians = degrees * Math.PI / 180;
    return [180 + radius * Math.sin(radians), 180 - radius * Math.cos(radians)];
  }

  function arc(from, to, radius) {
    return 'M ' + point(from, radius).join(' ') + ' A ' + radius + ' ' + radius + ' 0 ' + (to - from > 180 ? 1 : 0) + ' 1 ' + point(to, radius).join(' ');
  }

  function marker(wheel, angle, radius, text, className = 'wheel-marker') {
    const [x, y] = point(angle, radius);
    const node = svg('text', { x, y, class: className });
    node.textContent = text;
    wheel.append(node);
    return node;
  }

  function dial() {
    return svg('svg', { viewBox: '0 0 360 360', class: 'lesson-wheel', 'aria-hidden': 'true' });
  }

  function scale(wheel, radius, offset = 0, labels = true) {
    wheel.append(svg('circle', { cx: 180, cy: 180, r: radius, class: 'wheel-rim' }));
    for (let i = 0; i < 12; i++) {
      const [x1, y1] = point(i * 30 + offset, radius);
      const [x2, y2] = point(i * 30 + offset, radius - 12);
      wheel.append(svg('line', { x1, y1, x2, y2, class: 'wheel-tick' }));
      if (labels) marker(wheel, i * 30 + offset + 15, radius - 25, glyphs[i], 'wheel-sign');
    }
  }

  function controls() {
    return element('div', 'lesson-controls', '');
  }

  function choiceButtons(options, select) {
    const group = controls();
    options.forEach((label, i) => {
      const item = button(label, () => select(i, item));
      item.setAttribute('aria-pressed', 'false');
      group.append(item);
    });
    return group;
  }

  function choose(group, item) {
    for (const node of group.children) node.setAttribute('aria-pressed', String(node === item));
  }

  function question(step, ui) {
    ui.board.append(element('p', 'lesson-prompt', step.prompt));
    let record;
    const group = choiceButtons(step.choices, (i, item) => {
      choose(group, item);
      if (record) record.textContent = step.choices[i];
      if (i === step.answer) ui.success(step.explanation);
      else ui.mistake(step.hint);
    });
    group.classList.add('lesson-answer-list');
    if (step.edit) {
      const line = element('div', 'lesson-record', step.edit + ' ');
      record = button(step.original, () => {
        group.hidden = false;
        group.firstElementChild.focus();
      });
      line.append(record);
      ui.board.append(line);
      group.hidden = true;
    }
    ui.board.append(group);
  }

  function traceSun(ui) {
    const prompt = element('p', 'lesson-prompt', 'В журнале Бхригу три записи. Какая поможет построить эклиптику?');
    ui.board.append(prompt);
    const options = [
      'Следить за Солнцем от восхода до заката.',
      'Отмечать положение Луны среди звёзд каждый месяц.',
      'Отмечать положение Солнца на фоне звёзд в течение года.',
    ];
    const observations = choiceButtons(options, (i, item) => {
      choose(observations, item);
      if (i !== 2) {
        ui.mistake(i === 0 ? 'Так ты увидишь суточный путь Солнца. Нам нужны наблюдения за целый год.' : 'Это позволит проследить Луну. Какое светило задаёт эклиптику?');
        return;
      }

      observations.remove();
      prompt.textContent = 'На карте остались отметки Солнца за четыре сезона. Как их соединить, чтобы восстановить его годовой путь?';
      const wheel = dial();
      for (const angle of [0, 90, 180, 270]) marker(wheel, angle, 106, '●');
      ui.board.append(wheel);
      const paths = [
        svg('path', { d: arc(0, 90, 106), class: 'wheel-highlight' }),
        svg('circle', { cx: 180, cy: 180, r: 106, class: 'wheel-highlight' }),
        svg('path', { d: 'M 180 74 L 286 180 L 180 286 L 74 180 Z', class: 'wheel-highlight' }),
      ];
      const choices = choiceButtons(['Дугой от весны до лета', 'Кругом через все четыре отметки', 'Прямыми отрезками от сезона к сезону'], (choice, answer) => {
        choose(choices, answer);
        paths.forEach(path => path.remove());
        wheel.prepend(paths[choice]);
        if (choice === 1) ui.success('Эклиптика — полный круг видимого годового пути Солнца на небесной сфере.');
        else ui.mistake(choice === 0 ? 'Дуга показывает лишь часть года. Включи остальные сезоны.' : 'Отметки — отдельные наблюдения. Между ними Солнце продолжает видимое движение по окружности.');
      });
      choices.classList.add('lesson-answer-list');
      ui.board.append(choices);
      ui.note('');
      choices.firstElementChild.focus();
    });
    observations.classList.add('lesson-answer-list');
    ui.board.append(observations);
  }

  function buildWheel(ui) {
    ui.board.append(element('p', 'lesson-prompt', 'Отсчёт начинается с Овна. Поставь оставшиеся знаки по порядку. Каждый сектор занимает 30°.'));
    const wheel = dial();
    scale(wheel, 150, 0, false);
    const slots = signs.map((_, i) => marker(wheel, i * 30 + 15, 122, '·', 'wheel-sign'));
    const label = marker(wheel, 0, 0, '', 'wheel-caption');
    let index = 0;
    function place() {
      slots[index].textContent = glyphs[index];
      slots[index].classList.add('wheel-filled');
      index++;
      label.textContent = (index * 30) + '° / 360°';
    }
    place(); place(); place();
    ui.board.append(wheel);
    const prompt = element('p', 'lesson-reading', 'Заполни сектор 90°–120°');
    ui.board.append(prompt);
    const pool = [8, 4, 10, 6, 3, 9, 5, 11, 7];
    const options = choiceButtons(pool.map(i => glyphs[i] + ' ' + signs[i]), (choice, item) => {
      if (pool[choice] !== index) {
        ui.mistake('Посмотри, какой знак стоит перед пустым сектором, и попробуй ещё раз.');
        return;
      }
      place();
      item.disabled = true;
      if (index === signs.length) {
        prompt.textContent = 'Круг собран';
        ui.success('Двенадцать секторов по 30° образуют круг в 360°.');
      } else {
        prompt.textContent = 'Заполни сектор ' + index * 30 + '°–' + (index + 1) * 30 + '°';
        ui.note('Сектор на месте.');
        [...options.children].find(node => !node.disabled)?.focus();
      }
    });
    ui.board.append(options);
  }

  function calibrate(ui) {
    let minutes = 0;
    let precision = false;
    const prompt = element('p', 'lesson-prompt', 'Поверни внутреннее кольцо по ходу знаков. Совмести начало Весов на нём со светящейся отметкой Читры.');
    const wheel = dial();
    scale(wheel, 155);
    const inner = svg('g', { class: 'wheel-inner' });
    scale(inner, 112);
    marker(inner, 0, 104, '●');
    marker(inner, 180, 104, '◆');
    wheel.append(inner);
    marker(wheel, 0, 158, '▲');
    marker(wheel, 180 + sampleOffset / 60, 133, '✦');
    marker(wheel, 0, 0, 'Лахири', 'wheel-caption');
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.max = 45;
    slider.step = 1;
    slider.value = 0;
    slider.setAttribute('aria-label', 'Поворот внутреннего кольца в градусах');
    const reading = element('output', 'lesson-reading', '');
    const feedback = controls();
    const minus = button('−1′', () => update(minutes - 1));
    const plus = button('+1′', () => update(minutes + 1));
    const minuteSlider = document.createElement('input');
    minuteSlider.type = 'range';
    minuteSlider.min = 0;
    minuteSlider.max = 59;
    minuteSlider.step = 1;
    minuteSlider.setAttribute('aria-label', 'Минуты поворота внутреннего кольца');
    const fineControls = element('div', 'lesson-fine-controls', '');
    const minuteLabel = element('label', '', 'Минуты внутри градуса');
    minuteLabel.append(minuteSlider);
    fineControls.append(minuteLabel, minus, plus);
    fineControls.hidden = true;
    function formatted(value) {
      return Math.floor(value / 60) + '°' + String(value % 60).padStart(2, '0') + '′';
    }
    function update(value) {
      minutes = Math.max(0, Math.min(2700, Math.round(value)));
      slider.value = Math.floor(minutes / 60);
      minuteSlider.value = minutes % 60;
      inner.setAttribute('transform', 'rotate(' + minutes / 60 + ' 180 180)');
      reading.value = 'Дуга между нулями · ' + formatted(minutes);
    }
    const check = button('Проверить настройку', () => {
      if (!precision) {
        if (Math.abs(minutes - sampleOffset) > 60) {
          ui.mistake('Поверни внутренний ромб ◆ к звезде ✦. В первом раунде достаточно точности до градуса.');
          return;
        }
        precision = true;
        prompt.textContent = 'По журналу Бхригу учебная айанамша Лахири — 24°13′. Доведи прибор до этой отметки кнопками −1′ и +1′.';
        fineControls.hidden = false;
        ui.note('Кольца почти совмещены. Теперь нужна точность до минуты.');
        return;
      }
      if (minutes !== sampleOffset) {
        ui.mistake(minutes < sampleOffset ? 'Добавь ещё несколько минут.' : 'Уменьши угол на несколько минут.');
        return;
      }
      ui.success('Прибор настроен. Айанамша — угловой разрыв между двумя нулями Овна. Прецессия постепенно меняет этот разрыв.');
    }, true);
    slider.addEventListener('input', () => update(Number(slider.value) * 60 + minutes % 60));
    minuteSlider.addEventListener('input', () => update(Math.floor(minutes / 60) * 60 + Number(minuteSlider.value)));
    // Drag the ring directly; the slider and minute buttons offer the same controls.
    let dragStart = null;
    function pointerAngle(event) {
      const box = wheel.getBoundingClientRect();
      const x = event.clientX - box.left - box.width / 2;
      const y = event.clientY - box.top - box.height / 2;
      return Math.atan2(x, -y) * 180 / Math.PI;
    }
    wheel.classList.add('lesson-wheel-draggable');
    wheel.addEventListener('pointerdown', event => {
      if (!event.isPrimary) return;
      dragStart = { id: event.pointerId, angle: pointerAngle(event), minutes };
      wheel.setPointerCapture(event.pointerId);
    });
    wheel.addEventListener('pointermove', event => {
      if (dragStart?.id !== event.pointerId) return;
      const change = (pointerAngle(event) - dragStart.angle + 540) % 360 - 180;
      const angle = dragStart.minutes / 60 + change;
      update((precision ? angle : Math.round(angle)) * 60);
    });
    wheel.addEventListener('lostpointercapture', event => {
      if (dragStart?.id === event.pointerId) dragStart = null;
    });
    feedback.append(check);
    update(0);
    ui.board.append(prompt, wheel, element('p', 'lesson-reading', 'Внешнее кольцо — тропическое · внутреннее — сидерическое'), slider, fineControls, reading, feedback);
  }

  function placeGuru(ui) {
    ui.board.append(element('p', 'lesson-prompt', 'Гуру стоит в 15° Льва. Передвинь его на нужную долготу, считая от 0° Овна.'));
    const wheel = dial();
    scale(wheel, 150);
    const guru = marker(wheel, 0, 94, '♃');
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.max = 359;
    slider.value = 0;
    slider.setAttribute('aria-label', 'Долгота Гуру в градусах');
    const reading = element('output', 'lesson-reading', '0°');
    function move() {
      const angle = Number(slider.value);
      const [x, y] = point(angle, 94);
      guru.setAttribute('x', x);
      guru.setAttribute('y', y);
      reading.value = angle + '°';
    }
    slider.addEventListener('input', move);
    const bar = controls();
    for (const delta of [-1, 1]) bar.append(button(delta < 0 ? '−1°' : '+1°', () => {
      slider.value = Number(slider.value) + delta;
      move();
    }));
    bar.append(button('Поставить Гуру', () => {
      if (Number(slider.value) === 135) ui.success('Гуру на месте. До начала Льва — 120°, внутри него ещё 15°.');
      else ui.mistake('До Льва четыре полных сектора по 30°. Затем отсчитай ещё 15°.');
    }, true));
    ui.board.append(wheel, slider, reading, bar);
  }

  function crossBoundary(ui) {
    ui.board.append(element('p', 'lesson-prompt', 'Первая запись: Мангала в 29°56′ Овна. Во второй записи он уже в 0°03′ Тельца. Сколько угловых минут он прошёл вперёд между наблюдениями?'));
    const form = element('form', 'lesson-controls', '');
    const label = element('label', 'lesson-minute-answer', 'Сколько минут?');
    const input = document.createElement('input');
    input.type = 'number';
    input.inputMode = 'numeric';
    input.min = 1;
    input.step = 1;
    input.required = true;
    label.append(input);
    const check = element('button', 'btn btn-primary', 'Сверить записи');
    check.type = 'submit';
    form.append(label, check);

    form.addEventListener('submit', event => {
      event.preventDefault();
      const answer = input.valueAsNumber;
      if (answer !== 7) {
        ui.mistake('Считай отрезки отдельно: сколько минут осталось до 0°00′ Тельца и сколько Мангала прошёл после границы?');
        return;
      }
      const timeline = element('div', 'lesson-boundary lesson-boundary-result', '');
      for (const label of ['29°56′ Овна', '+4′ → 0°00′ Тельца', '+3′ → 0°03′ Тельца']) {
        timeline.append(element('span', '', label));
      }
      ui.board.append(timeline);
      ui.success('До границы — 4′, после неё — ещё 3′. Мангала прошёл 7′. В Тельце отсчёт градусов внутри знака начался с нуля.');
    });
    ui.board.append(form);
  }

  function placeHouse(ui) {
    ui.board.append(element('p', 'lesson-prompt', 'Лагна на отметке 105° от начала Овна. Найди, между какими делениями лежит эта точка, и перетащи фишку I в нужный сектор. Здесь используем систему целых знаков.'));
    const wheel = dial();
    scale(wheel, 150);
    for (let i = 0; i < signs.length; i++) marker(wheel, i * 30, 165, i * 30 + '°', 'wheel-degree');
    wheel.classList.add('lesson-wheel-draggable');
    const token = svg('g', { class: 'wheel-house-token' });
    token.append(svg('circle', { cx: 0, cy: 0, r: 19 }));
    const number = svg('text', { x: 0, y: 0, class: 'wheel-caption' });
    number.textContent = 'I';
    token.append(number);
    wheel.append(token);

    const reading = element('output', 'lesson-reading', '');
    let selected = 0;
    let activePointer = null;

    function placeToken(x, y) {
      token.setAttribute('transform', 'translate(' + x + ' ' + y + ')');
    }
    function placeInSector(index) {
      selected = (index + signs.length) % signs.length;
      placeToken(...point(selected * 30 + 15, 91));
      reading.value = 'Первый дом · ' + signs[selected];
    }
    function pointerPosition(event) {
      const cursor = wheel.createSVGPoint();
      cursor.x = event.clientX;
      cursor.y = event.clientY;
      return cursor.matrixTransform(wheel.getScreenCTM().inverse());
    }
    token.addEventListener('pointerdown', event => {
      if (!event.isPrimary) return;
      activePointer = event.pointerId;
      token.setPointerCapture(activePointer);
    });
    token.addEventListener('pointermove', event => {
      if (event.pointerId !== activePointer) return;
      const cursor = pointerPosition(event);
      placeToken(cursor.x, cursor.y);
    });
    token.addEventListener('pointerup', event => {
      if (event.pointerId !== activePointer) return;
      const cursor = pointerPosition(event);
      const x = cursor.x - 180;
      const y = cursor.y - 180;
      const distance = Math.hypot(x, y);
      const angle = (Math.atan2(x, -y) * 180 / Math.PI + 360) % 360;
      placeInSector(distance >= 25 && distance <= 158 ? Math.floor(angle / 30) : selected);
      activePointer = null;
    });
    token.addEventListener('lostpointercapture', () => {
      if (activePointer === null) return;
      activePointer = null;
      placeInSector(selected);
    });

    const bar = controls();
    bar.append(button('← Сектор', () => placeInSector(selected - 1)), button('Сектор →', () => placeInSector(selected + 1)), button('Проверить', () => {
      if (selected === 3) ui.success('105° лежат между 90° и 120°. Это Рак. В системе целых знаков весь восходящий знак становится первым домом.');
      else ui.mistake('Сравни 105° с делениями по краям выбранного сектора. Лагна должна находиться внутри него.');
    }, true));
    placeInSector(0);
    ui.board.append(wheel, reading, bar);
  }

  function reconcileRecords(ui) {
    ui.board.append(element('p', 'lesson-prompt', 'Бхригу отметил Луну на долготе 35° от тропического нуля. Айанамша Лахири в этом примере — 24°13′. Две записи верны, а в третьей наблюдатель ошибся на градус.'));
    ui.board.append(element('p', 'lesson-journal-instruction', 'Выбери запись, затем нажми на ячейку. Чтобы переставить запись, выбери её снова.'));

    const records = ['11°47′ Овна', '5°00′ Тельца', '10°47′ Овна'];
    const categories = ['Тропическая шкала', 'Сидерическая шкала', 'Ошибка в журнале'];
    const assignments = [null, null, null];
    let selected = null;

    const cards = choiceButtons(records, (index, card) => {
      selected = index;
      choose(cards, card);
    });
    cards.classList.add('lesson-journal-cards');

    const grid = element('div', 'lesson-journal-grid', '');
    const slots = categories.map((category, index) => {
      const slot = button('', () => {
        if (selected === null) {
          ui.note('Сначала выбери одну из трёх записей наверху.');
          return;
        }
        const previous = assignments.indexOf(selected);
        if (previous !== -1) assignments[previous] = null;
        assignments[index] = selected;
        selected = null;
        choose(cards, null);
        refresh();
        ui.note('');
      });
      const value = element('span', '', '');
      slot.append(element('strong', '', category), value);
      grid.append(slot);
      return { slot, value };
    });

    function refresh() {
      slots.forEach(({ slot, value }, index) => {
        const assigned = assignments[index];
        value.textContent = assigned === null ? 'Положить запись' : records[assigned];
        slot.classList.toggle('lesson-journal-filled', assigned !== null);
      });
    }

    const check = button('Сверить журнал', () => {
      if (assignments.includes(null)) {
        ui.note('Заполни все три ячейки.');
        return;
      }
      if (assignments[0] !== 1) {
        ui.mistake('От тропического нуля первые 30° занимает Овен. В какой знак попадёт Луна на отметке 35°?');
        return;
      }
      if (assignments[1] !== 2) {
        ui.mistake('Из 35°00′ вычти 24°13′. Чтобы вычесть минуты, запиши 35°00′ как 34°60′.');
        return;
      }
      ui.success('По тропической шкале 35° — это 5° Тельца. После вычитания 24°13′ остаётся 10°47′ Овна. В третью запись добавили лишний градус.');
    }, true);

    refresh();
    ui.board.append(cards, grid, check);
  }

  function create({ steps, location, listTitle, finishTitle, finishText }) {
    function validProgress(value) {
      return Number.isInteger(value) && value >= 0 && value <= steps.length ? value : 0;
    }

    const createTaskList = function ({ progress, completed, onSelect, open, preview = false }) {
      const available = completed ? steps.length : validProgress(progress);
      const panel = element('details', 'kailash-tasks', '');
      panel.open = open;
      panel.append(element('summary', 'kailash-tasks-title', listTitle));
      const content = element('div', 'kailash-tasks-content', '');
      const list = element('ol', 'lesson-task-list', '');
      steps.forEach((step, index) => {
        const item = element('li', '', '');
        const done = index < available;
        const next = index === available;
        const status = done ? 'Пройдено' : next ? 'Текущее' : preview ? 'Пробное' : 'Закрыто';
        const entry = button('', () => onSelect(index, !next, true), next);
        entry.disabled = !done && !next && !preview;
        entry.append(element('strong', '', (index + 1) + '. ' + step.title), element('span', 'lesson-task-status', status));
        item.append(entry);
        list.append(item);
      });
      if (available < steps.length) {
        const label = available === 0 ? 'Пройти урок по порядку' : 'Продолжить урок по порядку';
        content.append(button(label, () => onSelect(available, false), true));
      }
      if (available === steps.length && !completed) content.append(button('Завершить урок', () => onSelect(available, false), true));
      content.append(list);
      panel.append(content);
      return panel;
    };

    const render = function (root, { onTasks, onFinish, onProgress, startAt, practice, returnToList }) {
      let index = validProgress(startAt);
      function render(notice = '') {
        const page = element('section', 'kailash-lesson', '');
        const header = element('div', 'lesson-top', '');
        header.append(button('← К заданиям', onTasks), element('span', 'lesson-kicker', location));
        const stage = steps[index];
        const heading = element('h1', 'lesson-heading', stage ? stage.title : finishTitle);
        heading.tabIndex = -1;
        const card = element('div', 'lesson-card', '');
        page.append(header, heading, card);
        root.replaceChildren(page);
        if (!stage) {
          card.append(element('p', 'lesson-prompt', finishText), button('Завершить урок', onFinish, true));
        } else {
          let mistakes = 0;
          const tools = element('div', 'lesson-attempts', '');
          const counter = element('span', '', 'Ошибки: 0 из ' + maxMistakes);
          tools.append(counter, button('Начать задание заново', () => render('Задание начато заново.')));
          const progress = document.createElement('progress');
          progress.max = steps.length;
          progress.value = index + 1;
          progress.setAttribute('aria-label', 'Ход испытания');
          card.append(element('p', 'lesson-kicker', (index + 1) + ' / ' + steps.length), progress, tools);
          const board = element('div', 'lesson-board', '');
          const status = element('p', 'lesson-feedback', '');
          status.setAttribute('role', 'status');
          const resetNotice = element('p', 'lesson-feedback', notice);
          resetNotice.hidden = !notice;
          if (notice) heading.setAttribute('aria-describedby', 'lesson-reset-notice');
          resetNotice.id = 'lesson-reset-notice';
          card.append(resetNotice);
          const canFinish = index === steps.length - 1 && !practice;
          const nextLabel = canFinish ? 'Завершить урок' : returnToList ? 'К заданиям' : 'Далее';
          const next = button(nextLabel, () => {
            if (canFinish) {
              onFinish();
              return;
            }
            if (!practice) {
              index++;
              onProgress(index);
            }
            if (returnToList) onTasks();
            else render();
          }, true);
          next.hidden = true;
          card.append(board, status, next);
          function feedback(message) {
            resetNotice.hidden = true;
            status.textContent = message;
            status.classList.remove('lesson-correct');
          }
          const ui = {
            board,
            note: feedback,
            mistake(message) {
              mistakes++;
              if (mistakes === maxMistakes) {
                render('Три неверных ответа. Задание начинается заново. ' + message);
                return;
              }
              counter.textContent = 'Ошибки: ' + mistakes + ' из ' + maxMistakes;
              feedback(message + ' До сброса: ' + (maxMistakes - mistakes) + '.');
            },
            success(message) {
              feedback(message);
              status.classList.add('lesson-correct');
              board.inert = true;
              next.hidden = false;
              next.focus({ preventScroll: true });
            },
          };
          if (stage.play) stage.play(ui);
          else question(stage, ui);
        }
        heading.focus({ preventScroll: true });
        window.scrollTo(0, 0);
      }
      render();
    };
    return { createTaskList, render };
  }

  window.MokshaLessons = { create, element, button, choiceButtons, choose };
  window.kailashLesson = create({
    steps: kailashSteps,
    location: 'Кайлас · урок 1',
    listTitle: 'Задания Бхригу',
    finishTitle: 'Небесный прибор восстановлен',
    finishText: 'Ты собрал зодиакальный круг, настроил две шкалы и исправил записи наблюдателя. Возвращайся к Шиве.',
  });
})();
