/**
 * Модальное окно выбора способа вставки результата в заметку.
 *
 * Открывается после получения ответа от модели и позволяет:
 * - посмотреть превью ответа перед вставкой;
 * - выбрать действие (заменить выделение / вставить после / вставить блоком / заменить весь файл).
 */

const { Modal, ButtonComponent, Notice } = require('obsidian');

class InsertModeModal extends Modal {
  // Конструктор получает ответ модели, исходный текст и редактор
  constructor(app, response, originalText, editor) {
    super(app);
    this.response = response;       // Ответ от AI
    this.originalText = originalText; // Исходный текст (для контекста)
    this.editor = editor;           // Редактор для вставки
  }

  // Вызывается при открытии модального окна: создаём содержимое
  onOpen() {
    const { contentEl } = this;
    
    contentEl.createEl('h3', { text: 'Как вставить результат?' });
    
    // === Превью ответа ===
    // Показываем начало ответа, чтобы пользователь понимал, что вставляется
    const previewContainer = contentEl.createDiv();
    previewContainer.style.cssText = `
      background: var(--background-primary);
      border: 1px solid var(--background-modifier-border);
      border-radius: 6px;
      padding: 10px;
      margin-bottom: 15px;
      max-height: 120px;
      overflow-y: auto;
      overflow-x: hidden;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: var(--font-monospace);
      font-size: 12px;
      color: var(--text-muted);
      line-height: 1.4;
    `;

    // Формируем текст превью: обрезаем если длинный, добавляем счётчик
    const PREVIEW_LIMIT = 200;
    const previewText = this.response.length > PREVIEW_LIMIT
      ? this.response.slice(0, PREVIEW_LIMIT) + '\n... [ещё ' + (this.response.length - PREVIEW_LIMIT) + ' символов]'
      : this.response;

    previewContainer.setText(previewText);
    
    // Подсказка под превью
    const hint = previewContainer.createEl('small');
    hint.style.cssText = 'display: block; margin-top: 6px; text-align: right; opacity: 0.7;';
    hint.setText('Прокрути для просмотра полного ответа');

    // Описание выбора
    const description = contentEl.createEl('p');
    description.style.cssText = 'color: var(--text-muted); margin-bottom: 15px; font-size: 13px;';
    description.setText('Выберите способ вставки обработанного текста в заметку');

    // Контейнер для кнопок
    const buttonsContainer = contentEl.createDiv();
    buttonsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px;';

    // Варианты вставки
    const modes = [
      { 
        id: 'replace_selection', 
        label: 'Заменить выделение', 
        desc: 'Заменить выделенный текст на результат' 
      },
      { 
        id: 'append', 
        label: 'Добавить после', 
        desc: 'Добавить результат после исходного текста' 
      },
      { 
        id: 'block', 
        label: 'Вставить блоком', 
        desc: 'Добавить с заголовком "AI" и разделителем'
      },
      { 
        id: 'replace_file', 
        label: 'Заменить весь файл', 
        desc: 'Полностью перезаписать содержимое заметки (старый текст удалится)'
      }
    ];

    // Создаём кнопки для каждого режима
    modes.forEach(({ id, label, desc }) => {
      const btnWrapper = buttonsContainer.createDiv();
      btnWrapper.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
      
      const btn = new ButtonComponent(btnWrapper);
      btn.setButtonText(label);
      btn.setClass('mod-cta');
      
      // Визуально выделяем "опасную" кнопку замены файла
      if (id === 'replace_file') {
        btn.buttonEl.style.borderColor = 'var(--text-warning)';
        btn.buttonEl.style.color = 'var(--text-warning)';
        btn.buttonEl.style.fontWeight = '500';
      }
      
      btn.onClick(() => {
        this.insertWithMode(id);
        this.close();
      });
      
      // Подпись с описанием режима
      const descEl = btnWrapper.createEl('small');
      descEl.style.cssText = 'color: var(--text-muted); font-size: 11px;';
      descEl.setText(desc);
    });

    // Кнопка отмены
    new ButtonComponent(contentEl)
      .setButtonText('Отмена')
      .setClass('mod-secondary')
      .onClick(() => this.close());
  }

  // Выполняет вставку в зависимости от выбранного режима
  insertWithMode(mode) {
    if (!this.editor) {
      new Notice('Нет активного редактора');
      return;
    }

    switch(mode) {
      case 'replace_selection':
        // Заменяем выделенный текст (или вставляем в позицию курсора)
        this.editor.replaceSelection(this.response);
        break;
        
      case 'append':
        // Добавляем после исходного текста с разделителем
        this.editor.replaceSelection('\n\n---\n' + this.response);
        break;
        
      case 'block':
        // Вставляем как отдельный блок с заголовком
        this.editor.replaceSelection('\n\n---\n### AI\n' + this.response);
        break;
        
      case 'replace_file':
        // Полная замена содержимого файла
        // setValue заменяет весь текст в редакторе целиком
        // Примечание: это действие очищает историю отмен (Undo) в редакторе
        this.editor.setValue(this.response);
        new Notice('Содержимое файла полностью заменено');
        break;
    }
    
    new Notice('Текст вставлен');
  }
}

module.exports = { InsertModeModal };
