import { App, Modal, Setting } from 'obsidian';
import { ConfirmModal } from '../../../../settingsTab/ConfirmModal';
import { InlineConfirmRequest, InlineNoteDialogs } from '../InlineNoteDialogs';
import { InlineRefusal } from '../InlineRefusal';

export const INLINE_NOTE_ACTION_NAME = 'Inline note (visit history aware)';

/**
 * InlineNoteDialogs backed by Obsidian modals. Thin, one-shot adapters —
 * intentionally UNTESTED (the unit-test 'obsidian' stand-in has no DOM);
 * all decisions and texts live in InlineNoteAction / InlineRefusals.
 */
export class ModalInlineNoteDialogs implements InlineNoteDialogs {
  constructor(private readonly app: App) {
  }

  showRefusal(refusal: InlineRefusal): void {
    new InlineRefusalModal(this.app, refusal).open();
  }

  confirmInline(request: InlineConfirmRequest, onConfirm: () => void): void {
    const { inlinedNoteName, receivingNoteName } = request;
    new ConfirmModal(this.app, {
      title: INLINE_NOTE_ACTION_NAME,
      body: `Moves the content of "${inlinedNoteName}" into "${receivingNoteName}" (right after its link), `
        + `moves its visit history to "${receivingNoteName}", and moves "${inlinedNoteName}" to the trash. `
        + `Restoring "${inlinedNoteName}" from the trash does NOT bring its visit history back.`,
      ctaLabel: 'Inline note',
      onConfirm,
    }).open();
  }
}

/** "Can't inline" explanation: reason, referencing files (if any), next step. */
class InlineRefusalModal extends Modal {
  constructor(app: App, private readonly refusal: InlineRefusal) {
    super(app);
  }

  onOpen(): void {
    this.setTitle("Can't inline this note");
    this.contentEl.createEl('p', { text: this.refusal.reason });
    if (this.refusal.referencingFiles.length > 0) {
      const list = this.contentEl.createEl('ul');
      for (const file of this.refusal.referencingFiles) {
        list.createEl('li', { text: `${file.path} (${file.linkCount} ${file.linkCount === 1 ? 'link' : 'links'})` });
      }
    }
    this.contentEl.createEl('p', { text: this.refusal.nextStep });
    new Setting(this.contentEl)
      .addButton(btn => btn
        .setButtonText('OK')
        .setCta()
        .onClick(() => this.close()));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
