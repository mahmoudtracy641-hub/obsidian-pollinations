const { Plugin, PluginSettingTab, Setting, Notice, Modal, requestUrl } =
    require("obsidian");

const DEFAULT_SETTINGS = { apiKey: "" };

class PromptModal extends Modal {
    constructor(app, onSubmit) {
        super(app);
        this.onSubmit = onSubmit;
    }
    onOpen() {
        const { contentEl } = this;
        contentEl.createEl("h3", { text: "Pollinations prompt" });
        const input = contentEl.createEl("input", { type: "text" });
        input.style.width = "100%";
        input.focus();
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                this.close();
                this.onSubmit(input.value);
            }
        });
    }
    onClose() {
        this.contentEl.empty();
    }
}

class PollinationsSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl("h2", { text: "Pollinations settings" });
        new Setting(containerEl)
            .setName("API key")
            .setDesc(
                "From enter.pollinations.ai/keys. Requests use your own Pollen balance.",
            )
            .addText((text) =>
                text
                    .setPlaceholder("sk_... or pk_...")
                    .setValue(this.plugin.settings.apiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.apiKey = value.trim();
                        await this.plugin.saveSettings();
                    }),
            );
    }
}

module.exports = class PollinationsPlugin extends Plugin {
    async onload() {
        await this.loadSettings();
        this.addSettingTab(new PollinationsSettingTab(this.app, this));

        this.addCommand({
            id: "pollinations-generate-text",
            name: "Generate text (selection or prompt)",
            editorCallback: async (editor) => {
                if (!this.settings.apiKey) {
                    new Notice("Set your Pollinations API key in settings first.");
                    return;
                }
                const selection = editor.getSelection();
                const prompt = selection || (await this.promptForText());
                if (!prompt) return;

                new Notice("Generating text...");
                try {
                    const res = await requestUrl({
                        url: `https://gen.pollinations.ai/text/${encodeURIComponent(prompt)}`,
                        headers: { Authorization: `Bearer ${this.settings.apiKey}` },
                    });
                    if (selection) editor.replaceSelection(res.text);
                    else editor.replaceRange(res.text, editor.getCursor());
                } catch (err) {
                    new Notice("Pollinations request failed: " + err.message);
                }
            },
        });

        this.addCommand({
            id: "pollinations-generate-image",
            name: "Generate image (selection or prompt)",
            editorCallback: async (editor) => {
                if (!this.settings.apiKey) {
                    new Notice("Set your Pollinations API key in settings first.");
                    return;
                }
                const prompt = editor.getSelection() || (await this.promptForText());
                if (!prompt) return;

                new Notice("Generating image...");
                try {
                    const res = await requestUrl({
                        url: `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?nologo=true`,
                        headers: { Authorization: `Bearer ${this.settings.apiKey}` },
                    });
                    const fileName = `pollinations-${Date.now()}.png`;
                    await this.app.vault.createBinary(fileName, res.arrayBuffer);
                    editor.replaceRange(`![[${fileName}]]`, editor.getCursor());
                } catch (err) {
                    new Notice("Pollinations request failed: " + err.message);
                }
            },
        });
    }

    async promptForText() {
        return new Promise((resolve) => {
            new PromptModal(this.app, resolve).open();
        });
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }
    async saveSettings() {
        await this.saveData(this.settings);
    }
};
