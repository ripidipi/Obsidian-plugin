/**
 * Логика "быстрых действий" (кнопки "Исправить", "Конспект" и т.д.).
 *
 * Отвечает за:
 * - формирование промпта и отправку запроса к модели;
 * - обработку ответа;
 * - выбор поведения вставки (в чат / в конец файла / через модалку).
 */

const { Notice } = require('obsidian');
const { sendToAI } = require('./client.js');
const { composePrompt, getTaskInstruction, getAllModes, SYSTEM_PROMPT } = require('./prompts.js');
const CONSTANTS = require('../constants.js');

/**
 * Обрабатывает быстрое действие: получает текст, отправляет в AI, обрабатывает ответ
 * @param {Object} params
 * @param {Object} params.plugin - Экземпляр плагина (для доступа к настройкам)
 * @param {string} params.modeId - Идентификатор режима ('fix', 'summary' и т.д.)
 * @param {string} params.text - Исходный текст для обработки
 * @param {Object} params.editor - Экземпляр редактора Obsidian (CodeMirror)
 * @param {string} params.sourceType - 'selection' | 'full-file' (для информирования)
 * @param {string} params.insertBehavior - 'modal' | 'append' | 'chat'
 * @param {Function} params.onUpdateUI - Колбэк для обновления интерфейса чата (опционально)
 * @returns {Promise<void>}
 */
async function processQuickAction({ 
  plugin, 
  modeId, 
  text, 
  editor, 
  sourceType = 'selection',
  insertBehavior = 'modal', // По умолчанию: спрашиваем, если явно не передано
  onUpdateUI 
}) {
  // Получаем все доступные режимы (встроенные + пользовательские)
  const allModes = getAllModes(plugin.settings.customPrompts);
  const mode = Object.values(allModes).find(m => m.id === modeId);
  
  // Защита: если режим не найден — выходим
  if (!mode) {
    console.warn(`Режим ${modeId} не найден`);
    return;
  }

  // Показываем пользователю, что начали обработку (в чате или уведомлением)
  if (onUpdateUI) {
    const preview = text.slice(0, 100) + (text.length > 100 ? '...' : '');
    const label = sourceType === 'full-file' ? 'Файл' : 'Выделение';
    onUpdateUI('user', `${label} • ${mode.label}\n\n${preview}`);
    onUpdateUI('loading', true);
  }

  try {
    // Формируем промпт: инструкция режима + исходный текст
    const prompt = composePrompt({
      systemPrompt: SYSTEM_PROMPT,
      taskInstruction: mode.instruction,
      context: text
    });

    // Готовим тело запроса в формате OpenAI-compatible
    const payload = {
      model: plugin.settings.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      max_tokens: plugin.settings.maxTokens,
      temperature: plugin.settings.temperature
    };

    // Отправляем запрос к API
    const response = await sendToAI({
      apiUrl: CONSTANTS.API_URL,
      apiKey: plugin.settings.apiKey,
      payload
    });

    // Если получили ответ — обрабатываем в зависимости от поведения вставки
    if (response) {
      // Всегда показываем ответ в чате (если есть onUpdateUI)
      if (onUpdateUI) {
        onUpdateUI('assistant', response);
      }
      
      // Логика вставки: три варианта поведения
      if (insertBehavior === 'append') {
        // === Вариант 1: Сразу в конец файла (без модального окна) ===
        if (editor) {
          // Перемещаем курсор в конец выделения (или текущую позицию) и вставляем
          const cursor = editor.getSelection().length > 0 
            ? editor.getCursor('to')  // Конец выделения
            : editor.getCursor();     // Текущая позиция
          editor.setSelection(cursor, cursor);
          editor.replaceSelection('\n\n---\n' + response);
          new Notice('Текст добавлен в конец файла');
        }
        
      } else if (insertBehavior === 'chat') {
        // === Вариант 2: Только в чат, файл не трогаем ===
        // Ответ уже показан через onUpdateUI, просто уведомляем
        new Notice('Ответ показан в чате');
        
      } else {
        // === Вариант 3: 'modal' — спрашиваем пользователя ===
        // Открываем модальное окно с вариантами вставки
        // Динамический импорт, чтобы избежать циклических зависимостей
        if (editor) {
          const { InsertModeModal } = require('../ui/insert-modal.js');
          new InsertModeModal(plugin.app, response, text, editor).open();
        }
      }
    }
  } catch (error) {
    // Обрабатываем ошибки сети или API
    console.error('Quick action failed:', error);
    new Notice(`Ошибка: ${error.message}`);
    if (onUpdateUI) {
      onUpdateUI('assistant', `Ошибка: ${error.message}`);
    }
  } finally {
    // Снимаем индикатор загрузки в любом случае
    if (onUpdateUI) {
      onUpdateUI('loading', false);
    }
  }
}

module.exports = { processQuickAction, getAllModes };
