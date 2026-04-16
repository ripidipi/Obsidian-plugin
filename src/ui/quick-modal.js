/**
 * Модальное окно "быстрого меню".
 *
 * Открывается по команде/горячей клавише и помогает запустить обработку текста без перехода в чат.
 * Ответственности:
 * - показать список быстрых режимов (встроенные + пользовательские);
 * - принять "свой промпт" (свободный ввод) и отправить запрос;
 * - при наличии открытого чата отображать прогресс/ответ там;
 * - если чат закрыт, показать ответ в отдельном модальном окне.
 */

// Импорты зависимостей Obsidian API
const { Modal, Setting, ButtonComponent, Notice } = require('obsidian');

// constants.js экспортирует объект через module.exports, поэтому импортируем без фигурных скобок.
const CONSTANTS = require('../constants.js');

// Импорты наших модулей (с явным указанием .js для esbuild)
const { getAllModes } = require('../ai/prompts.js');
const { processQuickAction } = require('../ai/modes.js');
const { sendToAI } = require('../ai/client.js');
const { composePrompt, SYSTEM_PROMPT } = require('../ai/prompts.js');

class QuickModeModal extends Modal {
  // Конструктор получает данные для обработки: текст и редактор
  // Параметры:
  // - app: экземпляр Obsidian App (родитель Modal)
  // - plugin: экземпляр плагина (доступ к настройкам)
  // - text: исходный текст (выделение или вся заметка)
  // - editor: редактор Obsidian (CodeMirror) для вставки результата
  constructor(app, plugin, text, editor) {
    super(app);
    this.plugin = plugin;
    this.text = text;           // Исходный текст для обработки
    this.editor = editor;       // Редактор для последующей вставки
  }

  // Вызывается при открытии модального окна: создаём всё содержимое интерфейса
  // Структура окна:
  // 1) Заголовок и информация о тексте
  // 2) Сетка кнопок быстрых режимов
  // 3) Разделитель "или свой промпт"
  // 4) Текстовое поле + кнопки "Выполнить"/"Отмена"
  onOpen() {
    const { contentEl } = this;
    
    // === Заголовок окна ===
    contentEl.createEl('h2', { text: 'AI Assistant' });
    
    // === Информация о тексте (превью) ===
    // Показываем длину текста, чтобы пользователь понимал объём обработки
    const infoEl = contentEl.createEl('p');
    infoEl.style.cssText = 'color: var(--text-muted); font-size: 12px; margin-bottom: 16px;';
    infoEl.setText(`Обработка текста: ${this.text.length} символов`);
    
    // === Получаем все доступные режимы (встроенные + кастомные из настроек) ===
    const allModes = getAllModes(this.plugin.settings.customPrompts);
    
    // === БЛОК 1: Кнопки быстрых режимов ===
    const quickModesContainer = contentEl.createDiv();
    quickModesContainer.style.cssText = 'margin-bottom: 20px;';
    
    // Подзаголовок секции
    quickModesContainer.createEl('h4', { 
      text: 'Быстрые режимы:',
      style: 'margin-bottom: 10px; color: var(--text-normal);'
    });
    
    // Сетка кнопок: адаптивная, переносится на новую строку при нехватке места
    const buttonsGrid = quickModesContainer.createDiv();
    buttonsGrid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px;';
    
    // Создаём кнопку для каждого режима
    Object.values(allModes).forEach(mode => {
      const btn = new ButtonComponent(buttonsGrid);
      btn.setButtonText(mode.label);
      btn.setClass('mod-cta'); // Стиль основной кнопки в Obsidian
      btn.onClick(async () => {
        this.close(); // Закрываем модальное окно перед обработкой
        await this.processMode(mode.id); // Запускаем обработку выбранного режима
      });
    });

    // === БЛОК 2: Разделитель "или свой промпт" ===
    // Визуально отделяем предопределённые режимы от поля свободного ввода
    const divider = contentEl.createEl('div');
    divider.style.cssText = `
      display: flex;
      align-items: center;
      margin: 20px 0;
      color: var(--text-faint);
      font-size: 12px;
    `;
    // Левая линия
    divider.createEl('div', { style: 'flex: 1; height: 1px; background: var(--background-modifier-border);' });
    // Текст по центру
    divider.createEl('span', { text: 'или свой промпт', style: 'padding: 0 10px;' });
    // Правая линия
    divider.createEl('div', { style: 'flex: 1; height: 1px; background: var(--background-modifier-border);' });

    // === БЛОК 3: Поле для своего промпта ===
    const customContainer = contentEl.createDiv();
    
    // Подпись к полю ввода
    const label = customContainer.createEl('label');
    label.style.cssText = 'display: block; margin-bottom: 8px; font-weight: 500; color: var(--text-normal);';
    label.setText('Или введите свой запрос:');
    
    // Текстовое поле (textarea) для произвольного промпта
    const customInput = customContainer.createEl('textarea');
    customInput.placeholder = 'Например: Переведи на английский, выдели ключевые идеи...';
    customInput.style.cssText = `
      width: 100%;
      min-height: 100px;
      padding: 10px;
      margin-bottom: 12px;
      border: 1px solid var(--background-modifier-border);
      border-radius: 6px;
      background: var(--background-primary);
      color: var(--text-normal);
      font-family: var(--font-default);
      font-size: 13px;
      resize: vertical;
      box-sizing: border-box;
    `;
    
    // Автофокус на поле при открытии окна (небольшая задержка повышает надёжность в Electron)
    setTimeout(() => customInput.focus(), 100);
    
    // Обработка нажатия клавиш в поле ввода:
    // • Enter (без Shift) → отправить запрос
    // • Shift+Enter → новая строка (стандартное поведение textarea)
    customInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); // Предотвращаем вставку переноса строки
        if (customInput.value.trim()) {
          this.close();
          this.processCustom(customInput.value.trim());
        }
      }
    });

    // === Кнопки действий ===
    const buttonsWrapper = customContainer.createDiv();
    buttonsWrapper.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end;';
    
    // Кнопка "Выполнить"
    const executeBtn = new ButtonComponent(buttonsWrapper);
    executeBtn.setButtonText('Выполнить');
    executeBtn.setClass('mod-cta');
    executeBtn.setDisabled(true); // Изначально неактивна, пока поле пустое
    
    // Включаем кнопку, когда пользователь ввёл текст
    customInput.addEventListener('input', () => {
      const hasText = customInput.value.trim().length > 0;
      executeBtn.setDisabled(!hasText);
    });
    
    executeBtn.onClick(() => {
      if (customInput.value.trim()) {
        this.close();
        this.processCustom(customInput.value.trim());
      }
    });

    // Кнопка "Отмена"
    const cancelBtn = new ButtonComponent(buttonsWrapper);
    cancelBtn.setButtonText('Отмена');
    cancelBtn.setClass('mod-secondary'); // Вторичный стиль (серая кнопка)
    cancelBtn.onClick(() => this.close());
  }

  // Обрабатывает выбор предопределённого режима (кнопки "Исправить", "Конспект" и т.д.)
  // Логика:
  // 1) Ищем открытую панель чата (чтобы показать прогресс там)
  // 2) Если чат открыт — используем его UI
  // 3) Если чат закрыт — работаем автономно, через уведомления/модалку
  async processMode(modeId) {
    // Ищем открытую панель чата по типу представления
    const view = this.app.workspace.getLeavesOfType(CONSTANTS.VIEW_TYPE_AI)[0]?.view;
    
    if (view && view.constructor.name === 'AIChatView') {
      // Чат открыт — используем общую функцию обработки с интеграцией в UI чата
      await processQuickAction({
        plugin: this.plugin,
        modeId,
        text: this.text,
        editor: this.editor,
        // Определяем источник текста: выделение или весь файл
        sourceType: this.text === this.editor.getSelection() ? 'selection' : 'full-file',
        // Берём текущее поведение вставки из чата (или дефолтное)
        insertBehavior: view.insertBehavior || 'modal',
        // Колбэк для обновления интерфейса чата
        onUpdateUI: (type, data) => {
          if (type === 'user' || type === 'assistant') {
            view.addMessageToUI(type, data);
          } else if (type === 'loading') {
            view.setLoading(data);
          }
        }
      });
    } else {
      // Чат не открыт — просто уведомляем и обрабатываем без привязки к UI
      new Notice('Откройте панель AI Chat, чтобы видеть историю диалога');
      await processQuickAction({
        plugin: this.plugin,
        modeId,
        text: this.text,
        editor: this.editor,
        sourceType: this.text === this.editor.getSelection() ? 'selection' : 'full-file',
        insertBehavior: 'modal' // По умолчанию спрашиваем, как вставить
      });
    }
  }

  // Обрабатывает пользовательский промпт (свободный ввод).
  // Работает и с открытым чатом, и без него.
  async processCustom(prompt) {
    // Валидация: промпт не должен быть пустым
    if (!prompt || prompt.trim().length === 0) {
      new Notice('Введите промпт');
      return;
    }
    
    // Ищем открытую панель чата
    const view = this.app.workspace.getLeavesOfType(CONSTANTS.VIEW_TYPE_AI)[0]?.view;
    const hasChat = view && view.constructor.name === 'AIChatView';

    // Если чат открыт — показываем запрос там
    if (hasChat) {
      view.addMessageToUI('user', `Свой промпт: ${prompt}\n\n${this.text.slice(0, 100)}${this.text.length > 100 ? '...' : ''}`);
      view.setLoading(true);
    } else {
      // Если чат закрыт — показываем уведомление о начале обработки
      new Notice('Обрабатываю запрос...');
    }

    try {
      // Формируем промпт для модели: системная инструкция + задача + контекст
      const fullPrompt = composePrompt({
        systemPrompt: SYSTEM_PROMPT,
        taskInstruction: prompt, // Пользовательская инструкция
        context: this.text       // Исходный текст из редактора
      });
      
      // Готовим тело запроса в формате OpenAI-compatible
      const payload = {
        model: this.plugin.settings.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: fullPrompt }
        ],
        max_tokens: this.plugin.settings.maxTokens,
        temperature: this.plugin.settings.temperature
      };

      // Отправляем запрос к API
      const response = await sendToAI({
        apiUrl: CONSTANTS.API_URL,
        apiKey: this.plugin.settings.apiKey,
        payload
      });

      if (response) {
        if (hasChat) {
          // Чат открыт — показываем ответ там и открываем окно вставки
          view.addMessageToUI('assistant', response);
          const { InsertModeModal } = require('./insert-modal.js');
          new InsertModeModal(this.app, response, this.text, this.editor).open();
        } else {
          // Чат закрыт: показываем ответ в отдельном модальном окне
          this.showResponseInModal(response);
        }
      }
    } catch (error) {
      console.error('Custom mode failed:', error);
      new Notice(`Ошибка: ${error.message}`);
      if (hasChat) {
        view.addMessageToUI('assistant', `Ошибка: ${error.message}`);
      }
    } finally {
      if (hasChat) {
        view.setLoading(false);
      }
    }
  }

  // Показывает ответ в модальном окне, если чат закрыт.
  // Если был выделен текст — предлагаем заменить выделение, иначе — вставить после курсора.
  showResponseInModal(response) {
    const modal = new Modal(this.app);
    
    // Проверяем, было ли выделение в момент вызова
    const hadSelection = this.editor && this.editor.getSelection().trim().length > 0;
    
    modal.onOpen = () => {
      const { contentEl } = modal;
      
      // Заголовок зависит от того, было ли выделение
      contentEl.createEl('h3', { 
        text: hadSelection ? 'Заменить выделение?' : 'Ответ готов'
      });
      
      // Превью ответа с прокруткой
      const preview = contentEl.createDiv();
      preview.style.cssText = `
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        padding: 12px;
        margin: 15px 0;
        max-height: 200px;
        overflow-y: auto;
        white-space: pre-wrap;
        font-family: var(--font-monospace);
        font-size: 12px;
        color: var(--text-normal);
      `;
      preview.setText(response);
      
      // Подсказка: что произойдёт при вставке
      const hint = contentEl.createEl('p');
      hint.style.cssText = 'color: var(--text-muted); font-size: 11px; margin-bottom: 15px;';
      hint.setText(hadSelection 
        ? 'Выделенный текст будет заменён на этот ответ.'
        : 'Текст будет вставлен после курсора.');
      
      // Кнопки действий
      const buttons = contentEl.createDiv();
      buttons.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end; margin-top: 10px;';
      
      // Кнопка "Копировать" (всегда доступна)
      new ButtonComponent(buttons)
        .setButtonText('Копировать')
        .onClick(async () => {
          try {
            await navigator.clipboard.writeText(response);
            new Notice('Скопировано в буфер обмена');
          } catch (e) {
            new Notice('Не удалось скопировать в буфер обмена');
          }
        });
      
      // Кнопка вставки: меняет текст и действие в зависимости от выделения
      if (this.editor) {
        const insertBtn = new ButtonComponent(buttons);
        
        if (hadSelection) {
          // Есть выделение: заменяем его на ответ
          insertBtn
            .setButtonText('Заменить выделение')
            .setClass('mod-cta')
            .onClick(() => {
              // replaceSelection автоматически заменяет выделенный текст
              this.editor.replaceSelection(response);
              modal.close();
              new Notice('Выделение заменено');
            });
        } else {
          // Нет выделения: вставляем после курсора
          insertBtn
            .setButtonText('Вставить после')
            .setClass('mod-cta')
            .onClick(() => {
              // Получаем текущую позицию курсора
              const cursor = this.editor.getCursor();
              // Устанавливаем курсор в ту же позицию (снимаем выделение если было)
              this.editor.setSelection(cursor, cursor);
              // Вставляем ответ с разделителем
              this.editor.replaceSelection('\n\n---\n' + response);
              modal.close();
              new Notice('Текст вставлен');
            });
        }
      }
      
      // Кнопка "Отмена"
      new ButtonComponent(buttons)
        .setButtonText('Отмена')
        .setClass('mod-secondary')
        .onClick(() => modal.close());
    };
    
    modal.open();
  }

  // Вызывается при закрытии окна: очищаем ресурсы.
  // Важно: без этого метода в DOM могут остаться "висячие" элементы.
  onClose() {
    const { contentEl } = this;
    contentEl.empty(); // Удаляем всё содержимое модального окна
  }
}

// Экспортируем класс для использования в других модулях
module.exports = { QuickModeModal };
