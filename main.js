// src.js
var {
  Plugin,
  Notice,
  MarkdownView,
  PluginSettingTab,
  Setting,
  Modal,
  ButtonComponent
} = require("obsidian");
module.exports = class AIAssistantPlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    new Notice("AI Assistant (HF Router) loaded \u{1F680}");
    this.addSettingTab(new AISettingTab(this.app, this));
    this.addCommand({
      id: "ai-open",
      name: "AI: Open Assistant",
      callback: () => new AIModal(this.app, this).open()
    });
  }
  // =========================
  // PROMPTS
  // =========================
  getPrompt(type, text, custom = "") {
    const base = `
\u0422\u044B \u043F\u043E\u043B\u0435\u0437\u043D\u044B\u0439 AI \u043F\u043E\u043C\u043E\u0449\u043D\u0438\u043A.
\u041E\u0442\u0432\u0435\u0447\u0430\u0439:
- \u043A\u0440\u0430\u0442\u043A\u043E
- \u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0438\u0440\u043E\u0432\u0430\u043D\u043E
- \u0431\u0435\u0437 \u0432\u043E\u0434\u044B
`;
    const prompts = {
      fix: `\u0418\u0441\u043F\u0440\u0430\u0432\u044C \u043E\u0440\u0444\u043E\u0433\u0440\u0430\u0444\u0438\u044E \u0438 \u043F\u0443\u043D\u043A\u0442\u0443\u0430\u0446\u0438\u044E, \u041D\u0415 \u043C\u0435\u043D\u044F\u044F \u0441\u043C\u044B\u0441\u043B:

${text}`,
      rephrase: `\u041F\u0435\u0440\u0435\u043F\u0438\u0448\u0438 \u0442\u0435\u043A\u0441\u0442, \u0441\u0434\u0435\u043B\u0430\u0439 \u0435\u0433\u043E \u044F\u0441\u043D\u0435\u0435 \u0438 \u0447\u0438\u0442\u0430\u0431\u0435\u043B\u044C\u043D\u0435\u0435:

${text}`,
      summary: `\u0421\u0434\u0435\u043B\u0430\u0439 \u043A\u043E\u043D\u0441\u043F\u0435\u043A\u0442:
- \u043A\u0440\u0430\u0442\u043A\u043E
- \u043E\u0441\u043D\u043E\u0432\u043D\u044B\u0435 \u0438\u0434\u0435\u0438

\u0422\u0435\u043A\u0441\u0442:
${text}`,
      explain: `\u041E\u0431\u044A\u044F\u0441\u043D\u0438 \u043F\u0440\u043E\u0441\u0442\u044B\u043C\u0438 \u0441\u043B\u043E\u0432\u0430\u043C\u0438:

${text}`,
      review: `\u041E\u0446\u0435\u043D\u0438 \u0442\u0435\u043A\u0441\u0442 \u043F\u043E:
- \u044F\u0441\u043D\u043E\u0441\u0442\u044C
- \u043B\u043E\u0433\u0438\u043A\u0430
- \u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0430
- \u0433\u0440\u0430\u043C\u043E\u0442\u043D\u043E\u0441\u0442\u044C

\u0414\u0430\u0439 \u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0446\u0438\u0438.

\u0422\u0435\u043A\u0441\u0442:
${text}`,
      smart: `\u041F\u0440\u043E\u0430\u043D\u0430\u043B\u0438\u0437\u0438\u0440\u0443\u0439 \u0442\u0435\u043A\u0441\u0442 \u0438 \u0443\u043B\u0443\u0447\u0448\u0438 \u0435\u0433\u043E:

${text}`,
      custom: `${custom}

\u0422\u0435\u043A\u0441\u0442:
${text}`
    };
    return base + "\n\n" + prompts[type];
  }
  // =========================
  // API CALL
  // =========================
  async runAI({ type, text, customPrompt }) {
    if (!this.settings.apiKey) {
      new Notice("\u0414\u043E\u0431\u0430\u0432\u044C HF API \u043A\u043B\u044E\u0447!");
      return null;
    }
    try {
      new Notice("AI \u0434\u0443\u043C\u0430\u0435\u0442... \u{1F914}");
      const prompt = this.getPrompt(type, text, customPrompt);
      const res = await fetch(
        "https://router.huggingface.co/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.settings.apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: this.settings.model,
            messages: [
              {
                role: "system",
                content: "\u0422\u044B \u0443\u043C\u043D\u044B\u0439 AI \u043F\u043E\u043C\u043E\u0449\u043D\u0438\u043A. \u041E\u0442\u0432\u0435\u0447\u0430\u0439 \u043A\u0440\u0430\u0442\u043A\u043E \u0438 \u043F\u043E \u0434\u0435\u043B\u0443."
              },
              {
                role: "user",
                content: prompt
              }
            ],
            max_tokens: 1500,
            temperature: 0.7
          })
        }
      );
      const raw = await res.text();
      if (!res.ok) {
        throw new Error(raw);
      }
      const data = JSON.parse(raw);
      const ai = data.choices?.[0]?.message?.content;
      if (!ai) {
        console.log("FULL RESPONSE:", data);
        throw new Error("\u041F\u0443\u0441\u0442\u043E\u0439 \u043E\u0442\u0432\u0435\u0442 \u043E\u0442 \u043C\u043E\u0434\u0435\u043B\u0438");
      }
      return ai;
    } catch (e) {
      console.error(e);
      new Notice("\u041E\u0448\u0438\u0431\u043A\u0430: " + e.message);
      return null;
    }
  }
  async loadSettings() {
    this.settings = Object.assign({
      apiKey: "",
      model: "mistralai/Mistral-7B-Instruct-v0.3"
    }, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
};
var AIModal = class extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "AI Assistant (HF Router)" });
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return;
    const editor = view.editor;
    let text = editor.getSelection();
    if (!text) text = editor.getValue();
    const modes = [
      ["fix", "\u0418\u0441\u043F\u0440\u0430\u0432\u0438\u0442\u044C"],
      ["rephrase", "\u0423\u043B\u0443\u0447\u0448\u0438\u0442\u044C"],
      ["summary", "\u041A\u043E\u043D\u0441\u043F\u0435\u043A\u0442"],
      ["explain", "\u041E\u0431\u044A\u044F\u0441\u043D\u0438\u0442\u044C"],
      ["review", "\u041E\u0446\u0435\u043D\u0438\u0442\u044C"],
      ["smart", "\u0423\u043C\u043D\u044B\u0439 \u0440\u0435\u0436\u0438\u043C"]
    ];
    modes.forEach(([key, label]) => {
      new ButtonComponent(contentEl).setButtonText(label).onClick(async () => {
        await this.handleRun(key, text, editor);
      });
    });
    contentEl.createEl("h3", { text: "\u041A\u0430\u0441\u0442\u043E\u043C\u043D\u044B\u0439 \u0437\u0430\u043F\u0440\u043E\u0441" });
    const input = contentEl.createEl("textarea");
    input.style.width = "100%";
    input.placeholder = "\u041D\u0430\u043F\u0438\u0448\u0438 \u0441\u0432\u043E\u0439 prompt...";
    new ButtonComponent(contentEl).setButtonText("\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C").onClick(async () => {
      await this.handleRun("custom", text, editor, input.value);
    });
  }
  async handleRun(type, text, editor, customPrompt = "") {
    const ai = await this.plugin.runAI({
      type,
      text,
      customPrompt
    });
    if (!ai) return;
    const mode = await this.askMode();
    if (mode === "replace") {
      editor.replaceSelection(ai);
    } else if (mode === "append") {
      editor.replaceSelection(text + "\n\n---\n" + ai);
    } else {
      editor.replaceSelection(
        `${text}

---
### \u{1F916} AI
${ai}`
      );
    }
    this.close();
  }
  async askMode() {
    return new Promise((resolve) => {
      const modal = new Modal(this.app);
      modal.onOpen = () => {
        modal.contentEl.createEl("h3", { text: "\u041A\u0430\u043A \u0432\u0441\u0442\u0430\u0432\u0438\u0442\u044C \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442?" });
        ["replace", "append", "block"].forEach((mode) => {
          new ButtonComponent(modal.contentEl).setButtonText(mode).onClick(() => {
            modal.close();
            resolve(mode);
          });
        });
      };
      modal.open();
    });
  }
};
var AISettingTab = class extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl).setName("HuggingFace API Key").setDesc("hf_...").addText((text) => text.setValue(this.plugin.settings.apiKey).onChange(async (v) => {
      this.plugin.settings.apiKey = v;
      await this.plugin.saveSettings();
    }));
    new Setting(containerEl).setName("Model").setDesc("mistralai/Mistral-7B-Instruct-v0.3").addText((text) => text.setValue(this.plugin.settings.model).onChange(async (v) => {
      this.plugin.settings.model = v;
      await this.plugin.saveSettings();
    }));
  }
};
