import { App, Modal, Setting } from 'obsidian';

/** What a ConfirmModal shows and does on confirmation. */
export interface ConfirmModalParams {
  title: string;
  body: string;
  /** Label of the confirm button (rendered as a warning button). */
  ctaLabel: string;
  onConfirm: () => void;
}

/**
 * Generic confirm/cancel dialog for destructive or irreversible actions.
 * onConfirm runs only when the user clicks the CTA; closing any other way
 * (Cancel, Esc, click-outside) does nothing.
 */
export class ConfirmModal extends Modal {
  constructor(app: App, private readonly params: ConfirmModalParams) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText(this.params.title);
    this.contentEl.createEl('p', { text: this.params.body });
    new Setting(this.contentEl)
      .addButton(btn => btn
        .setButtonText(this.params.ctaLabel)
        .setWarning()
        .onClick(() => {
          this.close();
          this.params.onConfirm();
        }))
      .addButton(btn => btn
        .setButtonText('Cancel')
        .onClick(() => this.close()));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
