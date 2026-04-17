// Логика промптов (инструкций) для модели.
//
// Зачем отдельный модуль:
// 1) Спрятать "склейку" промпта в одном месте (читаемость и тестируемость).
// 2) Развести ответственность: UI показывает кнопки, а здесь решается "что отправлять в модель".
//
// Где живут сами тексты режимов:
// - `prompts.json` в корне проекта: системный промпт и базовые быстрые кнопки.
// - настройки плагина (customPrompts): пользователь может добавить свои режимы в UI.
//
// Правило приоритета:
// - сначала берём режимы из `prompts.json`;
// - затем добавляем/переопределяем режимы из настроек (customPrompts).

const promptsConfig = require('../../prompts.json');

// ===== Быстрые режимы (из prompts.json) =====
// Структура `prompts.json`:
// {
//   "system_prompt": "общая инструкция модели",
//   "quick_modes": [
//     { "id": "fix", "label": "Исправить", "instruction": "..." }
//   ]
// }
//
// Для студентов: обычно достаточно редактировать только `prompts.json`.

const QUICK_MODES = (() => {
  try {
    const modes = {};
    
    if (Array.isArray(promptsConfig.quick_modes)) {
      for (const mode of promptsConfig.quick_modes) {
        // Валидация: все три поля обязательны.
        if (mode?.id && mode?.label && mode?.instruction) {
          // Храним ключ в верхнем регистре: FIX, SUMMARY, EXPLAIN.
          const key = mode.id.toUpperCase();
          modes[key] = {
            id: mode.id,
            label: mode.label,
            instruction: mode.instruction
          };
        } else {
          console.warn('Режим пропущен: проверьте поля id/label/instruction', mode);
        }
      }
    }
    return modes;
  } catch (error) {
    console.error('Не удалось загрузить prompts.json:', error.message);
    return {};
  }
})();

// ===== Системный промпт =====
// Базовая инструкция (role/system message), одинаковая для всех режимов.
const SYSTEM_PROMPT = promptsConfig.system_prompt || [
  'Ты AI-помощник в редакторе Obsidian.',
  'Отвечай по делу и на русском языке.',
  'Если информации недостаточно, задай уточняющие вопросы.'
].join('\n');

/**
 * Собирает текст пользовательского сообщения для отправки в модель.
 * Здесь мы кладём данные в "явные" блоки, чтобы модели было проще разделять:
 * - общие правила,
 * - конкретную задачу,
 * - контекст (текст из редактора).
 * 
 * @param {Object} options
 * @param {string} options.systemPrompt - Базовая инструкция
 * @param {string} options.taskInstruction - Задача из режима или ввода пользователя
 * @param {string|null} options.context - Текст из редактора
 * @returns {string} - Готовый промпт
 */
function composePrompt({ systemPrompt, taskInstruction, context }) {
  const contextBlock = context 
    ? `<context>\n${context}\n</context>` 
    : '<context>Контекст не предоставлен.</context>';

  return `
<instructions>
${systemPrompt}
</instructions>

<task>
${taskInstruction}
</task>

${contextBlock}

Ответ:`;
}

/**
 * Возвращает инструкцию для режима.
 * Если режим неизвестен, используем `userInput` как инструкцию (обычный чат).
 * 
 * @param {string} mode - Идентификатор режима ('fix', 'summary' и т.д.)
 * @param {string} userInput - Текст пользователя (для обычного чата)
 * @returns {string} - Инструкция для промпта
 */
function getTaskInstruction(mode, userInput) {
  // Ищем режим в QUICK_MODES (ключ в верхнем регистре).
  const modeObj = QUICK_MODES[mode.toUpperCase()];
  
  // Если нашли — берём instruction, иначе — userInput (обычный чат).
  return modeObj?.instruction || userInput;
}

/**
 * Возвращает все доступные режимы (из prompts.json + пользовательские из настроек).
 * Пользовательские режимы могут перезаписывать базовые, если совпал id.
 * 
 * @param {Array} customPrompts - Режимы из настроек плагина (опционально)
 * @returns {Object} - Объект режимов
 */
function getAllModes(customPrompts = []) {
  // Начинаем с режимов из JSON.
  const allModes = { ...QUICK_MODES };
  
  // Добавляем пользовательские (из UI настроек), если есть.
  if (Array.isArray(customPrompts)) {
    for (const prompt of customPrompts) {
      if (prompt?.id && prompt?.label && prompt?.instruction) {
        const key = prompt.id.toUpperCase();
        // Пользовательский режим может перезаписать стандартный.
        allModes[key] = {
          id: prompt.id,
          label: prompt.label,
          instruction: prompt.instruction
        };
      }
    }
  }
  
  return allModes;
}

module.exports = {
  QUICK_MODES,
  SYSTEM_PROMPT,
  composePrompt,
  getTaskInstruction,
  getAllModes,
  config: promptsConfig // Экспортируем конфиг для диагностики
};
