export type InlineRefusalKind =
  | 'no-links'
  | 'multiple-links'
  | 'partial-link'
  | 'property-link'
  | 'canvas-link'
  | 'unsupported-inlined-note'
  | 'unsupported-receiving-note'
  | 'too-deep'
  | 'same-doc-id'
  | 'unusable-receiving-id'
  | 'note-changed';

/** A file referencing the note, with how many links it holds. */
export interface ReferencingFile {
  readonly path: string;
  readonly linkCount: number;
}

/**
 * Why the note can't be inlined, in the user's words. Rendered as:
 * `reason`, then the `referencingFiles` list (if any), then `nextStep`.
 */
export interface InlineRefusal {
  readonly kind: InlineRefusalKind;
  readonly reason: string;
  readonly referencingFiles: readonly ReferencingFile[];
  readonly nextStep: string;
}

/**
 * The ONE home of every inline-note refusal message (user-facing text):
 * plain language, what went wrong, how to fix.
 */
export class InlineRefusals {
  static noLinks(noteName: string): InlineRefusal {
    return InlineRefusals.of(
      'no-links',
      `No note links to "${noteName}". Inlining moves a note into the one note that links to it.`,
      'Add a link to it from the note it should go into, then try again.',
    );
  }

  static multipleLinks(noteName: string, referencingFiles: readonly ReferencingFile[]): InlineRefusal {
    const linkCount = referencingFiles.reduce((sum, file) => sum + file.linkCount, 0);
    return {
      kind: 'multiple-links',
      reason: `"${noteName}" is linked ${linkCount} times. Visit history assumes you focus one note or canvas at a time, `
        + 'so its history cannot be split across several notes. It is linked from:',
      referencingFiles,
      nextStep: 'Slim these down to a single link (in the note it should go into), then try again.',
    };
  }

  static partialLink(noteName: string, sourcePath: string, subpath: string): InlineRefusal {
    return InlineRefusals.of(
      'partial-link',
      `The only link to "${noteName}" (in "${sourcePath}") points to a part of it (${subpath}), not the whole note.`,
      `Change it to a link to the whole note ([[${noteName}]]), then try again.`,
    );
  }

  static propertyLink(noteName: string, sourcePath: string, propertyKey: string): InlineRefusal {
    return InlineRefusals.of(
      'property-link',
      `The only link to "${noteName}" is in the "${propertyKey}" property of "${sourcePath}", not in its text.`,
      'Move the link into the text of that note, then try again.',
    );
  }

  static canvasLink(noteName: string, sourcePath: string): InlineRefusal {
    return InlineRefusals.of(
      'canvas-link',
      `The only link to "${noteName}" is on the canvas "${sourcePath}". Only plain notes can receive an inlined note.`,
      'Link it from the note it should go into instead, then try again.',
    );
  }

  static unsupportedInlinedNote(notePath: string): InlineRefusal {
    return InlineRefusals.of(
      'unsupported-inlined-note',
      `"${notePath}" is not a plain note (canvases and Excalidraw drawings can't be inlined).`,
      'Inline note works only on plain markdown notes.',
    );
  }

  static unsupportedReceivingNote(noteName: string, sourcePath: string): InlineRefusal {
    return InlineRefusals.of(
      'unsupported-receiving-note',
      `The only link to "${noteName}" is in "${sourcePath}", which is not a plain note (e.g. an Excalidraw drawing).`,
      'Only plain markdown notes can receive an inlined note. Link it from a plain note instead, then try again.',
    );
  }

  static tooDeep(noteName: string, receivingPath: string): InlineRefusal {
    return InlineRefusals.of(
      'too-deep',
      `Inlining "${noteName}" into "${receivingPath}" would need headings deeper than level 6 (######).`,
      `Move the link higher up the heading chain in "${receivingPath}" (under a less nested heading), then try again.`,
    );
  }

  static sameDocId(noteName: string, receivingPath: string): InlineRefusal {
    return InlineRefusals.of(
      'same-doc-id',
      `"${noteName}" and "${receivingPath}" carry the same id property, so their visit history can't be told apart.`,
      'Remove the id property from one of them (a new one is assigned on next focus), then try again.',
    );
  }

  static unusableReceivingId(noteName: string, receivingPath: string, docId: string): InlineRefusal {
    return InlineRefusals.of(
      'unusable-receiving-id',
      `"${receivingPath}" has the id property "${docId}", which can't hold the visit history of "${noteName}" `
        + '(it is not usable as a file name).',
      `Remove the id property from "${receivingPath}" (a new one is assigned on next focus), then try again.`,
    );
  }

  static noteChanged(receivingPath: string): InlineRefusal {
    return InlineRefusals.of(
      'note-changed',
      `"${receivingPath}" changed while inlining, so its link could not be found where expected. Nothing was changed.`,
      'Wait a moment and try again.',
    );
  }

  // ── private ─────────────────────────────────────────────────────────────

  private static of(kind: InlineRefusalKind, reason: string, nextStep: string): InlineRefusal {
    return { kind, reason, referencingFiles: [], nextStep };
  }
}
