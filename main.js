// src.js
var {
  Plugin,
  Notice,
  MarkdownView,
  PluginSettingTab,
  Setting,
  ItemView,
  WorkspaceLeaf,
  TFile,
  Modal,
  ButtonComponent
} = require("obsidian");
var VIEW_TYPE_AI = "ai-chat-view";
var API_URL = "https://router.huggingface.co/v1/chat/completions";
var DEFAULT_SETTINGS = {
  apiKey: "",
  model: "mistralai/Mistral-7B-Instruct-v0.3",
  maxTokens: 1500,
  contextLimit: 4e3,
  temperature: 0.7
};
var QUICK_MODES = {
  FIX: { id: "fix", label: "\u{1F527} \u0418\u0441\u043F\u0440\u0430\u0432\u0438\u0442\u044C", prompt: "\u0418\u0441\u043F\u0440\u0430\u0432\u044C \u043E\u0440\u0444\u043E\u0433\u0440\u0430\u0444\u0438\u044E \u0438 \u043F\u0443\u043D\u043A\u0442\u0443\u0430\u0446\u0438\u044E, \u041D\u0415 \u043C\u0435\u043D\u044F\u044F \u0441\u043C\u044B\u0441\u043B" },
  REPHRASE: { id: "rephrase", label: "\u2728 \u0423\u043B\u0443\u0447\u0448\u0438\u0442\u044C", prompt: "\u041F\u0435\u0440\u0435\u043F\u0438\u0448\u0438 \u0442\u0435\u043A\u0441\u0442, \u0441\u0434\u0435\u043B\u0430\u0439 \u0435\u0433\u043E \u044F\u0441\u043D\u0435\u0435 \u0438 \u0447\u0438\u0442\u0430\u0431\u0435\u043B\u044C\u043D\u0435\u0435" },
  SUMMARY: { id: "summary", label: "\u{1F4DD} \u041A\u043E\u043D\u0441\u043F\u0435\u043A\u0442", prompt: "\u0421\u0434\u0435\u043B\u0430\u0439 \u043A\u043E\u043D\u0441\u043F\u0435\u043A\u0442: \u043A\u0440\u0430\u0442\u043A\u043E, \u043E\u0441\u043D\u043E\u0432\u043D\u044B\u0435 \u0438\u0434\u0435\u0438" },
  EXPLAIN: { id: "explain", label: "\u{1F4A1} \u041E\u0431\u044A\u044F\u0441\u043D\u0438\u0442\u044C", prompt: "\u041E\u0431\u044A\u044F\u0441\u043D\u0438 \u043F\u0440\u043E\u0441\u0442\u044B\u043C\u0438 \u0441\u043B\u043E\u0432\u0430\u043C\u0438" },
  REVIEW: { id: "review", label: "\u{1F4CA} \u041E\u0446\u0435\u043D\u0438\u0442\u044C", prompt: "\u041E\u0446\u0435\u043D\u0438 \u0442\u0435\u043A\u0441\u0442 \u043F\u043E: \u044F\u0441\u043D\u043E\u0441\u0442\u044C, \u043B\u043E\u0433\u0438\u043A\u0430, \u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0430, \u0433\u0440\u0430\u043C\u043E\u0442\u043D\u043E\u0441\u0442\u044C. \u0414\u0430\u0439 \u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0446\u0438\u0438" },
  SMART: { id: "smart", label: "\u{1F9E0} \u0423\u043C\u043D\u044B\u0439", prompt: "\u041F\u0440\u043E\u0430\u043D\u0430\u043B\u0438\u0437\u0438\u0440\u0443\u0439 \u0442\u0435\u043A\u0441\u0442 \u0438 \u0443\u043B\u0443\u0447\u0448\u0438 \u0435\u0433\u043E" }
};
var SYSTEM_PROMPT = `\u0422\u044B AI \u043F\u043E\u043C\u043E\u0449\u043D\u0438\u043A \u0432 \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440\u0435 Obsidian.
\u041E\u0442\u0432\u0435\u0447\u0430\u0439 \u043A\u0440\u0430\u0442\u043A\u043E, \u043F\u043E \u0434\u0435\u043B\u0443, \u043D\u0430 \u0440\u0443\u0441\u0441\u043A\u043E\u043C \u044F\u0437\u044B\u043A\u0435.
\u0415\u0441\u043B\u0438 \u043F\u0440\u0435\u0434\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 \u2014 \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u0435\u0433\u043E \u0434\u043B\u044F \u043E\u0442\u0432\u0435\u0442\u0430.`;
module.exports = class AIAssistantPlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    this.registerView(
      VIEW_TYPE_AI,
      (leaf) => new AIChatView(leaf, this)
    );
    this.addCommand({
      id: "open-ai-chat",
      name: "AI: Open Chat",
      callback: () => this.activateView()
    });
    this.addCommand({
      id: "ai-quick-menu",
      name: "AI: Quick Menu",
      editorCallback: (editor, view) => this.openQuickMenu(editor, view)
    });
    this.addSettingTab(new AIAssistantSettingTab(this.app, this));
    new Notice("AI Chat loaded \u{1F680}");
  }
  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_AI);
  }
  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_AI)[0];
    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      await leaf.setViewState({
        type: VIEW_TYPE_AI,
        active: true
      });
    }
    workspace.revealLeaf(leaf);
  }
  openQuickMenu(editor, view) {
    const text = editor.getSelection() || editor.getValue();
    new QuickModeModal(this.app, this, text, editor).open();
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  getActiveEditor() {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView?.editor) {
      return activeView.editor;
    }
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      if (leaf.view instanceof MarkdownView && leaf.view.editor) {
        return leaf.view.editor;
      }
    }
    return null;
  }
};
var AIChatView = class extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.chatHistory = [];
    this.useContext = true;
    this.isLoading = false;
  }
  getViewType() {
    return VIEW_TYPE_AI;
  }
  getDisplayText() {
    return "AI Chat";
  }
  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.height = "100%";
    this.setupChatArea(container);
    this.setupQuickModes(container);
    this.setupControls(container);
    this.setupInputArea(container);
  }
  setupChatArea(container) {
    this.chatEl = container.createDiv();
    this.chatEl.style.flex = "1";
    this.chatEl.style.overflowY = "auto";
    this.chatEl.style.padding = "10px";
  }
  setupQuickModes(container) {
    const modesContainer = container.createDiv();
    modesContainer.style.padding = "8px 10px";
    modesContainer.style.borderBottom = "1px solid var(--background-modifier-border)";
    modesContainer.style.display = "flex";
    modesContainer.style.flexWrap = "wrap";
    modesContainer.style.gap = "6px";
    Object.values(QUICK_MODES).forEach((mode) => {
      const btn = modesContainer.createEl("button", {
        text: mode.label,
        cls: "ai-quick-btn"
      });
      btn.style.padding = "4px 10px";
      btn.style.borderRadius = "6px";
      btn.style.border = "1px solid var(--background-modifier-border)";
      btn.style.background = "var(--background-secondary)";
      btn.style.cursor = "pointer";
      btn.style.fontSize = "12px";
      btn.onclick = () => this.quickActionFromChat(mode.id);
    });
  }
  setupControls(container) {
    const controls = container.createDiv();
    controls.style.padding = "5px 10px";
    controls.style.borderBottom = "1px solid var(--background-modifier-border)";
    controls.style.display = "flex";
    controls.style.justifyContent = "space-between";
    controls.style.alignItems = "center";
    const toggleBtn = controls.createEl("button", {
      text: `\u041A\u043E\u043D\u0442\u0435\u043A\u0441\u0442: ${this.useContext ? "ON" : "OFF"}`
    });
    toggleBtn.onclick = () => {
      this.useContext = !this.useContext;
      toggleBtn.textContent = `\u041A\u043E\u043D\u0442\u0435\u043A\u0441\u0442: ${this.useContext ? "ON" : "OFF"}`;
      new Notice(`\u041A\u043E\u043D\u0442\u0435\u043A\u0441\u0442: ${this.useContext ? "\u0432\u043A\u043B\u044E\u0447\u0435\u043D" : "\u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D"}`);
    };
  }
  setupInputArea(container) {
    const inputWrapper = container.createDiv();
    inputWrapper.style.display = "flex";
    inputWrapper.style.padding = "10px";
    inputWrapper.style.borderTop = "1px solid var(--background-modifier-border)";
    inputWrapper.style.gap = "8px";
    this.input = inputWrapper.createEl("textarea");
    this.input.style.flex = "1";
    this.input.style.resize = "none";
    this.input.style.minHeight = "60px";
    this.input.placeholder = "\u041D\u0430\u043F\u0438\u0448\u0438 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u0438\u043B\u0438 /fix /summary /explain";
    const sendBtn = inputWrapper.createEl("button", { text: "\u27A4" });
    sendBtn.onclick = () => this.handleSend();
    this.input.addEventListener("keydown", async (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        await this.handleSend();
      }
    });
  }
  async quickActionFromChat(modeId) {
    const context = await this.extractContext();
    if (!context) {
      new Notice("\u26A0\uFE0F \u0412\u044B\u0434\u0435\u043B\u0438\u0442\u0435 \u0442\u0435\u043A\u0441\u0442 \u0438\u043B\u0438 \u043E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0444\u0430\u0439\u043B");
      return;
    }
    const editor = this.plugin.getActiveEditor();
    if (!editor) {
      new Notice("\u26A0\uFE0F \u041D\u0435\u0442 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440\u0430");
      return;
    }
    await this.quickProcess(modeId, context, editor);
  }
  async quickProcess(modeId, text, editor) {
    const mode = Object.values(QUICK_MODES).find((m) => m.id === modeId);
    if (!mode) return;
    this.addMessageToUI("user", `${mode.label}

${text.slice(0, 200)}${text.length > 200 ? "..." : ""}`);
    this.setLoading(true);
    try {
      const prompt = `${mode.prompt}:

${text}`;
      const payload = {
        model: this.plugin.settings.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt }
        ],
        max_tokens: this.plugin.settings.maxTokens,
        temperature: this.plugin.settings.temperature
      };
      const response = await this.sendToAI(payload);
      if (response) {
        this.addMessageToUI("assistant", response);
        new InsertModeModal(this.app, response, text, editor).open();
      }
    } catch (error) {
      console.error("Quick action failed:", error);
      new Notice("\u041E\u0448\u0438\u0431\u043A\u0430: " + error.message);
    } finally {
      this.setLoading(false);
    }
  }
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
  addLoadingIndicator() {
    const loadingEl = this.chatEl.createDiv();
    loadingEl.className = "ai-loading-indicator";
    loadingEl.style.padding = "10px 14px";
    loadingEl.style.background = "var(--background-secondary)";
    loadingEl.style.borderRadius = "12px";
    loadingEl.style.margin = "6px 0";
    loadingEl.style.maxWidth = "85%";
    loadingEl.style.marginRight = "auto";
    const dots = loadingEl.createDiv();
    dots.style.display = "flex";
    dots.style.gap = "4px";
    dots.style.justifyContent = "center";
    for (let i = 0; i < 3; i++) {
      const dot = dots.createDiv();
      dot.style.width = "8px";
      dot.style.height = "8px";
      dot.style.borderRadius = "50%";
      dot.style.background = "var(--text-muted)";
      dot.style.animation = `bounce 1.4s infinite ease-in-out ${i * 0.16}s`;
      const style = document.createElement("style");
      style.textContent = `
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `;
      if (!document.querySelector("#ai-loading-style")) {
        style.id = "ai-loading-style";
        document.head.appendChild(style);
      }
    }
    loadingEl.appendChild(dots);
    this.chatEl.scrollTop = this.chatEl.scrollHeight;
    this.currentLoadingEl = loadingEl;
  }
  removeLoadingIndicator() {
    if (this.currentLoadingEl) {
      this.currentLoadingEl.remove();
      this.currentLoadingEl = null;
    }
  }
  async handleSend() {
    const rawInput = this.input.value.trim();
    if (!rawInput) return;
    this.addMessageToUI("user", rawInput);
    this.input.value = "";
    this.setLoading(true);
    try {
      const context = await this.extractContext();
      const mode = this.detectMode(rawInput);
      const cleanInput = rawInput.replace(/^\/\w+\s*/, "").trim();
      const requestPayload = this.composeRequestPayload(cleanInput, context, mode);
      const response = await this.sendToAI(requestPayload);
      if (response) {
        this.addMessageToUI("assistant", response);
        this.updateHistory(cleanInput, response);
      }
    } catch (error) {
      console.error("AI Request failed:", error);
      new Notice("\u041E\u0448\u0438\u0431\u043A\u0430: " + error.message);
      this.addMessageToUI("assistant", "\u274C \u041E\u0448\u0438\u0431\u043A\u0430: " + error.message);
    } finally {
      this.setLoading(false);
    }
  }
  async extractContext() {
    if (!this.useContext) return null;
    const editor = this.plugin.getActiveEditor();
    if (!editor) return null;
    const selection = editor.getSelection();
    if (selection && selection.trim().length > 0) {
      return selection.trim();
    }
    const fullText = editor.getValue();
    if (fullText && fullText.trim().length > 0) {
      return fullText.slice(0, this.plugin.settings.contextLimit).trim();
    }
    return null;
  }
  detectMode(text) {
    if (text.startsWith("/fix")) return "fix";
    if (text.startsWith("/summary")) return "summary";
    if (text.startsWith("/explain")) return "explain";
    if (text.startsWith("/rewrite")) return "rewrite";
    return "normal";
  }
  composeRequestPayload(userInput, context, mode) {
    const contextBlock = context ? `<context>
${context}
</context>` : "<context>\u041A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 \u043D\u0435 \u043F\u0440\u0435\u0434\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D.</context>";
    const taskInstructions = this.getTaskInstruction(mode, userInput);
    const finalPrompt = `
<instructions>
${SYSTEM_PROMPT}
</instructions>

<task>
${taskInstructions}
</task>

${contextBlock}

\u041E\u0442\u0432\u0435\u0442:`;
    return {
      model: this.plugin.settings.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...this.chatHistory,
        { role: "user", content: finalPrompt }
      ],
      max_tokens: this.plugin.settings.maxTokens,
      temperature: this.plugin.settings.temperature
    };
  }
  getTaskInstruction(mode, userInput) {
    const instructions = {
      fix: "\u0418\u0441\u043F\u0440\u0430\u0432\u044C \u0433\u0440\u0430\u043C\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0435, \u0441\u0442\u0438\u043B\u0438\u0441\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u0438 \u043B\u043E\u0433\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u043E\u0448\u0438\u0431\u043A\u0438 \u0432 \u0442\u0435\u043A\u0441\u0442\u0435 \u0438\u0437 \u0431\u043B\u043E\u043A\u0430 <context>.",
      summary: "\u0421\u0434\u0435\u043B\u0430\u0439 \u043A\u0440\u0430\u0442\u043A\u043E\u0435 \u0441\u0430\u043C\u043C\u0430\u0440\u0438 \u0442\u0435\u043A\u0441\u0442\u0430 \u0438\u0437 \u0431\u043B\u043E\u043A\u0430 <context>. \u0412\u044B\u0434\u0435\u043B\u0438 \u043A\u043B\u044E\u0447\u0435\u0432\u044B\u0435 \u0442\u0435\u0437\u0438\u0441\u044B.",
      explain: "\u041E\u0431\u044A\u044F\u0441\u043D\u0438 \u043F\u0440\u043E\u0441\u0442\u044B\u043C\u0438 \u0441\u043B\u043E\u0432\u0430\u043C\u0438 \u0441\u0443\u0442\u044C \u0442\u0435\u043A\u0441\u0442\u0430 \u0438\u0437 \u0431\u043B\u043E\u043A\u0430 <context>.",
      rewrite: "\u041F\u0435\u0440\u0435\u043F\u0438\u0448\u0438 \u0442\u0435\u043A\u0441\u0442 \u0438\u0437 \u0431\u043B\u043E\u043A\u0430 <context>, \u0443\u043B\u0443\u0447\u0448\u0438\u0432 \u0447\u0438\u0442\u0430\u0435\u043C\u043E\u0441\u0442\u044C.",
      normal: userInput
    };
    return instructions[mode] || instructions.normal;
  }
  async sendToAI(payload) {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.plugin.settings.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim();
  }
  updateHistory(userInput, assistantResponse) {
    this.chatHistory.push(
      { role: "user", content: userInput },
      { role: "assistant", content: assistantResponse }
    );
    const MAX_HISTORY_LENGTH = 10;
    if (this.chatHistory.length > MAX_HISTORY_LENGTH) {
      this.chatHistory = this.chatHistory.slice(-MAX_HISTORY_LENGTH);
    }
  }
  addMessageToUI(role, text) {
    const msgEl = this.chatEl.createDiv();
    msgEl.style.margin = "6px 0";
    msgEl.style.padding = "10px 14px";
    msgEl.style.borderRadius = "12px";
    msgEl.style.maxWidth = "85%";
    msgEl.style.whiteSpace = "pre-wrap";
    msgEl.style.wordBreak = "break-word";
    if (role === "user") {
      msgEl.style.background = "var(--interactive-accent)";
      msgEl.style.color = "var(--text-on-accent)";
      msgEl.style.marginLeft = "auto";
      msgEl.style.borderBottomRightRadius = "4px";
    } else {
      msgEl.style.background = "var(--background-secondary)";
      msgEl.style.marginRight = "auto";
      msgEl.style.borderBottomLeftRadius = "4px";
    }
    msgEl.setText(text);
    this.chatEl.scrollTop = this.chatEl.scrollHeight;
  }
};
var QuickModeModal = class extends Modal {
  constructor(app, plugin, text, editor) {
    super(app);
    this.plugin = plugin;
    this.text = text;
    this.editor = editor;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "\u{1F916} AI Assistant" });
    const modes = Object.values(QUICK_MODES);
    modes.forEach((mode) => {
      const btnWrapper = contentEl.createDiv();
      btnWrapper.style.margin = "8px 0";
      const btn = new ButtonComponent(btnWrapper);
      btn.setButtonText(mode.label);
      btn.setClass("mod-cta");
      btn.onClick(async () => {
        this.close();
        await this.processMode(mode.id);
      });
    });
    new Setting(contentEl).setName("\u2500\u2500\u2500\u2500\u2500\u2500").setDesc("\u0418\u043B\u0438 \u0432\u0432\u0435\u0434\u0438\u0442\u0435 \u0441\u0432\u043E\u0439 \u0437\u0430\u043F\u0440\u043E\u0441");
    const customInput = contentEl.createEl("textarea");
    customInput.placeholder = "\u041D\u0430\u043F\u0438\u0448\u0438 \u0441\u0432\u043E\u0439 \u043F\u0440\u043E\u043C\u043F\u0442...";
    customInput.style.width = "100%";
    customInput.style.minHeight = "80px";
    customInput.style.marginBottom = "10px";
    new ButtonComponent(contentEl).setButtonText("\u{1F680} \u0412\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C").setClass("mod-cta").onClick(async () => {
      if (customInput.value.trim()) {
        this.close();
        await this.processCustom(customInput.value.trim());
      }
    });
    new ButtonComponent(contentEl).setButtonText("\u041E\u0442\u043C\u0435\u043D\u0430").onClick(() => this.close());
  }
  async processMode(modeId) {
    const view = this.app.workspace.getLeavesOfType(VIEW_TYPE_AI)[0]?.view;
    if (view && view instanceof AIChatView) {
      await view.quickProcess(modeId, this.text, this.editor);
    }
  }
  async processCustom(prompt) {
    const view = this.app.workspace.getLeavesOfType(VIEW_TYPE_AI)[0]?.view;
    if (view && view instanceof AIChatView) {
      view.addMessageToUI("user", `${prompt}

${this.text.slice(0, 200)}${this.text.length > 200 ? "..." : ""}`);
      view.setLoading(true);
      try {
        const fullPrompt = `${prompt}:

${this.text}`;
        const payload = {
          model: this.plugin.settings.model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: fullPrompt }
          ],
          max_tokens: this.plugin.settings.maxTokens,
          temperature: this.plugin.settings.temperature
        };
        const response = await view.sendToAI(payload);
        if (response) {
          view.addMessageToUI("assistant", response);
          new InsertModeModal(this.app, response, this.text, this.editor).open();
        }
      } catch (error) {
        console.error("Custom mode failed:", error);
        new Notice("\u041E\u0448\u0438\u0431\u043A\u0430: " + error.message);
      } finally {
        view.setLoading(false);
      }
    }
  }
};
var InsertModeModal = class extends Modal {
  constructor(app, response, originalText, editor) {
    super(app);
    this.response = response;
    this.originalText = originalText;
    this.editor = editor;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: "\u{1F4E5} \u041A\u0430\u043A \u0432\u0441\u0442\u0430\u0432\u0438\u0442\u044C \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442?" });
    const description = contentEl.createEl("p");
    description.style.color = "var(--text-muted)";
    description.style.marginBottom = "15px";
    description.setText("\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u043F\u043E\u0441\u043E\u0431 \u0432\u0441\u0442\u0430\u0432\u043A\u0438 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u043D\u043E\u0433\u043E \u0442\u0435\u043A\u0441\u0442\u0430");
    const buttonsContainer = contentEl.createDiv();
    buttonsContainer.style.display = "flex";
    buttonsContainer.style.flexDirection = "column";
    buttonsContainer.style.gap = "10px";
    const modes = [
      {
        id: "replace",
        label: "\u{1F4CB} \u0417\u0430\u043C\u0435\u043D\u0438\u0442\u044C \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u0438\u0435",
        desc: "\u0417\u0430\u043C\u0435\u043D\u0438\u0442\u044C \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0439 \u0442\u0435\u043A\u0441\u0442 \u043D\u0430 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442"
      },
      {
        id: "append",
        label: "\u2795 \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043F\u043E\u0441\u043B\u0435",
        desc: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043F\u043E\u0441\u043B\u0435 \u0438\u0441\u0445\u043E\u0434\u043D\u043E\u0433\u043E \u0442\u0435\u043A\u0441\u0442\u0430"
      },
      {
        id: "block",
        label: "\u{1F4E6} \u0412\u0441\u0442\u0430\u0432\u0438\u0442\u044C \u0431\u043B\u043E\u043A\u043E\u043C",
        desc: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0441 \u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043A\u043E\u043C '\u{1F916} AI'"
      }
    ];
    modes.forEach(({ id, label, desc }) => {
      const btnWrapper = buttonsContainer.createDiv();
      btnWrapper.style.display = "flex";
      btnWrapper.style.flexDirection = "column";
      btnWrapper.style.gap = "4px";
      const btn = new ButtonComponent(btnWrapper);
      btn.setButtonText(label);
      btn.setClass("mod-cta");
      btn.onClick(() => {
        this.insertWithMode(id);
        this.close();
      });
      const descEl = btnWrapper.createEl("small");
      descEl.style.color = "var(--text-muted)";
      descEl.style.fontSize = "11px";
      descEl.setText(desc);
    });
    new ButtonComponent(contentEl).setButtonText("\u041E\u0442\u043C\u0435\u043D\u0430").onClick(() => this.close());
  }
  insertWithMode(mode) {
    if (!this.editor) {
      new Notice("\u26A0\uFE0F \u041D\u0435\u0442 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440\u0430");
      return;
    }
    let insertText = "";
    switch (mode) {
      case "replace":
        this.editor.replaceSelection(this.response);
        break;
      case "append":
        insertText = "\n\n---\n" + this.response;
        this.editor.replaceSelection(insertText);
        break;
      case "block":
        insertText = "\n\n---\n### \u{1F916} AI\n" + this.response;
        this.editor.replaceSelection(insertText);
        break;
    }
    new Notice("\u0422\u0435\u043A\u0441\u0442 \u0432\u0441\u0442\u0430\u0432\u043B\u0435\u043D \u2713");
  }
};
var AIAssistantSettingTab = class extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "AI Assistant Settings" });
    new Setting(containerEl).setName("API Key").setDesc("Hugging Face API token (hf_...)").addText((text) => text.setPlaceholder("hf_...").setValue(this.plugin.settings.apiKey).onChange(async (value) => {
      this.plugin.settings.apiKey = value;
      await this.plugin.saveSettings();
    }));
    new Setting(containerEl).setName("Model").setDesc("Model identifier from Hugging Face").addText((text) => text.setValue(this.plugin.settings.model).onChange(async (value) => {
      this.plugin.settings.model = value;
      await this.plugin.saveSettings();
    }));
    new Setting(containerEl).setName("Max Tokens").setDesc("Maximum response length").addSlider((slider) => slider.setLimits(256, 4096, 256).setValue(this.plugin.settings.maxTokens).setDynamicTooltip().onChange(async (value) => {
      this.plugin.settings.maxTokens = value;
      await this.plugin.saveSettings();
    }));
    new Setting(containerEl).setName("Temperature").setDesc("Creativity level (0.0 - \u0442\u043E\u0447\u043D\u044B\u0439, 1.0 - \u043A\u0440\u0435\u0430\u0442\u0438\u0432\u043D\u044B\u0439)").addSlider((slider) => slider.setLimits(0, 1, 0.1).setValue(this.plugin.settings.temperature).setDynamicTooltip().onChange(async (value) => {
      this.plugin.settings.temperature = value;
      await this.plugin.saveSettings();
    }));
    new Setting(containerEl).setName("Context Limit").setDesc("Max characters to send from editor").addSlider((slider) => slider.setLimits(1e3, 8e3, 500).setValue(this.plugin.settings.contextLimit).setDynamicTooltip().onChange(async (value) => {
      this.plugin.settings.contextLimit = value;
      await this.plugin.saveSettings();
    }));
  }
};
