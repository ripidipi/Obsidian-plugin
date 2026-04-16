// Вспомогательные функции для создания и настройки HTML-элементов
// Зачем это нужно?
// 1) Чтобы не повторять один и тот же код создания элементов в разных местах
// 2) Чтобы сделать код чище: createStyledDiv() понятнее, чем 5 строк с style.property
// 3) Чтобы студентам было проще: одна функция = одна задача

/**
 * Создаёт HTML-элемент с заданными стилями и классами
 * Это "умный" createElement: сразу применяет оформление
 * 
 * @param {string} tagName - Имя тега: 'div', 'button', 'span' и т.д.
 * @param {Object} options - Настройки элемента
 * @param {string} [options.text] - Текстовое содержимое
 * @param {string} [options.className] - CSS-классы (через пробел)
 * @param {Object} [options.styles] - CSS-свойства: { color: 'red', padding: '10px' }
 * @param {Object} [options.attrs] - HTML-атрибуты: { id: 'my-id', 'data-value': '123' }
 * @param {Function} [options.onClick] - Обработчик клика
 * @returns {HTMLElement} - Созданный элемент
 * 
 * @example
 * const btn = createEl('button', {
 *   text: 'Нажми меня',
 *   className: 'mod-cta',
 *   styles: { padding: '8px 16px' },
 *   onClick: () => console.log('Клик!')
 * });
 */
function createEl(tagName, options = {}) {
  const el = document.createElement(tagName);
  
  // Устанавливаем текстовое содержимое (безопасно, без интерпретации HTML)
  if (options.text !== undefined) {
    el.textContent = options.text;
  }
  
  // Добавляем CSS-классы
  if (options.className) {
    el.className = options.className;
  }
  
  // Применяем инлайн-стили
  if (options.styles) {
    Object.assign(el.style, options.styles);
  }
  
  // Устанавливаем атрибуты (включая data-* и aria-*)
  if (options.attrs) {
    for (const [key, value] of Object.entries(options.attrs)) {
      el.setAttribute(key, value);
    }
  }
  
  // Вешаем обработчик клика, если передан
  if (typeof options.onClick === 'function') {
    el.addEventListener('click', options.onClick);
  }
  
  return el;
}

/**
 * Создаёт контейнер-обёртку с флекс-настройками
 * Частая задача в интерфейсе: "сделать строку с кнопками" или "колонку с элементами"
 * 
 * @param {Object} options - Настройки контейнера
 * @param {'row'|'column'} [options.direction='column'] - Направление флекса
 * @param {string} [options.align='stretch'] - Выравнивание по поперечной оси
 * @param {string} [options.justify='flex-start'] - Выравнивание по главной оси
 * @param {string} [options.gap='8px'] - Отступы между элементами
 * @param {Object} [options.rest] - Остальные опции для createEl()
 * @returns {HTMLElement} - Настроенный flex-контейнер
 * 
 * @example
 * const toolbar = createFlexContainer({
 *   direction: 'row',
 *   justify: 'space-between',
 *   align: 'center',
 *   className: 'ai-toolbar'
 * });
 */
function createFlexContainer({ 
  direction = 'column', 
  align = 'stretch', 
  justify = 'flex-start', 
  gap = '8px',
  ...rest 
} = {}) {
  return createEl('div', {
    styles: {
      display: 'flex',
      flexDirection: direction,
      alignItems: align,
      justifyContent: justify,
      gap: gap
    },
    ...rest
  });
}

/**
 * Создаёт элемент с анимацией появления (fade-in)
 * Полезно для плавного добавления сообщений в чат
 * 
 * @param {string} tagName - Тег элемента
 * @param {Object} options - Опции для createEl()
 * @param {number} [options.delay=0] - Задержка перед появлением (мс)
 * @returns {HTMLElement} - Элемент с применённой анимацией
 */
function createFadeInEl(tagName, options = {}) {
  const el = createEl(tagName, options);
  
  // Начальное состояние: невидимый и слегка сдвинутый
  el.style.opacity = '0';
  el.style.transform = 'translateY(8px)';
  el.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
  
  // Запускаем анимацию после добавления в DOM
  setTimeout(() => {
    if (el.isConnected) {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }
  }, options.delay || 0);
  
  return el;
}

/**
 * Безопасно очищает элемент от всех дочерних узлов
 * Альтернатива innerHTML = '' — работает быстрее и безопаснее
 * 
 * @param {HTMLElement} el - Элемент для очистки
 */
function emptyEl(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

/**
 * Добавляет элемент в конец родителя с анимацией появления
 * Удобно для добавления новых сообщений в чат
 * 
 * @param {HTMLElement} parent - Родительский контейнер
 * @param {HTMLElement} child - Добавляемый элемент
 * @param {boolean} [withAnimation=true] - Проигрывать ли анимацию
 * @param {boolean} [scrollIntoView=true] - Прокрутить ли контейнер к новому элементу
 */
function appendWithAnimation(parent, child, withAnimation = true, scrollIntoView = true) {
  if (withAnimation && child.style) {
    child.style.opacity = '0';
    child.style.transform = 'translateY(4px)';
  }
  
  parent.appendChild(child);
  
  // Запускаем анимацию после вставки в DOM
  if (withAnimation && child.style) {
    // Небольшая задержка, чтобы браузер применил начальные стили
    requestAnimationFrame(() => {
      child.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
      child.style.opacity = '1';
      child.style.transform = 'translateY(0)';
    });
  }
  
  // Автопрокрутка вниз, если нужно
  if (scrollIntoView && parent.scrollTo) {
    parent.scrollTo({
      top: parent.scrollHeight,
      behavior: 'smooth'
    });
  }
}

/**
 * Создаёт индикатор загрузки с "прыгающими точками"
 * Переиспользуемый компонент для любых асинхронных операций
 * 
 * @param {Object} options - Настройки
 * @param {string} [options.color='var(--text-muted)'] - Цвет точек
 * @param {number} [options.size=8] - Размер точек в пикселях
 * @returns {HTMLElement} - Контейнер с анимацией
 */
function createLoadingDots({ color = 'var(--text-muted)', size = 8 } = {}) {
  const container = createEl('div', {
    styles: {
      display: 'flex',
      gap: '4px',
      justifyContent: 'center',
      padding: '8px'
    }
  });
  
  // Создаём три точки с разной задержкой анимации
  for (let i = 0; i < 3; i++) {
    const dot = createEl('div', {
      styles: {
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: color,
        animation: `bounce 1.4s infinite ease-in-out ${i * 0.16}s`
      }
    });
    container.appendChild(dot);
  }
  
  // Добавляем CSS-анимацию в документ, если ещё не добавлена
  const styleId = 'ai-loading-keyframes';
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
  
  return container;
}

module.exports = {
  createEl,
  createFlexContainer,
  createFadeInEl,
  emptyEl,
  appendWithAnimation,
  createLoadingDots
};