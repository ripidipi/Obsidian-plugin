const { PluginSettingTab, Setting, ButtonComponent } = require('obsidian');
const { DEFAULT_SETTINGS } = require('./defaults');

class AIAssistantSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Настройки AI Assistant' });

    // ===== API Key =====
    new Setting(containerEl)
      .setName('API Key')
      .setDesc('Ключ от Hugging Face (hf_...)')
      .addText(text => text
        .setPlaceholder('hf_...')
        .setValue(this.plugin.settings.apiKey)
        .onChange(async (value) => {
          this.plugin.settings.apiKey = value;
          await this.plugin.saveSettings();
        }));

    // ===== Model =====
    new Setting(containerEl)
      .setName('Модель')
      .setDesc('Например: mistralai/Mistral-7B-Instruct-v0.3')
      .addText(text => text
        .setValue(this.plugin.settings.model)
        .onChange(async (value) => {
          this.plugin.settings.model = value;
          await this.plugin.saveSettings();
        }));

    // ===== Max Tokens =====
    new Setting(containerEl)
      .setName('Макс. токенов в ответе')
      .setDesc('Длина ответа модели')
      .addSlider(slider => slider
        .setLimits(256, 4096, 256)
        .setValue(this.plugin.settings.maxTokens)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.maxTokens = value;
          await this.plugin.saveSettings();
        }));

    // ===== Temperature =====
    new Setting(containerEl)
      .setName('Температура')
      .setDesc('0.0 = точно, 1.0 = креативно')
      .addSlider(slider => slider
        .setLimits(0, 1, 0.1)
        .setValue(this.plugin.settings.temperature)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.temperature = value;
          await this.plugin.saveSettings();
        }));

    // ===== Context Limit =====
    new Setting(containerEl)
      .setName('Лимит контекста (символы)')
      .setDesc('Макс. символов из заметки')
      .addSlider(slider => slider
        .setLimits(1000, 8000, 500)
        .setValue(this.plugin.settings.contextLimit)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.contextLimit = value;
          await this.plugin.saveSettings();
        }));

    // ===== Max History Length =====
    new Setting(containerEl)
      .setName('Размер истории чата')
      .setDesc('Сколько пар сообщений хранить (0 = без истории)')
      .addSlider(slider => slider
        .setLimits(0, 50, 5)
        .setValue(this.plugin.settings.maxHistoryLength || 20)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.maxHistoryLength = value;
          await this.plugin.saveSettings();
          // Обрезаем историю если нужно
          if (value > 0 && this.plugin.chatHistory?.length > value) {
            this.plugin.chatHistory = this.plugin.chatHistory.slice(-value);
          }
        }));

    // ===== Custom Prompts Section =====
    containerEl.createEl('h3', { text: 'Пользовательские режимы' });
    
    const customPromptsContainer = containerEl.createDiv();
    customPromptsContainer.style.marginBottom = '20px';
    
    // Отображаем существующие промпты
    const customPrompts = this.plugin.settings.customPrompts || [];
    
    customPrompts.forEach((prompt, index) => {
      this.createPromptEditor(customPromptsContainer, prompt, index);
    });

    // Кнопка добавления нового
    new Setting(customPromptsContainer)
      .addButton(btn => btn
        .setButtonText('+ Добавить режим')
        .setCta()
        .onClick(async () => {
          this.plugin.settings.customPrompts = this.plugin.settings.customPrompts || [];
          this.plugin.settings.customPrompts.push({
            id: `custom_${Date.now()}`,
            label: 'Новый режим',
            instruction: 'Опиши задачу для AI...'
          });
          await this.plugin.saveSettings();
          this.display(); 
        }));
    new Setting(containerEl)
      .setName('Что делать с ответом?')
      .setDesc('Как обрабатывать результат после генерации')
      .addDropdown(dropdown => dropdown
        .addOption('modal', 'Спрашивать каждый раз')
        .addOption('append', 'Сразу в конец файла')
        .addOption('chat', 'Только в чате')
        .setValue(this.plugin.settings.insertBehavior || 'modal')
        .onChange(async (value) => {
          this.plugin.settings.insertBehavior = value;
          await this.plugin.saveSettings();
        }));
  }

  createPromptEditor(container, prompt, index) {
    const promptEl = container.createDiv();
    promptEl.style.cssText = 'border: 1px solid var(--background-modifier-border); border-radius: 8px; padding: 12px; margin-bottom: 12px; background: var(--background-secondary);';

    // Заголовок с кнопкой удаления
    const header = promptEl.createDiv();
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;';
    header.createEl('strong', { text: `Режим #${index + 1}` });
    
    const deleteBtn = header.createEl('button', { text: 'Удалить' });
    deleteBtn.style.cssText = 'background: var(--background-modifier-error); color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;';
    deleteBtn.onclick = async () => {
      this.plugin.settings.customPrompts.splice(index, 1);
      await this.plugin.saveSettings();
      this.display();
    };

    // Поле Label
    new Setting(promptEl)
      .setName('Название кнопки')
      .addText(text => text
        .setValue(prompt.label)
        .onChange(async (value) => {
          prompt.label = value;
          await this.plugin.saveSettings();
        }));

    // Поле Instruction
    new Setting(promptEl)
      .setName('Инструкция для AI')
      .setDesc('Что должна сделать модель')
      .addTextArea(text => text
        .setValue(prompt.instruction)
        .setPlaceholder('Например: Переведи текст на английский...')
        .onChange(async (value) => {
          prompt.instruction = value;
          await this.plugin.saveSettings();
        }));
  }
}

module.exports = { AIAssistantSettingTab };
