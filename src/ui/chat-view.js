/**
 * Панель чата в боковой панели Obsidian.
 *
 * Здесь собран весь UI чата:
 * - список сообщений и индикатор загрузки;
 * - быстрые режимы (кнопки "Исправить", "Конспект" и т.д.);
 * - переключатели (контекст и поведение вставки);
 * - поле ввода и отправка;
 * - кнопка копирования для ответов ассистента.
 */

const { ItemView, Notice, ButtonComponent } = require('obsidian');
const CONSTANTS = require('../constants.js');
const { sendToAI } = require('../ai/client.js');
const { composePrompt, getTaskInstruction, getAllModes, SYSTEM_PROMPT } = require('../ai/prompts.js');
const { processQuickAction } = require('../ai/modes.js');
const { getActiveEditor, extractText } = require('../utils/editor.js');
const { InsertModeModal } = require('./insert-modal.js');

class AIChatView extends ItemView {
  // Конструктор получает leaf (контейнер в рабочей области) и plugin
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    
    // Состояние компонента:
    this.chatHistory = [];        // История сообщений для поддержания контекста диалога
    this.useContext = true;       // Флаг: использовать ли текст из редактора как контекст
    this.isLoading = false;       // Флаг: идёт ли сейчас запрос к AI
    this.currentLoadingEl = null; // Ссылка на элемент индикатора загрузки (для удаления)
    
    // Текущее поведение вставки:
    // 'modal' — спрашивать каждый раз, 'append' — сразу в конец файла, 'chat' — только в чат.
    this.insertBehavior = this.plugin.settings.insertBehavior || 'modal';
  }

  // Возвращает тип представления — должен совпадать с зарегистрированным в plugin.onload()
  getViewType() {
    return CONSTANTS.VIEW_TYPE_AI;
  }

  // Текст, который отображается во вкладке (если панелей несколько)
  getDisplayText() {
    return 'AI Chat';
  }

  // Вызывается при открытии представления: создаём всю структуру интерфейса
  async onOpen() {
    const container = this.containerEl.children[1]; // Obsidian добавляет обёртку, нам нужен внутренний элемент
    container.empty();
    
    // Настраиваем контейнер на всю высоту и вертикальную прокрутку
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.height = '100%';

    // Создаём подкомпоненты по порядку сверху вниз:
    this.setupChatArea(container);        // Область с сообщениями
    this.setupQuickModes(container);      // Кнопки быстрых действий
    this.setupControls(container);        // Переключатели (контекст + поведение вставки)
    this.setupInputArea(container);       // Поле ввода и кнопка отправки

    // Загружаем сохранённую историю из настроек плагина
    if (this.plugin.chatHistory && this.plugin.chatHistory.length > 0) {
      for (const msg of this.plugin.chatHistory) {
        this.addMessageToUI(msg.role, msg.content);
      }
    }
  }

  // Создаёт область для отображения истории чата
  setupChatArea(container) {
    this.chatEl = container.createDiv();
    this.chatEl.style.flex = '1';              // Занимает всё доступное место
    this.chatEl.style.overflowY = 'auto';      // Вертикальная прокрутка при переполнении
    this.chatEl.style.padding = '10px';
    this.chatEl.style.display = 'flex';
    this.chatEl.style.flexDirection = 'column';
    this.chatEl.style.gap = '8px';
  }

  // Создаёт панель кнопок быстрых режимов
  setupQuickModes(container) {
    const modesContainer = container.createDiv();
    modesContainer.style.padding = '8px 10px';
    modesContainer.style.borderBottom = '1px solid var(--background-modifier-border)';
    modesContainer.style.display = 'flex';
    modesContainer.style.flexWrap = 'wrap';    // Кнопки переносятся на новую строку
    modesContainer.style.gap = '6px';

    // Получаем все режимы (встроенные + пользовательские из настроек)
    const allModes = getAllModes(this.plugin.settings.customPrompts);

    // Создаём кнопку для каждого режима
    Object.values(allModes).forEach(mode => {
      const btn = modesContainer.createEl('button', {
        text: mode.label,
        cls: 'ai-quick-btn'
      });
      
      // Стилизация в духе Obsidian (используем CSS-переменные темы)
      btn.style.padding = '4px 10px';
      btn.style.borderRadius = '6px';
      btn.style.border = '1px solid var(--background-modifier-border)';
      btn.style.background = 'var(--background-secondary)';
      btn.style.cursor = 'pointer';
      btn.style.fontSize = '12px';
      
      // При клике — запускаем обработку режима
      btn.onclick = () => this.quickActionFromChat(mode.id);
    });
  }

  // Создаёт панель управления: контекст + поведение вставки
  setupControls(container) {
    const controls = container.createDiv();
    controls.style.padding = '5px 10px';
    controls.style.borderBottom = '1px solid var(--background-modifier-border)';
    controls.style.display = 'flex';
    controls.style.justifyContent = 'space-between';
    controls.style.alignItems = 'center';
    controls.style.flexWrap = 'wrap'; // Чтобы элементы переносились на маленьких экранах
    controls.style.gap = '8px';

    // === Левая часть: переключатель контекста ===
    const toggleBtn = controls.createEl('button', {
      text: `Контекст: ${this.useContext ? 'включен' : 'выключен'}`
    });
    toggleBtn.style.fontSize = '12px';
    toggleBtn.style.padding = '4px 8px';

    toggleBtn.onclick = () => {
      this.useContext = !this.useContext;
      const stateLabel = this.useContext ? 'включен' : 'выключен';
      toggleBtn.textContent = `Контекст: ${stateLabel}`;
      new Notice(`Контекст: ${stateLabel}`);
    };

    // === Правая часть: переключатель поведения вставки ===
    const behaviorContainer = controls.createDiv();
    behaviorContainer.style.display = 'flex';
    behaviorContainer.style.alignItems = 'center';
    behaviorContainer.style.gap = '4px';

    behaviorContainer.createEl('small', { 
      text: 'Вставка:', 
      cls: 'ai-control-label' 
    });

    // Выпадающий список с тремя опциями
    const behaviorSelect = behaviorContainer.createEl('select');
    behaviorSelect.style.fontSize = '12px';
    behaviorSelect.style.padding = '4px 8px';
    behaviorSelect.style.borderRadius = '4px';
    behaviorSelect.style.border = '1px solid var(--background-modifier-border)';
    behaviorSelect.style.background = 'var(--background-secondary)';
    behaviorSelect.style.color = 'var(--text-normal)';

    // Добавляем опции
    const options = [
      { value: 'modal', label: 'Спрашивать' },
      { value: 'append', label: 'В конец' },
      { value: 'chat', label: 'Только чат' }
    ];

    options.forEach(opt => {
      const option = behaviorSelect.createEl('option', {
        value: opt.value,
        text: opt.label
      });
      // Выбираем текущее значение
      if (opt.value === this.insertBehavior) {
        option.selected = true;
      }
    });

    // Обработчик изменения: сохраняем выбор в локальное состояние
    behaviorSelect.onchange = (e) => {
      this.insertBehavior = e.target.value;
      new Notice(`Режим вставки: ${options.find(o => o.value === this.insertBehavior)?.label}`);
    };
  }

  // Создаёт область ввода сообщения и кнопку отправки
  setupInputArea(container) {
    const inputWrapper = container.createDiv();
    inputWrapper.style.display = 'flex';
    inputWrapper.style.padding = '10px';
    inputWrapper.style.borderTop = '1px solid var(--background-modifier-border)';
    inputWrapper.style.gap = '8px';

    // Текстовое поле для ввода
    this.input = inputWrapper.createEl('textarea');
    this.input.style.flex = '1';
    this.input.style.resize = 'none';           // Запрещаем ручное изменение размера
    this.input.style.minHeight = '60px';
    this.input.placeholder = 'Напиши сообщение или /fix /summary /explain';

    // Кнопка отправки
    const sendBtn = inputWrapper.createEl('button', { text: '➤' });
    sendBtn.onclick = () => this.handleSend();

    // Обработка нажатия Enter: отправить, Shift+Enter — новая строка
    this.input.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); // Предотвращаем стандартное поведение (новая строка)
        await this.handleSend();
      }
    });
  }

  // Обрабатывает нажатие на кнопку быстрого режима из чата
  async quickActionFromChat(modeId) {
    const editor = getActiveEditor(this.app);
    if (!editor) {
      new Notice('Нет активного редактора');
      return;
    }
    
    // === Шаг 1: Пробуем получить выделенный текст ===
    let context = editor.getSelection();
    let sourceType = 'selection';
    
    // === Шаг 2: Если выделения нет — берём весь файл ===
    if (!context || context.trim().length === 0) {
      // Берём всё содержимое файла, но ограничиваем по настройкам (защита от переполнения)
      context = editor.getValue();
      const DEFAULT_CONTEXT_LIMIT = 4000;
      const limit = this.plugin.settings.contextLimit || DEFAULT_CONTEXT_LIMIT;
      
      if (context.length > limit) {
        // Если файл очень большой — берём только начало + уведомляем
        context = context.slice(0, limit);
        new Notice(`Файл большой: обрабатываю первые ${limit} символов`);
      }
      
      sourceType = 'full-file';
    }
    
    // Финальная проверка: если всё равно пусто — файл пустой
    if (!context || context.trim().length === 0) {
      new Notice('Файл пустой: нечего обрабатывать');
      return;
    }
    
    // Передаём в обработку: текст + информацию об источнике (для отладки/уведомлений)
    await processQuickAction({
      plugin: this.plugin,
      modeId,
      text: context,
      editor,
      sourceType, // 'selection' | 'full-file' (информация об источнике текста)
      insertBehavior: this.insertBehavior,
      onUpdateUI: (type, data) => {
        if (type === 'user' || type === 'assistant') {
          // Показываем источник текста в первом сообщении для наглядности
          if (type === 'user' && !data.startsWith('[')) {
            const sourceLabel = sourceType === 'full-file' ? 'Файл' : 'Выделение';
            this.addMessageToUI(type, `${sourceLabel}: ${data.slice(0, 200)}${data.length > 200 ? '...' : ''}`);
          } else {
            this.addMessageToUI(type, data);
          }
        } else if (type === 'loading') {
          this.setLoading(data);
        }
      }
    });
  }

  // Включает/выключает состояние загрузки: блокирует ввод, показывает индикатор
  setLoading(loading) {
    this.isLoading = loading;
    
    if (loading) {
      this.input.disabled = true;
      this.addLoadingIndicator();
    } else {
      this.input.disabled = false;
      this.removeLoadingIndicator();
    }
  }

  // Добавляет анимированный индикатор "печатает..."
  addLoadingIndicator() {
    const loadingEl = this.chatEl.createDiv();
    loadingEl.className = 'ai-loading-indicator';
    loadingEl.style.padding = '10px 14px';
    loadingEl.style.background = 'var(--background-secondary)';
    loadingEl.style.borderRadius = '12px';
    loadingEl.style.margin = '6px 0';
    loadingEl.style.maxWidth = '85%';
    loadingEl.style.marginRight = 'auto';
    
    // Контейнер для трёх "прыгающих" точек
    const dots = loadingEl.createDiv();
    dots.style.display = 'flex';
    dots.style.gap = '4px';
    dots.style.justifyContent = 'center';
    
    // Создаём три точки с задержкой анимации для эффекта волны
    for (let i = 0; i < 3; i++) {
      const dot = dots.createDiv();
      dot.style.width = '8px';
      dot.style.height = '8px';
      dot.style.borderRadius = '50%';
      dot.style.background = 'var(--text-muted)';
      dot.style.animation = `bounce 1.4s infinite ease-in-out ${i * 0.16}s`;
    }
    
    // Добавляем CSS-анимацию, если ещё не добавлена
    const styleId = 'ai-loading-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `;
      document.head.appendChild(style);
    }
    
    this.chatEl.scrollTop = this.chatEl.scrollHeight; // Прокрутка вниз
    this.currentLoadingEl = loadingEl; // Сохраняем ссылку для последующего удаления
  }

  // Удаляет индикатор загрузки
  removeLoadingIndicator() {
    if (this.currentLoadingEl) {
      this.currentLoadingEl.remove();
      this.currentLoadingEl = null;
    }
  }

  // Обрабатывает отправку сообщения пользователем (обычный чат)
  async handleSend() {
    const rawInput = this.input.value.trim();
    if (!rawInput) return;

    this.addMessageToUI('user', rawInput);
    this.input.value = '';
    this.setLoading(true);

    try {
      const context = await extractText({
        editor: getActiveEditor(this.app),
        useContext: this.useContext,
        contextLimit: this.plugin.settings.contextLimit
      });
      
      const mode = this.detectMode(rawInput);
      const cleanInput = rawInput.replace(/^\/\w+\s*/, '').trim();
      
      const requestPayload = this.composeRequestPayload(cleanInput, context, mode);
      const response = await sendToAI({
        apiUrl: CONSTANTS.API_URL,
        apiKey: this.plugin.settings.apiKey,
        payload: requestPayload
      });

      if (response) {
        // 1. Всегда показываем ответ в чате
        this.addMessageToUI('assistant', response);
        this.updateHistory(cleanInput, response);
        
        // 2. Обрабатываем вставку в файл согласно настройке
        const editor = getActiveEditor(this.app);
        
        if (this.insertBehavior === 'append' && editor) {
          // === Вариант: Сразу в конец файла ===
          const cursor = editor.getSelection().length > 0 
            ? editor.getCursor('to') 
            : editor.getCursor();
          editor.setSelection(cursor, cursor);
          editor.replaceSelection('\n\n---\n' + response);
          new Notice('Текст добавлен в конец файла');
          
        } else if (this.insertBehavior === 'modal' && editor) {
          // === Вариант: Спросить пользователя (как в быстрых действиях) ===
          // Небольшая задержка, чтобы сообщение в чате успело отрисоваться
          setTimeout(() => {
            new InsertModeModal(this.app, response, cleanInput, editor).open();
          }, 100);
          
        } else {
          // === Вариант: Только чат ===
          // Ничего не делаем, ответ уже в интерфейсе
          new Notice('Ответ в чате. Для копирования нажмите "Копировать" у сообщения');
        }
      }
    } catch (error) {
      console.error('AI Request failed:', error);
      new Notice('Ошибка: ' + error.message);
      this.addMessageToUI('assistant', 'Ошибка: ' + error.message);
    } finally {
      this.setLoading(false);
    }
  }

  // Определяет режим по префиксу сообщения: /fix → 'fix'
  detectMode(text) {
    if (text.startsWith('/fix')) return 'fix';
    if (text.startsWith('/summary')) return 'summary';
    if (text.startsWith('/explain')) return 'explain';
    if (text.startsWith('/rewrite')) return 'rewrite';
    return 'normal'; // Обычный чат без специального режима
  }

  // Собирает тело запроса к AI с учётом режима, контекста и истории
  composeRequestPayload(userInput, context, mode) {
    // Формируем итоговый промпт через вспомогательную функцию
    const taskInstruction = getTaskInstruction(mode, userInput);
    const finalPrompt = composePrompt({
      systemPrompt: SYSTEM_PROMPT,
      taskInstruction,
      context,
      history: this.chatHistory
    });

    // Возвращаем объект в формате OpenAI-compatible
    return {
      model: this.plugin.settings.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...this.chatHistory, // История диалога для поддержания контекста
        { role: 'user', content: finalPrompt }
      ],
      max_tokens: this.plugin.settings.maxTokens,
      temperature: this.plugin.settings.temperature
    };
  }

  // Добавляет сообщение в историю и ограничивает её длину (защита от переполнения)
  updateHistory(userInput, assistantResponse) {
    this.chatHistory.push(
      { role: 'user', content: userInput },
      { role: 'assistant', content: assistantResponse }
    );
    
    // Ограничиваем историю
    const MAX_HISTORY_LENGTH = this.plugin.settings.maxHistoryLength || 20;
    if (MAX_HISTORY_LENGTH > 0 && this.chatHistory.length > MAX_HISTORY_LENGTH) {
      this.chatHistory = this.chatHistory.slice(-MAX_HISTORY_LENGTH);
    }
    
    // Сохраняем в настройки плагина
    this.plugin.saveHistory();
  }

    // Добавляет сообщение в интерфейс чата
  addMessageToUI(role, text) {
    // Обёртка сообщения
    const msgWrapper = this.chatEl.createDiv();
    msgWrapper.style.cssText = 'margin: 6px 0; display: flex; flex-direction: column; gap: 4px;';

    // Отдельная строка для "пузыря" сообщения (нужно для выравнивания влево/вправо)
    const bubbleRow = msgWrapper.createDiv();
    bubbleRow.style.cssText = 'display: flex; gap: 8px; align-items: flex-start;';

    const msgEl = bubbleRow.createDiv();
    msgEl.style.cssText = `
      padding: 10px 14px;
      border-radius: 12px;
      max-width: 85%;
      white-space: pre-wrap;
      word-break: break-word;
      flex: 1;
      line-height: 1.4;
    `;

    if (role === 'user') {
      msgEl.style.background = 'var(--interactive-accent)';
      msgEl.style.color = 'var(--text-on-accent)';
      msgEl.style.marginLeft = 'auto';
      msgEl.style.borderBottomRightRadius = '4px';
    } else {
      msgEl.style.background = 'var(--background-secondary)';
      msgEl.style.marginRight = 'auto';
      msgEl.style.borderBottomLeftRadius = '4px';
      
      // Кнопка копирования для сообщений от AI
      const actionsRow = msgWrapper.createDiv();
      actionsRow.style.cssText = 'display: flex; justify-content: flex-end; opacity: 0; transition: opacity 0.2s;';

      const copyBtn = actionsRow.createEl('button');
      copyBtn.type = 'button';
      copyBtn.textContent = 'Копировать';
      copyBtn.ariaLabel = 'Копировать';
      copyBtn.title = 'Копировать в буфер обмена';
      
      copyBtn.style.cssText = `
        height: 22px;
        padding: 0 8px;
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        cursor: pointer;
        font-size: 11px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s, color 0.2s, border-color 0.2s;
        z-index: 10;
        margin: 0;
        line-height: 1;
      `;
      
      // Показываем панель действий при наведении на сообщение
      msgWrapper.onmouseenter = () => { actionsRow.style.opacity = '1'; };
      msgWrapper.onmouseleave = () => { actionsRow.style.opacity = '0'; };
      
      // Обработчик клика с двумя методами копирования (для надёжности)
      copyBtn.onclick = async (e) => {
        e.stopPropagation(); // Чтобы клик не ушёл в сообщение
        
        try {
          // Метод 1: Современный API буфера обмена
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
          } 
          // Метод 2: Fallback для старых сред / Electron
          else {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
          }
          
          // Визуальный успех
          copyBtn.disabled = true;
          copyBtn.textContent = 'Скопировано';
          copyBtn.style.background = 'var(--interactive-success)';
          setTimeout(() => {
            copyBtn.disabled = false;
            copyBtn.textContent = 'Копировать';
            copyBtn.style.background = 'var(--background-primary)';
          }, 1200);
          
        } catch (err) {
          console.error('Copy failed:', err);
          // Попытка выделить текст, если копирование не сработало
          const range = document.createRange();
          range.selectNode(msgEl);
          window.getSelection()?.removeAllRanges();
          window.getSelection()?.addRange(range);
          new Notice('Выдели текст вручную или проверь права доступа');
        }
      };
    }

    msgEl.setText(text);
    this.chatEl.scrollTop = this.chatEl.scrollHeight;
  }
}

module.exports = { AIChatView };
