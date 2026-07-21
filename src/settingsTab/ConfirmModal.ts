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
        // setDestructive() (the non-deprecated replacement) is @since Obsidian
        // 1.13.0, but manifest minAppVersion is 1.5.7 — setWarning() is the only
        // variant available on the whole supported range (lints as a non-blocking
        // @typescript-eslint/no-deprecated WARNING — the publish validator's
        // no-restricted-disable rule forbids suppressing it). Revisit when the
        // floor is raised to 1.13.0 (same trigger that lets display() be dropped).
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
