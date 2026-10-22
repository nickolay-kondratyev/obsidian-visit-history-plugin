import { InlineRefusal } from './InlineRefusal';

export interface InlineConfirmRequest {
  /** note2 — moved into note1 and trashed. */
  readonly inlinedNoteName: string;
  /** note1 — receives content + history. */
  readonly receivingNoteName: string;
}

/** The inline-note UI seam (Obsidian modals in prod, fakes in tests). */
export interface InlineNoteDialogs {
  /** Explains why the note can't be inlined and what to do about it. */
  showRefusal(refusal: InlineRefusal): void;

  /** Asks for confirmation; `onConfirm` runs ONLY if the user confirms. */
  confirmInline(request: InlineConfirmRequest, onConfirm: () => void): void;
}
