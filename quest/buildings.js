// Каждое здание — это визуальное представление планеты, а не отдельная
// сущность. Ратуша — это и есть здание Сурьи, а не 10-й узел рядом с ним.
// Ровно 9 планет, но зданий (с отдельной картинкой assets/village/buildings/)
// только 7 — у Раху и Кету своего строения нет, они выражены самим
// ландшафтом (гора, побережье), поэтому file: null.
// file — имя файла (без .png), по названию здания, а не планеты: иначе
// оно совпадало бы с assets/characters/{id}.png (портрет персонажа).
// glow — традиционный вайдика-цвет планеты, лёгкое свечение вокруг
// здания на карте (см. .village-building-image в styles.css), чтобы
// силуэт отделялся от травы и читался, какая планета перед тобой.
const planetBuildings = {
  surya: { name: 'Ратуша', planet: 'Сурья', file: 'ratusha', glow: '#f9ae38' },
  chandra: { name: 'Дом Божественной Матери', planet: 'Чандра', file: 'dom-bozhestvennoy-materi', glow: '#bcd9ff' },
  mangala: { name: 'Воинский зал', planet: 'Мангала', file: 'voinskiy-zal', glow: '#e2685f' },
  budha: { name: 'Торговая гильдия', planet: 'Буддха', file: 'torgovaya-gildiya', glow: '#7cd992' },
  guru: { name: 'Храм мудрости', planet: 'Гуру', file: 'hram-mudrosti', glow: '#ffd966' },
  shukra: { name: 'Чертоги Шукры', planet: 'Шукра', file: 'chertogi-shukry', glow: '#ffb3d1' },
  shani: { name: 'Ремесленный двор', planet: 'Шани', file: 'remeslennyy-dvor', glow: '#5c7cbf' },
  rahu: { name: 'Побережье', planet: 'Раху', file: null, glow: null },
  ketu: { name: 'Гималаи', planet: 'Кету', file: null, glow: null },
};
