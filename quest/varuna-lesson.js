(() => {
  'use strict';

  const { create, element, button, choiceButtons, choose } = window.MokshaLessons;
  const signs = ['Овен', 'Телец', 'Близнецы', 'Рак', 'Лев', 'Дева', 'Весы', 'Скорпион', 'Стрелец', 'Козерог', 'Водолей', 'Рыбы'];
  const rulerGlyphs = { Сурья: '☉', Чандра: '☽', Буддха: '☿', Шукра: '♀', Мангала: '♂', Гуру: '♃', Шани: '♄' };
  const elements = ['Огонь', 'Земля', 'Воздух', 'Вода'];
  const modes = ['Подвижный', 'Неподвижный', 'Двойственный'];
  const matrix = [['Овен', 'Лев', 'Стрелец'], ['Козерог', 'Телец', 'Дева'], ['Весы', 'Водолей', 'Близнецы'], ['Рак', 'Скорпион', 'Рыбы']];

  function stages(taskList) {
    return { play(ui) {
      let round = 0;
      function show() {
        ui.board.replaceChildren();
        ui.board.append(element('p', 'lesson-kicker', 'Раунд ' + (round + 1) + ' из ' + taskList.length));
        taskList[round]({
          ...ui,
          success(message) {
            if (round === taskList.length - 1) {
              ui.success(message);
              return;
            }
            [...ui.board.children].forEach(node => { node.inert = true; });
            ui.note(message);
            const next = button('Следующий раунд', () => { round++; ui.note(''); show(); }, true);
            ui.board.append(next);
            next.focus({ preventScroll: true });
          },
        });
      }
      show();
    } };
  }

  function explain(ui, text) {
    ui.board.append(element('p', 'lesson-prompt', text));
  }

  function quiz({ prompt, choices, answer, hint, explanation }) {
    return ui => {
      explain(ui, prompt);
      const group = choiceButtons(choices, (index, item) => {
        choose(group, item);
        if (index === answer) ui.success(explanation);
        else ui.mistake(hint);
      });
      group.classList.add('lesson-answer-list');
      ui.board.append(group);
    };
  }

  function assignments(ui, { prompt, options, targets, initial = [], hint, explanation, renderTargets, icon = value => value }) {
    explain(ui, prompt);
    ui.board.append(element('p', 'varuna-instruction', 'Выбери жетон, затем его ячейку. Жетоны можно переставлять до проверки.'));
    const values = targets.map((_, index) => initial[index] ?? null);
    let selected = null;
    const indicators = [];
    const cards = choiceButtons(options, (index, item) => {
      selected = options[index];
      choose(cards, item);
    });
    cards.classList.add('varuna-chips');
    const appearances = targets.map((target, index) => {
      const value = element('span', 'varuna-slot-value', '');
      const targetButton = button('', () => {
        if (selected === null) {
          ui.note('Сначала выбери жетон.');
          return;
        }
        const previous = values.indexOf(selected);
        if (previous !== -1) values[previous] = values[index];
        values[index] = selected;
        choose(cards, null);
        selected = null;
        update();
        ui.note('');
      });
      targetButton.classList.add('varuna-slot');
      targetButton.append(element('strong', '', target.short ?? target.label), value);
      indicators.push({ button: targetButton, value, label: target.label });
      return targetButton;
    });
    function update() {
      indicators.forEach((cell, i) => {
        const value = values[i];
        cell.value.textContent = value === null ? '＋' : icon(value);
        cell.button.setAttribute('aria-label', cell.label + ': ' + (value ?? 'пусто'));
        cell.button.classList.toggle('has-value', value !== null);
      });
      [...cards.children].forEach((card, i) => card.classList.toggle('is-assigned', values.includes(options[i])));
    }
    const check = button('Проверить', () => {
      if (values.includes(null)) {
        ui.note('Сначала заполни все ячейки.');
        return;
      }
      const wrong = targets.findIndex((target, i) => target.answer !== values[i]);
      if (wrong !== -1) ui.mistake(typeof hint === 'function' ? hint(wrong) : hint);
      else ui.success(explanation);
    }, true);
    update();
    ui.board.append(cards, renderTargets ? renderTargets(appearances) : slotStack(appearances), check);
  }

  function slotStack(slots) {
    const grid = element('div', 'varuna-slots', '');
    grid.append(...slots);
    return grid;
  }

  function seals({ prompt, pools, answers, hint, explanation }) {
    return ui => {
      explain(ui, prompt);
      const form = element('form', 'varuna-seals', '');
      const labels = ['Стихия', 'Цель жизни', 'Социальная функция'];
      const fields = pools.map((options, i) => {
        const label = element('label', '', labels[i]);
        const select = element('select', '', '');
        select.append(element('option', '', 'Выбери'));
        select.options[0].value = '';
        options.forEach(value => select.append(element('option', '', value)));
        label.append(select);
        form.append(label);
        return select;
      });
      const check = element('button', 'btn btn-primary', 'Собрать печать');
      check.type = 'submit';
      form.append(check);
      form.addEventListener('submit', event => {
        event.preventDefault();
        if (fields.some(field => !field.value)) ui.note('Выбери все три части печати.');
        else if (answers.every((value, i) => fields[i].value === value)) ui.success(explanation);
        else ui.mistake(hint);
      });
      ui.board.append(form);
    };
  }

  const sealPools = [elements, ['Кама', 'Мокша', 'Артха', 'Дхарма'], ['Вайшьи', 'Шудры', 'Брахманы', 'Кшатрии']];
  const sealRounds = [
    seals({ prompt: 'Поселение готовится к зиме. Жители рассчитывают запасы, устраивают хранилища и налаживают снабжение. Собери печать для этой деятельности.', pools: sealPools, answers: ['Земля', 'Артха', 'Вайшьи'], hint: 'Что здесь делает община: создаёт и распределяет ресурсы или берёт на себя защиту?', explanation: 'Земля → артха → вайшьи. Здесь главное — материальные ресурсы и хозяйство.' }),
    seals({ prompt: 'Те же жители распределяют дозоры, договариваются об общем порядке и берут на себя защиту поселения. Собери новую печать.', pools: sealPools, answers: ['Огонь', 'Дхарма', 'Кшатрии'], hint: 'Сюжет по-прежнему о поселении. Определи цель по тому, какую ответственность взяли жители.', explanation: 'Огонь → дхарма → кшатрии. В схеме лекции это защита и ответственность за общий порядок.' }),
    seals({ prompt: 'На побережье назначили общий праздник. Жители знакомятся, приглашают соседей, договариваются, кто чем поможет, и делятся историями. Собери печать для этой деятельности.', pools: sealPools, answers: ['Воздух', 'Кама', 'Шудры'], hint: 'Здесь в центре общение, обмен и участие в общей жизни. Какая стихия отвечает за эти связи?', explanation: 'Воздух → кама → шудры. В модели лекции здесь важны взаимодействие, обмен и практическое участие.' }),
    seals({ prompt: 'После праздника жители приходят к Варуне за наставлением. Они ищут внутреннюю ясность и хотят понять, от каких привязанностей им пора освободиться. Собери печать.', pools: sealPools, answers: ['Вода', 'Мокша', 'Брахманы'], hint: 'Задача связана с внутренним опытом и освобождением. Какая цепочка из лекции описывает этот путь?', explanation: 'Вода → мокша → брахманы. Эта печать связывает созерцание и познание с освобождением.' }),
  ];

  function matrixRound(entries, options, initial) {
    return ui => {
      const targets = entries.map(([row, col]) => ({ label: elements[row] + ' · ' + modes[col], answer: matrix[row][col] }));
      assignments(ui, {
        prompt: initial ? 'Телец и Козерог перепутаны. Исправь их места и восстанови недостающий земной знак.' : 'Заполни пробелы. Для каждой ячейки учти и стихию, и качество движения.',
        options, targets, initial,
        hint: index => 'Перепроверь сочетание «' + targets[index].label + '». Одной стихии здесь недостаточно.',
        explanation: initial ? 'Козерог — подвижная земля, Телец — неподвижная, Дева — двойственная.' : 'Четыре стихии и три качества дают двенадцать разных сочетаний.',
        renderTargets(slots) {
          const table = element('div', 'varuna-matrix', '');
          table.append(element('span', '', ''), ...modes.map(mode => element('strong', 'matrix-heading', mode)));
          matrix.forEach((row, y) => {
            table.append(element('strong', 'matrix-heading', elements[y]));
            row.forEach((sign, x) => {
              const index = entries.findIndex(([r, c]) => r === y && c === x);
              table.append(index === -1 ? element('span', 'matrix-known', sign) : slots[index]);
            });
          });
          return table;
        },
      });
    };
  }

  const rulerPairs = [
    { signs: [2, 5], ruler: 'Буддха' },
    { signs: [1, 6], ruler: 'Шукра' },
    { signs: [0, 7], ruler: 'Мангала' },
    { signs: [11, 8], ruler: 'Гуру' },
    { signs: [10, 9], ruler: 'Шани' },
  ];

  function rulerWheel(makeCell) {
    const wheel = element('div', 'varuna-ruler-wheel', '');
    wheel.append(element('span', 'varuna-wheel-axis', ''));
    const center = element('div', 'varuna-wheel-legend', '');
    center.append(element('span', '', 'Лунная сторона'), element('span', '', 'Солнечная сторона'));
    wheel.append(center);
    signs.forEach((name, index) => {
      const angle = (index - 3.5) * Math.PI / 6;
      const cell = makeCell(name, index);
      cell.style.left = (50 + 40 * Math.sin(angle)) + '%';
      cell.style.top = (50 - 42 * Math.cos(angle)) + '%';
      wheel.append(cell);
    });
    return wheel;
  }

  function placeLuminaries(ui) {
    assignments(ui, {
      prompt: 'Круг начинается с двух светил. Поставь Чандру и Сурью в их исходные обители по разные стороны верхней оси.',
      options: ['Сурья', 'Чандра'],
      targets: [{ label: 'Рак', answer: 'Чандра' }, { label: 'Лев', answer: 'Сурья' }],
      icon: value => rulerGlyphs[value],
      hint: 'Вспомни исходные обители: какая принадлежит Луне, какая — Солнцу?',
      explanation: 'Чандра управляет Раком, Сурья — Львом. От этой пары владения расходятся по двум сторонам круга.',
      renderTargets(slots) {
        return rulerWheel((name, index) => index === 3 || index === 4 ? slots[index - 3] : element('div', 'varuna-wheel-cell', name));
      },
    });
  }

  function openRulerPairs(ui) {
    explain(ui, 'Начни от Рака и Льва. Выбери следующий знак с каждой стороны, затем граху, которая управляет этой парой. Открывай пары по порядку, пока не дойдёшь до нижней границы круга.');
    const direction = element('p', 'varuna-pair-progress', 'Пара 1 из ' + rulerPairs.length);
    const picked = [null, null];
    const revealed = new Map([[3, 'Чандра'], [4, 'Сурья']]);
    const cells = [];
    const rulers = ['Шани', 'Буддха', 'Гуру', 'Мангала', 'Шукра'];
    let ruler = null;
    let pair = 0;
    const wheel = rulerWheel((name, index) => {
      const side = index <= 3 || index >= 10 ? 0 : 1;
      const cell = button('', () => {
        picked[side] = picked[side] === index ? null : index;
        update();
      });
      cell.classList.add('varuna-slot');
      const value = element('span', 'varuna-slot-value', '');
      cell.append(element('strong', '', name), value);
      cells.push({ cell, value });
      return cell;
    });
    const chips = choiceButtons(rulers, (index, chip) => {
      ruler = rulers[index];
      choose(chips, chip);
    });
    chips.classList.add('varuna-chips');

    function update() {
      cells.forEach(({ cell, value }, index) => {
        const owner = revealed.get(index);
        cell.disabled = Boolean(owner);
        cell.setAttribute('aria-pressed', String(picked.includes(index)));
        cell.classList.toggle('has-value', Boolean(owner));
        cell.setAttribute('aria-label', signs[index] + (owner ? ' · ' + owner : ''));
        value.textContent = owner ? rulerGlyphs[owner] : '';
      });
    }

    const check = button('Открыть пару', () => {
      if (picked.includes(null) || !ruler) {
        ui.note('Выбери два знака по разные стороны круга и одного управителя.');
        return;
      }
      const target = rulerPairs[pair];
      if (target.signs.some((index, side) => picked[side] !== index)) {
        ui.mistake('Проверь порядок: новая пара должна быть сразу за последней открытой с каждой стороны.');
        return;
      }
      if (ruler !== target.ruler) {
        ui.mistake('Пара знаков выбрана верно. Вспомни последовательность управителей от светил.');
        return;
      }
      target.signs.forEach(index => {
        revealed.set(index, ruler);
        cells[index].cell.classList.add('varuna-sector-revealed');
      });
      const description = ruler + ' · ' + target.signs.map(index => signs[index]).join(' и ');
      chips.children[rulers.indexOf(ruler)].disabled = true;
      pair++;
      picked.fill(null);
      ruler = null;
      choose(chips, null);
      update();
      if (pair === rulerPairs.length) {
        direction.textContent = 'Все пять пар открыты';
        ui.success('Круг собран. От светил к краям идут Буддха, Шукра, Мангала, Гуру и Шани.');
        return;
      }
      direction.textContent = 'Пара ' + (pair + 1) + ' из ' + rulerPairs.length;
      ui.note(description + '. Найди следующую пару.');
    }, true);
    update();
    ui.board.append(direction, wheel, chips, check);
  }

  function identifyAir(ui) {
    explain(ui, 'Первая улика — воздух. Отметь все знаки этой стихии. Потом Варуна добавит вторую улику.');
    let subset = false;
    const chosen = new Set();
    const air = [2, 6, 10];
    const group = choiceButtons(signs, (index, item) => {
      if (!subset) {
        if (chosen.has(index)) chosen.delete(index);
        else chosen.add(index);
        item.setAttribute('aria-pressed', String(chosen.has(index)));
      } else {
        chosen.clear();
        chosen.add(index);
        choose(group, item);
      }
    });
    const check = button('Применить улику', () => {
      if (!chosen.size) { ui.note('Сначала отметь знак или несколько знаков.'); return; }
      if (!subset) {
        if (chosen.size !== air.length || air.some(index => !chosen.has(index))) {
          ui.mistake('Воздух встречается по одному разу в каждой четвёрке знаков. Для первой улики нужны все три.');
          return;
        }
        subset = true;
        chosen.clear();
        choose(group, null);
        [...group.children].forEach((item, i) => { item.hidden = !air.includes(i); });
        ui.board.querySelector('.lesson-prompt').textContent = 'Остались три воздушных знака. Все они нечётные. Вторая улика — неподвижное качество. Выбери один знак.';
        ui.note('Все три воздушных знака найдены.');
        return;
      }
      if (chosen.has(10)) ui.success('Водолей — неподвижный воздух. Нечётность подтверждает результат, но подходит всем трём воздушным знакам.');
      else ui.mistake('Близнецы — двойственные, Весы — подвижные. Найди знак, который остаётся.');
    }, true);
    group.classList.add('varuna-chips');
    ui.board.append(group, check);
  }

  function cycleRound(goal, cards, options, hint, explanation) {
    return ui => {
      assignments(ui, {
        prompt: 'Цель у всех трёх историй одна: ' + goal + '. Подбери знак для каждой истории в восстановленном порядке.',
        options,
        targets: cards.map(([label, answer]) => ({ label, answer })),
        hint, explanation,
        renderTargets(slots) {
          const order = element('ol', 'varuna-cycle', '');
          for (const [i, label] of ['Дом и ближайший круг', 'Город и общественная роль', 'Человечество и духовная цель'].entries()) {
            const item = element('li', '', '');
            item.append(element('strong', '', label), slots[i]);
            order.append(item);
          }
          return order;
        },
      });
    };
  }

  function orderStories(round) {
    return ui => {
      explain(ui, 'Цель раунда — ' + round.goal + '. Расставь три истории в порядке расширения масштаба. Нажимай на них от ближайшего круга к самому широкому.');
      const stories = round.stories;
      const selected = [];
      const group = choiceButtons(stories, (i, item) => {
        const previous = selected.indexOf(i);
        if (previous === -1) selected.push(i);
        else selected.splice(previous, 1);
        [...group.children].forEach((card, index) => {
          const position = selected.indexOf(index);
          card.textContent = position < 0 ? stories[index] : (position + 1) + '. ' + stories[index];
          card.setAttribute('aria-pressed', String(position >= 0));
        });
      });
      group.classList.add('lesson-answer-list');
      const check = button('Подтвердить порядок', () => {
        if (selected.length < stories.length) { ui.note('Отметь все три истории. Чтобы изменить порядок, нажми на отмеченную историю ещё раз.'); return; }
        if (!round.order.every((value, i) => value === selected[i])) {
          ui.mistake(round.hint);
          return;
        }
        ui.board.querySelectorAll(':scope > :not(.lesson-kicker)').forEach(node => node.remove());
        ui.note('Порядок верный. Теперь соотнеси три уровня со знаками.');
        round.assign(ui);
      }, true);
      ui.board.append(group, check);
    };
  }

  const art = [
    ['Семья собирает запас еды на зиму.', 'Телец'],
    ['Мастерская обучает ремеслу и организует работу в городе.', 'Дева'],
    ['Несколько регионов выстраивают общую систему снабжения.', 'Козерог'],
  ];
  const liberation = [
    ['Человек обретает близость и покой в семье.', 'Рак'],
    ['Через испытание человек пересматривает свои привязанности.', 'Скорпион'],
    ['Человек ищет освобождения и обращается к Богу.', 'Рыбы'],
  ];

  const duty = [
    ['Когда поднимается вода, человек первым берёт на себя защиту дома и помогает близким укрыться.', 'Овен'],
    ['Руководитель принимает на себя ответственность за решение, от которого зависит весь город.', 'Лев'],
    ['Наставник ищет и передаёт принцип справедливости, который можно применять в любом обществе.', 'Стрелец'],
  ];
  const desire = [
    ['Соседи с удовольствием встречаются у колодца, чтобы обменяться новостями и историями.', 'Близнецы'],
    ['Гости городского театра знакомятся, находят общие интересы и договариваются о сотрудничестве.', 'Весы'],
    ['Люди из разных стран объединяются вокруг общей мечты: сделать знания и изобретения доступными всем.', 'Водолей'],
  ];

  const steps = [
    { title: 'Четыре печати Варуны', ...stages(sealRounds) },
    { title: 'Матрица двенадцати знаков', ...stages([
      matrixRound([[0, 2], [2, 1], [3, 0]], ['Водолей', 'Рак', 'Стрелец']),
      matrixRound([[1, 0], [1, 1], [1, 2]], ['Телец', 'Дева', 'Козерог'], ['Телец', 'Козерог']),
      quiz({ prompt: 'Два знака относятся к воде и связаны с мокшей. Один подвижный, другой неподвижный. Какая это пара?', choices: ['Рак и Рыбы', 'Рак и Скорпион', 'Скорпион и Рыбы'], answer: 1, hint: 'Все три пары водные. Исключи двойственный знак.', explanation: 'Рак — подвижная вода, Скорпион — неподвижная. Рыбы — двойственные.' }),
    ]) },
    { title: 'Зеркало Солнца и Луны', ...stages([
      placeLuminaries,
      openRulerPairs,
      quiz({ prompt: 'У Овна и Скорпиона общий управитель — Мангала. Какие два признака у этих знаков различаются?', choices: ['Стихия и управитель', 'Качество движения и управитель', 'Стихия и качество движения'], answer: 2, hint: 'Управитель уже известен и один для двух знаков. Сравни их в матрице стихий и качеств.', explanation: 'Овен — подвижный огонь. Скорпион — неподвижная вода.' }),
    ]) },
    { title: 'Знак по уликам', ...stages([
      identifyAir,
      quiz({ prompt: 'В журнале у Тельца три свойства: «земля · неподвижный · нечётный». Только одно записано неверно. Что нужно исправить?', choices: ['Заменить землю на воду.', 'Заменить нечётный на чётный.', 'Заменить неподвижный на двойственный.'], answer: 1, hint: 'Телец стоит сразу за Овном. Проверь номер знака в круге.', explanation: 'Телец — второй знак. Он чётный, земной и неподвижный.' }),
    ]) },
    { title: 'Три масштаба одной цели', ...stages([
      orderStories({ goal: 'артха', stories: [art[1][0], art[2][0], art[0][0]], order: [2, 0, 1], hint: 'Начни с ресурсов одной семьи. Затем расширь масштаб до города и нескольких регионов.', assign: cycleRound('артха', art, ['Козерог', 'Телец', 'Дева'], 'Телец, Дева и Козерог принадлежат к разным четвёркам знаков. Сверь масштаб каждой истории.', 'Телец — хозяйство ближайшего круга. Дева — профессиональный труд в обществе. Козерог — организация ресурсов большого целого.') }),
      orderStories({ goal: 'мокша', stories: [liberation[2][0], liberation[0][0], liberation[1][0]], order: [1, 2, 0], hint: 'Начни с покоя дома, затем поставь внутреннее преобразование, а после — освобождение.', assign: cycleRound('мокша', liberation, ['Рыбы', 'Скорпион', 'Рак'], 'Вспомни, каким водным знаком заканчивается каждая четвёрка.', 'Рак, Скорпион и Рыбы показывают три масштаба мокши в авторской модели курса.') }),
      orderStories({
        goal: 'дхарма',
        stories: [duty[1][0], duty[0][0], duty[2][0]],
        order: [1, 0, 2],
        hint: 'Проследи, как расширяется ответственность: от близких к городу, затем к принципу для любого общества.',
        assign: cycleRound('дхарма', duty, ['Стрелец', 'Овен', 'Лев'],
          'Все три знака огненные. Сверь историю с той четвёркой, к которой относится знак.',
          'Овен берёт на себя защиту ближних. Лев отвечает за общественное решение. Стрелец обращается к принципу, который шире одной общины.'),
      }),
      orderStories({
        goal: 'кама',
        stories: [desire[2][0], desire[0][0], desire[1][0]],
        order: [1, 2, 0],
        hint: 'Сначала общение с соседями, затем связи в городе, затем общая цель, которая объединяет людей из разных стран.',
        assign: cycleRound('кама', desire, ['Весы', 'Водолей', 'Близнецы'],
          'Все три знака воздушные. Определи, где общение с ближайшим кругом, где общественные связи, а где интерес к общему будущему.',
          'Близнецы — обмен в ближайшем кругу. Весы — общественные связи и сотрудничество. Водолей — общие интересы, выходящие за пределы одного города или страны.'),
      }),
    ]) },
  ];

  window.varunaLesson = create({
    steps,
    location: 'Побережье · урок 2',
    listTitle: 'Задания Варуны',
    finishTitle: 'Архитектура знаков восстановлена',
    finishText: 'Ты восстановил свойства знаков и их связи. Возвращайся к Шиве: теперь эти знания пригодятся в Обители.',
  });
})();
