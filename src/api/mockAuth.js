// ЗАГЛУШКИ бэкенд-вызовов. Когда бэкенд будет готов, замените
// содержимое этих двух функций на реальные fetch-запросы —
// остальной код и вёрстка их не касаются.

async function fakeTelegramLogin() {
  // ЗАГЛУШКА: в реальной версии здесь будет Telegram Login Widget
  // возвращает моковые данные пользователя
  await new Promise((resolve) => setTimeout(resolve, 400));
  return {
    telegramId: '123456789',
    firstName: 'Тестовый Ученик',
    username: 'test_user',
  };
}

async function fakeCheckSubscription(telegramId) {
  // ЗАГЛУШКА: в реальности здесь будет запрос к бэкенду,
  // который через Telegram Bot API проверяет подписку на канал
  // пока всегда возвращаем "подписка есть"
  await new Promise((resolve) => setTimeout(resolve, 1200));
  return {
    hasPlanetsAccess: true,
    hasSignsAccess: false, // блок "Знаки" пока закрыт для всех
    hasNakshatrasAccess: false,
  };
}
