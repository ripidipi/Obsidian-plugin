// Клиент для общения с AI API
// Изолирует всю сетевую логику: fetch, обработка ошибок, парсинг ответа
// Почему отдельно? Чтобы потом легко заменить Hugging Face на OpenAI или локальный сервер

/**
 * Отправляет запрос к AI-провайдеру и возвращает текстовый ответ
 * @param {Object} params
 * @param {string} params.apiUrl - Эндпоинт API
 * @param {string} params.apiKey - Ключ авторизации
 * @param {Object} params.payload - Тело запроса (модель, сообщения, параметры)
 * @returns {Promise<string>} - Ответ модели в виде строки
 * @throws {Error} - Если запрос не удался
 */
async function sendToAI({ apiUrl, apiKey, payload }) {
  // Выполняем POST-запрос с заголовками авторизации
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  // Проверяем статус ответа: 200-299 — успех, остальное — ошибка
  if (!response.ok) {
    // Пытаемся извлечь детальное сообщение об ошибке от API
    const errorData = await response.json().catch(() => ({}));
    // Формируем понятное исключение
    throw new Error(errorData.error?.message || `HTTP ошибка ${response.status}`);
  }

  // Парсим успешный ответ
  const data = await response.json();
  
  // Извлекаем текст ответа: структура зависит от провайдера
  // Здесь предполагаем OpenAI-compatible формат
  return data.choices?.[0]?.message?.content?.trim();
}

module.exports = { sendToAI };