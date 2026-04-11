const {
  Plugin, Notice, MarkdownView,
  PluginSettingTab, Setting, Modal, ButtonComponent
} = require("obsidian");

module.exports = class AIAssistantPlugin extends Plugin {

  async onload() {
    await this.loadSettings();

    new Notice("AI Assistant (HF Router) loaded 🚀");

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
Ты полезный AI помощник.
Отвечай:
- кратко
- структурировано
- без воды
`;

    const prompts = {
      fix: `Исправь орфографию и пунктуацию, НЕ меняя смысл:\n\n${text}`,

      rephrase: `Перепиши текст, сделай его яснее и читабельнее:\n\n${text}`,

      summary: `Сделай конспект:\n- кратко\n- основные идеи\n\nТекст:\n${text}`,

      explain: `Объясни простыми словами:\n\n${text}`,

      review: `Оцени текст по:
- ясность
- логика
- структура
- грамотность

Дай рекомендации.

Текст:
${text}`,

      smart: `Проанализируй текст и улучши его:\n\n${text}`,

      custom: `${custom}\n\nТекст:\n${text}`
    };

    return base + "\n\n" + prompts[type];
  }

  // =========================
  // API CALL
  // =========================
  async runAI({ type, text, customPrompt }) {

    if (!this.settings.apiKey) {
      new Notice("Добавь HF API ключ!");
      return null;
    }

    try {
      new Notice("AI думает... 🤔");

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
                content: "Ты умный AI помощник. Отвечай кратко и по делу."
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
        throw new Error("Пустой ответ от модели");
      }

      return ai;

    } catch (e) {
      console.error(e);
      new Notice("Ошибка: " + e.message);
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


// =========================
// MODAL UI
// =========================
class AIModal extends Modal {
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
      ["fix", "Исправить"],
      ["rephrase", "Улучшить"],
      ["summary", "Конспект"],
      ["explain", "Объяснить"],
      ["review", "Оценить"],
      ["smart", "Умный режим"]
    ];

    modes.forEach(([key, label]) => {
      new ButtonComponent(contentEl)
        .setButtonText(label)
        .onClick(async () => {
          await this.handleRun(key, text, editor);
        });
    });

    contentEl.createEl("h3", { text: "Кастомный запрос" });

    const input = contentEl.createEl("textarea");
    input.style.width = "100%";
    input.placeholder = "Напиши свой prompt...";

    new ButtonComponent(contentEl)
      .setButtonText("Запустить")
      .onClick(async () => {
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
        `${text}\n\n---\n### 🤖 AI\n${ai}`
      );
    }

    this.close();
  }

  async askMode() {
    return new Promise((resolve) => {
      const modal = new Modal(this.app);

      modal.onOpen = () => {
        modal.contentEl.createEl("h3", { text: "Как вставить результат?" });

        ["replace", "append", "block"].forEach(mode => {
          new ButtonComponent(modal.contentEl)
            .setButtonText(mode)
            .onClick(() => {
              modal.close();
              resolve(mode);
            });
        });
      };

      modal.open();
    });
  }
}


// =========================
// SETTINGS
// =========================
class AISettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("HuggingFace API Key")
      .setDesc("hf_...")
      .addText(text => text
        .setValue(this.plugin.settings.apiKey)
        .onChange(async (v) => {
          this.plugin.settings.apiKey = v;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Model")
      .setDesc("mistralai/Mistral-7B-Instruct-v0.3")
      .addText(text => text
        .setValue(this.plugin.settings.model)
        .onChange(async (v) => {
          this.plugin.settings.model = v;
          await this.plugin.saveSettings();
        }));
  }
}