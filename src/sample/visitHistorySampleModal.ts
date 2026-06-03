import { Modal } from "obsidian";

export class VisitHistorySampleModal extends Modal {
  onOpen() {
    const {contentEl} = this;
    contentEl.setText('Woah!');
  }

  onClose() {
    const {contentEl} = this;
    contentEl.empty();
  }
}