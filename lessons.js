// Уроки блока "Семя". unlocksLocation — здание на карте деревни, которое
// открывается по завершении урока. У "Введения" оно пустое: этот урок не
// привязан ни к какому зданию и не считается одним из 9. Название здания
// для остальных девяти берётся из planetBuildings (buildings.js) —
// единственного источника правды, чтобы имена не расходились.
const MOKSHA_LESSONS = [
  { title: 'Введение', icon: '▶', unlocksLocation: null },
  { title: 'Солнце', icon: '☀️' },
  { title: 'Луна', icon: '🌙' },
  { title: 'Марс', icon: '♂' },
  { title: 'Меркурий', icon: '☿' },
  { title: 'Юпитер', icon: '♃' },
  { title: 'Венера', icon: '♀' },
  { title: 'Сатурн', icon: '♄' },
  { title: 'Раху', icon: '☊' },
  { title: 'Кету', icon: '☋' },
].map((lesson) => {
  if (lesson.unlocksLocation === null) return lesson;
  const character = MOKSHA_CHARACTERS.find((item) => item.subtitle === lesson.title);
  const building = character ? planetBuildings[character.id] : null;
  return { ...lesson, unlocksLocation: building ? building.name : null };
});

const getLessonByTitle = (title) => MOKSHA_LESSONS.find((lesson) => lesson.title === title) || null;

const getLocationHeading = (lessonTitle) => {
  const lesson = getLessonByTitle(lessonTitle);
  if (!lesson || !lesson.unlocksLocation) return lessonTitle;
  return `${lesson.unlocksLocation} · ${lesson.title}`;
};

const genitiveCase = {
  Сурья: 'Сурьи',
  Чандра: 'Чандры',
  Мангала: 'Мангалы',
  Буддха: 'Буддхи',
  Гуру: 'Гуру',
  Шукра: 'Шукры',
  Шани: 'Шани',
  Раху: 'Раху',
  Кету: 'Кету',
};

// "Я посмотрел лекцию" — гейт. Открыт всегда первым, вручную подтверждается
// (заглушка), остальные задания урока заблокированы, пока он не пройден.
const LECTURE_TASK = { id: 'watch_lecture', type: 'lecture_checkbox', title: 'Я посмотрел лекцию' };

const INTRO_TASKS = [
  LECTURE_TASK,
  { id: 'task_1', type: 'matching', title: 'Собери пять слоёв' },
  { id: 'task_2', type: 'find_error', title: 'Отличи Знак от Дома' },
  { id: 'task_3', type: 'matching_transfer', title: 'Придумай свою метафору' },
  { id: 'task_4', type: 'case_quiz', title: 'Прочитай одним взглядом' },
  { id: 'village_intro', type: 'guided_tour', title: 'Знакомство с обителью' },
];

const getEngineTasksForPlanet = (planetGrahaTitle) => {
  const genitive = genitiveCase[planetGrahaTitle] || planetGrahaTitle;
  return [
    LECTURE_TASK,
    { id: 'engine_1', type: 'video', title: `Три лика ${genitive} (разбор видений)` },
    { id: 'engine_2', type: 'phrase', title: 'Слово гуны (быстрый выбор)' },
    { id: 'engine_3', type: 'audio', title: 'Голос трёх начал (слушай и различай)' },
    { id: 'engine_4', type: 'quiz', title: 'Изъян в писании (найди ошибку)' },
    { id: 'engine_5', type: 'image', title: 'Зеркало времён (распознай гуну)' },
    { id: 'engine_6', type: 'match', title: 'Карта звёздного покровителя (собери знания)' },
  ];
};

// Гейтинг: лекция открыта всегда. Обычные задания открываются все разом,
// как только лекция пройдена (порядок между ними свободный). guided_tour —
// финальный гейт: открывается только когда пройдены все остальные задания,
// кроме самой лекции.
const computeTaskStatuses = (tasks, progress) => {
  const lectureDone = !!progress[LECTURE_TASK.id];

  return tasks.map((task) => {
    if (progress[task.id]) return { ...task, status: 'completed' };
    if (task.id === LECTURE_TASK.id) return { ...task, status: 'unlocked' };

    if (task.type === 'guided_tour') {
      const others = tasks.filter((item) => item.id !== LECTURE_TASK.id && item.id !== task.id);
      const allOthersDone = others.every((item) => progress[item.id]);
      return { ...task, status: allOthersDone ? 'unlocked' : 'locked' };
    }

    return { ...task, status: lectureDone ? 'unlocked' : 'locked' };
  });
};
