// Утилиты для работы с редактором Obsidian
// Вынесены отдельно, чтобы: 
// 1) не дублировать код в разных компонентах
// 2) упростить тестирование логики получения текста
// 3) сделать код более читаемым ("что делает эта функция?")

const { MarkdownView } = require('obsidian');

/**
 * Получает активный экземпляр редактора (CodeMirror)
 * Пробует два способа:
 * 1) через активное представление (быстро, но не всегда работает)
 * 2) перебором всех вкладок (надёжнее, но чуть медленнее)
 * 
 * @param {Object} app - Экземпляр Obsidian App
 * @returns {Object|null} - Редактор или null, если не найден
 */
function getActiveEditor(app) {
  // Способ 1: пробуем получить активный MarkdownView
  const activeView = app.workspace.getActiveViewOfType(MarkdownView);
  if (activeView?.editor) {
    return activeView.editor;
  }
  
  // Способ 2: ищем среди всех markdown-вкладок
  for (const leaf of app.workspace.getLeavesOfType('markdown')) {
    if (leaf.view instanceof MarkdownView && leaf.view.editor) {
      return leaf.view.editor;
    }
  }
  
  return null;
}

/**
 * Извлекает текст для отправки в AI: выделение или содержимое заметки
 * Учитывает настройки: использовать ли контекст и лимит символов
 * 
 * @param {Object} params
 * @param {Object} params.editor - Экземпляр редактора
 * @param {boolean} params.useContext - Флаг: использовать ли контекст
 * @param {number} params.contextLimit - Макс. количество символов
 * @returns {string|null} - Текст или null, если нечего отправлять
 */
function extractText({ editor, useContext, contextLimit }) {
  // Если контекст отключён или редактор не найден — нечего извлекать
  if (!useContext || !editor) return null;
  
  // Приоритет: выделенный текст (если есть)
  const selection = editor.getSelection()?.trim();
  if (selection) return selection;
  
  // Иначе: берём содержимое всей заметки, обрезая по лимиту
  const fullText = editor.getValue();
  return fullText?.slice(0, contextLimit)?.trim() || null;
}

module.exports = { getActiveEditor, extractText };
