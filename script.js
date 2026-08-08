document.addEventListener('DOMContentLoaded', () => {
  const creatorState = {
    name: 'Герой',
    gender: 'male',
    hair: '1',
    outfit: '1',
    accessory: '0',
    skin: 0,
  };

  const creatorElements = {
    name: document.getElementById('creatorName'),
    previewName: document.getElementById('creatorPreviewName'),
    previewSubtitle: document.getElementById('creatorPreviewSubtitle'),
    bodyLayer: document.getElementById('creatorBodyLayer'),
    outfitLayer: document.getElementById('creatorOutfitLayer'),
    hairLayer: document.getElementById('creatorHairLayer'),
    accessoryLayer: document.getElementById('creatorAccessoryLayer'),
  };

  const skinFilters = [
    'hue-rotate(10deg) saturate(1)',
    'hue-rotate(20deg) saturate(1.1)',
    'hue-rotate(35deg) saturate(1.15)',
    'hue-rotate(50deg) saturate(1.2)',
    'hue-rotate(65deg) saturate(1.25)',
  ];

  const updatePreview = () => {
    creatorElements.previewName.textContent = creatorState.name || 'Герой';
    creatorElements.previewSubtitle.textContent = `${creatorState.gender === 'male' ? 'Мужской' : 'Женский'} · Одежда ${creatorState.outfit} · Причёска ${creatorState.hair}`;
    creatorElements.bodyLayer.textContent = `Тело — ${creatorState.gender === 'male' ? 'мужское' : 'женское'}`;
    creatorElements.outfitLayer.textContent = `Одежда ${creatorState.outfit}`;
    creatorElements.hairLayer.textContent = `Причёска ${creatorState.hair}`;
    creatorElements.accessoryLayer.textContent = creatorState.accessory === '0' ? 'Без аксессуара' : `Аксессуар ${creatorState.accessory}`;
    creatorElements.bodyLayer.style.filter = skinFilters[creatorState.skin];
  };

  const setActiveOption = (container, group, value) => {
    container.querySelectorAll(`button[data-group="${group}"]`).forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.value === value);
    });
  };

  const setSelectedAccessory = (value) => {
    document.querySelectorAll('#accessoryOptions button[data-group="accessory"]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.value === value);
    });
  };

  const setSkinActive = (index) => {
    document.querySelectorAll('#skinPicker button').forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.index) === index);
    });
  };

  const setGenderActive = (gender) => {
    document.querySelectorAll('.creator-gender').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.gender === gender);
    });
  };

  const hairOptions = document.getElementById('hairOptions');
  const outfitOptions = document.getElementById('outfitOptions');
  const accessoryOptions = document.getElementById('accessoryOptions');
  const skinPicker = document.getElementById('skinPicker');
  const genderButtons = document.querySelectorAll('.creator-gender');

  genderButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const gender = btn.dataset.gender;
      creatorState.gender = gender;
      creatorState.body = gender === 'male' ? 'male_1' : 'female_1';
      setGenderActive(gender);
      updatePreview();
    });
  });

  hairOptions.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      creatorState.hair = btn.dataset.value;
      setActiveOption(hairOptions, 'hair', creatorState.hair);
      updatePreview();
    });
  });

  outfitOptions.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      creatorState.outfit = btn.dataset.value;
      setActiveOption(outfitOptions, 'outfit', creatorState.outfit);
      updatePreview();
    });
  });

  accessoryOptions.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      creatorState.accessory = btn.dataset.value;
      setSelectedAccessory(creatorState.accessory);
      updatePreview();
    });
  });

  skinPicker.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      creatorState.skin = Number(btn.dataset.index);
      setSkinActive(creatorState.skin);
      updatePreview();
    });
  });

  creatorElements.name.addEventListener('input', (event) => {
    creatorState.name = event.target.value;
    updatePreview();
  });

  creatorState.body = 'male_1';
  setGenderActive('male');
  setActiveOption(hairOptions, 'hair', creatorState.hair);
  setActiveOption(outfitOptions, 'outfit', creatorState.outfit);
  setSelectedAccessory(creatorState.accessory);
  setSkinActive(creatorState.skin);
  updatePreview();

  const courseData = [
    {
      title: 'Семя',
      status: 'active',
      lessons: [
        { title: 'Введение', icon: '▶', status: 'completed' },
        { title: 'Солнце', icon: '☀️', status: 'completed' },
        { title: 'Луна', icon: '🌙', status: 'completed' },
        { title: 'Марс', icon: '♂', status: 'completed' },
        { title: 'Меркурий', icon: '☿', status: 'completed' },
        { title: 'Юпитер', icon: '♃', status: 'completed' },
        { title: 'Венера', icon: '♀', status: 'completed' },
        { title: 'Сатурн', icon: '♄', status: 'completed' },
        { title: 'Раху', icon: '☊', status: 'completed' },
        { title: 'Кету', icon: '☋', status: 'active' },
      ],
    },
    {
      title: 'Небо',
      status: 'locked',
      lessons: [
        { title: 'Солнце', icon: '☀', status: 'locked' },
        { title: 'Луна', icon: '☾', status: 'locked' },
        { title: 'Марс', icon: '♂', status: 'locked' },
        { title: 'Венера', icon: '♀', status: 'locked' },
      ],
    },
  ];

  const lessonTypeIcons = {
    video: '🎥',
    audio: '🎧',
    phrase: '🗣️',
    quiz: '🧩',
    image: '🖼️',
    map: '🗺️',
    match: '🧭',
  };

  const genitiveCase = {
    'Солнце': 'Солнца',
    'Луна': 'Луны',
    'Марс': 'Марса',
    'Меркурий': 'Меркурия',
    'Юпитер': 'Юпитера',
    'Венера': 'Венеры',
    'Сатурн': 'Сатурна',
    'Раху': 'Раху',
    'Кету': 'Кету',
  };

  const getTasksForLesson = (lessonTitle) => {
    const baseName = lessonTitle.replace(/^[^А-Яа-яЁё]+\s*/, '').trim();
    const genitive = genitiveCase[baseName] || baseName;

    return [
      { type: 'video', title: `Три лица ${genitive}` },
      { type: 'phrase', title: 'Фраза-гуна' },
      { type: 'audio', title: 'Письмо трёх голосов' },
      { type: 'quiz', title: 'Найди ошибку' },
      { type: 'image', title: 'Кто есть кто' },
      { type: 'match', title: 'Карта планеты' },
    ];
  };

  const mapRoot = document.getElementById('courseMap');
  let selectedLesson = null;
  let selectedBlock = null;

  const initializeSelection = () => {
    for (const block of courseData) {
      const activeLesson = block.lessons.find((lesson) => lesson.status === 'active');
      if (activeLesson) {
        selectedLesson = activeLesson;
        selectedBlock = block;
        break;
      }
    }
  };

  initializeSelection();

  const renderCourse = () => {
    mapRoot.innerHTML = '';

    const DESIGN_WIDTH = 500;
    const CENTER_X = 250;
    const VERTICAL_SPACING = 100;
    const OFFSET_AMOUNT = 50;
    const CARD_WIDTH = 190;
    const CARD_HEIGHT = 56;
    const CIRCLE_SIZE = 28;
    const TOTAL_PADDING_BOTTOM = 100;
    const toPct = (px) => `${(px / DESIGN_WIDTH) * 100}%`;

    courseData.forEach((block, blockIndex) => {
      const blockElement = document.createElement('div');
      blockElement.className = 'course-block';

      const isOpen = block.expanded !== undefined ? block.expanded : block.status === 'active';

      const header = document.createElement('button');
      header.type = 'button';
      header.className = `course-block-header ${block.status === 'locked' ? 'locked' : ''} ${block.status === 'active' ? 'active' : ''}`;
      header.innerHTML = `
        <div class="block-title">
          <strong>${block.title}</strong>
          <div class="block-meta">${block.lessons.length} уроков · ${block.status === 'completed' ? 'Пройден' : block.status === 'active' ? 'Текущий' : 'Закрыт'}</div>
        </div>
        <div class="status-pill status-${block.status}">${block.status === 'completed' ? 'ГОТОВО' : block.status === 'active' ? 'ТЕКУЩИЙ' : 'ЗАБЛОКИР.'}</div>
        <div class="expand-icon ${isOpen ? 'open' : ''}">▶</div>
      `;

      const content = document.createElement('div');
      content.className = `course-block-content ${isOpen ? 'open' : ''}`;

      const snakeContainer = document.createElement('div');
      snakeContainer.style.position = 'relative';
      snakeContainer.style.width = '100%';
      snakeContainer.style.maxWidth = `${DESIGN_WIDTH}px`;
      snakeContainer.style.margin = '0 auto';
      snakeContainer.style.boxSizing = 'border-box';
      snakeContainer.style.overflow = 'visible';

      const nodeCenters = block.lessons.map((lesson, lessonIndex) => {
        const offsetX = lessonIndex % 2 === 0 ? -OFFSET_AMOUNT : OFFSET_AMOUNT;
        return {
          x: CENTER_X + offsetX,
          y: lessonIndex * VERTICAL_SPACING + 55,
          lesson,
        };
      });

      const totalHeight = nodeCenters.length * VERTICAL_SPACING + TOTAL_PADDING_BOTTOM;
      snakeContainer.style.height = `${totalHeight}px`;
      snakeContainer.style.minHeight = `${totalHeight}px`;

      if (nodeCenters.length > 1) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', `${totalHeight}`);
        svg.setAttribute('viewBox', `0 0 ${DESIGN_WIDTH} ${totalHeight}`);
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.zIndex = '0';

        const pathData = nodeCenters.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('stroke', '#4CAF82');
        path.setAttribute('stroke-width', '4');
        path.setAttribute('fill', 'none');
        svg.appendChild(path);
        snakeContainer.appendChild(svg);
      }

      nodeCenters.forEach((point) => {
        const lesson = point.lesson;
        const isLeft = point.x < CENTER_X;
        const card = document.createElement('div');
        card.style.position = 'absolute';
        card.style.top = `${point.y - CARD_HEIGHT / 2}px`;
        card.style.width = toPct(CARD_WIDTH);
        card.style.height = `${CARD_HEIGHT}px`;
        card.style.zIndex = '1';
        card.style.display = 'flex';
        card.style.alignItems = 'center';
        card.style.justifyContent = 'center';
        card.style.gap = '8px';
        card.style.padding = '0 14px';
        card.style.borderRadius = '999px';
        card.style.background = '#E3F5EC';
        card.style.border = '1px solid #8FCBAA';
        card.style.boxSizing = 'border-box';
        card.style.cursor = lesson.status === 'locked' ? 'default' : 'pointer';
        card.style.overflow = 'hidden';

        if (isLeft) {
          card.style.left = toPct(point.x - CARD_WIDTH + CIRCLE_SIZE / 2);
        } else {
          card.style.left = toPct(point.x - CIRCLE_SIZE / 2);
        }

        if (lesson.status !== 'locked') {
          card.addEventListener('click', () => {
            selectedLesson = lesson;
            selectedBlock = block;
            renderCourse();
          });
        }

        const circle = document.createElement('div');
        circle.style.position = 'absolute';
        circle.style.top = `${(CARD_HEIGHT - CIRCLE_SIZE) / 2}px`;
        circle.style.width = `${CIRCLE_SIZE}px`;
        circle.style.height = `${CIRCLE_SIZE}px`;
        circle.style.borderRadius = '50%';
        circle.style.background = '#fff';
        circle.style.border = '1px solid #8FCBAA';
        circle.style.display = 'grid';
        circle.style.placeItems = 'center';
        circle.style.fontSize = '12px';
        circle.textContent = lesson.status === 'completed' ? '✓' : '';

        const info = document.createElement('div');
        info.style.overflow = 'hidden';
        info.style.minWidth = '0';
        info.style.flex = '1 1 auto';
        info.style.display = 'flex';
        info.style.flexDirection = 'column';
        info.style.justifyContent = 'center';
        info.style.alignItems = 'center';
        if (isLeft) {
          circle.style.right = '8px';
          info.style.marginRight = `${CIRCLE_SIZE + 10}px`;
        } else {
          circle.style.left = '8px';
          info.style.marginLeft = `${CIRCLE_SIZE + 10}px`;
        }

        const title = document.createElement('div');
        title.style.display = 'block';
        title.style.fontWeight = '700';
        title.style.fontSize = '13px';
        title.style.whiteSpace = 'nowrap';
        title.style.overflow = 'hidden';
        title.style.textOverflow = 'ellipsis';
        title.style.maxWidth = '100%';
        title.style.textAlign = 'center';
        title.textContent = `${lesson.icon ? lesson.icon + ' ' : ''}${lesson.title}`;

        const subtitle = document.createElement('div');
        subtitle.style.fontSize = '10px';
        subtitle.style.color = '#888';
        subtitle.style.textAlign = 'center';
        subtitle.textContent = lesson.status === 'completed' ? 'Выполнено' : lesson.status === 'active' ? 'Доступно' : 'Закрыто';

        info.append(title, subtitle);
        card.append(circle, info);
        snakeContainer.appendChild(card);
      });

      content.appendChild(snakeContainer);

      header.addEventListener('click', () => {
        if (block.status === 'locked') return;

        courseData.forEach((item) => {
          if (item.title !== block.title) {
            item.expanded = false;
          }
        });

        block.expanded = !isOpen;
        renderCourse();
      });

      blockElement.appendChild(header);
      blockElement.appendChild(content);
      mapRoot.appendChild(blockElement);
    });

    renderCourseDetail(selectedLesson, selectedBlock);
  };

  const renderCourseDetail = (lesson, block) => {
    const detailRoot = document.getElementById('courseDetail');
    detailRoot.innerHTML = '';

    if (!lesson || !block) {
      detailRoot.innerHTML = '<div class="course-empty">Выберите урок слева, чтобы увидеть детали курса и персональные задачи.</div>';
      return;
    }

    const title = document.createElement('h3');
    title.textContent = lesson.title;

    const status = document.createElement('div');
    status.className = 'detail-status';
    status.textContent = lesson.status === 'completed' ? 'Выполнено' : lesson.status === 'active' ? 'Текущий урок' : 'Закрыто';

    const summary = document.createElement('p');
    summary.className = 'detail-meta';
    summary.textContent = lesson.title === 'Введение'
      ? 'Вводный урок показывает структуру курса, знакомит с целями и помогает начать планетное путешествие.'
      : `Практическая серия заданий для урока ${lesson.title}, которые развивают восприятие планеты и закрепляют знания через разные медиа.`;

    const detailStats = document.createElement('div');
    detailStats.className = 'detail-meta';
    detailStats.innerHTML = `
      <div><strong>Блок:</strong> ${block.title}</div>
      <div><strong>XP:</strong> ${lesson.xp || 18} XP</div>
      <div><strong>Время:</strong> ${lesson.duration || '5 мин'}</div>
    `;

    const tasks = document.createElement('div');
    tasks.className = 'task-list';

    const lessonTasks = lesson.title === 'Введение'
      ? [
          { type: 'video', title: 'Ознакомление с курсом', status: 'Active' },
          { type: 'phrase', title: 'Составить первую фразу', status: 'Locked' },
          { type: 'quiz', title: 'Пройти тест по структуре', status: 'Locked' },
        ]
      : getTasksForLesson(lesson.title).map((engine, index) => {
          if (lesson.status === 'completed') {
            return { ...engine, status: 'Completed' };
          }
          if (lesson.status === 'active') {
            if (index < 2) return { ...engine, status: 'Completed' };
            if (index === 2) return { ...engine, status: 'Active' };
            return { ...engine, status: 'Locked' };
          }
          return { ...engine, status: 'Locked' };
        });

    lessonTasks.forEach((task, idx) => {
      const item = document.createElement('div');
      item.className = 'task-item';
      if (task.status === 'Completed') {
        item.classList.add('completed');
      }
      if (task.status === 'Locked') {
        item.classList.add('locked');
      }

      const icon = document.createElement('div');
      icon.className = 'task-icon';
      icon.textContent = task.status === 'Completed' ? '✓' : lessonTypeIcons[task.type] || idx + 1;

      const meta = document.createElement('div');
      meta.innerHTML = `
        <div class="task-title">${task.title}</div>
        <div class="task-status">${task.status === 'Completed' ? 'Выполнено' : task.status === 'Active' ? 'В процессе' : 'Закрыто'}</div>
      `;

      item.append(icon, meta);
      tasks.append(item);
    });

    detailRoot.append(title, status, summary, detailStats, tasks);
  };

  renderCourse();
});
