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
