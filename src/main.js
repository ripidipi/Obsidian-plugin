const { Plugin, Notice } = require('obsidian');
const CONSTANTS = require('./constants.js');
const { DEFAULT_SETTINGS } = require('./settings/defaults');
const { AIAssistantSettingTab } = require('./settings/tab');
const { AIChatView } = require('./ui/chat-view');
const { QuickModeModal } = require('./ui/quick-modal');
const { getActiveEditor } = require('./utils/editor');

module.exports = class AIAssistantPlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    
    // Инициализируем историю (загружаем из сохранённых или создаём пустую)
    this.chatHistory = this.settings.chatHistory || [];

    this.registerView(
      CONSTANTS.VIEW_TYPE_AI,
      (leaf) => new AIChatView(leaf, this)
    );

    this.addCommand({
      id: CONSTANTS.COMMANDS.OPEN_CHAT,
      name: 'AI: Open Chat',
      callback: () => this.activateView()
    });

    this.addCommand({
      id: CONSTANTS.COMMANDS.QUICK_MENU,
      name: 'AI: Quick Menu',
      editorCallback: (editor, view) => {
        const text = editor.getSelection() || editor.getValue();
        new QuickModeModal(this.app, this, text, editor).open();
      }
    });

    this.addSettingTab(new AIAssistantSettingTab(this.app, this));

    new Notice('AI Chat загружен');
  }

  onunload() {
    // Сохраняем историю перед выгрузкой
    this.settings.chatHistory = this.chatHistory;
    this.saveSettings();
    
    this.app.workspace.detachLeavesOfType(CONSTANTS.VIEW_TYPE_AI);
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(CONSTANTS.VIEW_TYPE_AI)[0];

    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      await leaf.setViewState({
        type: CONSTANTS.VIEW_TYPE_AI,
        active: true
      });
    }

    workspace.revealLeaf(leaf);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  // Метод для сохранения истории
  async saveHistory() {
    const maxHistory = this.settings.maxHistoryLength || 20;
    if (maxHistory > 0 && this.chatHistory.length > maxHistory) {
      this.chatHistory = this.chatHistory.slice(-maxHistory);
    }
    this.settings.chatHistory = this.chatHistory;
    await this.saveSettings();
  }

  getActiveEditor() {
    return getActiveEditor(this.app);
  }
};
