import { TFile } from 'obsidian';

/** A link in the body text of a markdown file. */
export interface BodyNoteReference {
  readonly kind: 'body';
  readonly sourceFile: TFile;
  readonly isEmbed: boolean;
  /** '' for a whole-note link; else e.g. `#Heading`, `#^block`. */
  readonly subpath: string;
  /** The link exactly as written in the file (e.g. `[[note2|alias]]`). */
  readonly original: string;
  /** Character offsets of `original` in the source file's full content. */
  readonly startOffset: number;
  readonly endOffset: number;
}

/** A link inside a frontmatter property value. */
export interface PropertyNoteReference {
  readonly kind: 'property';
  readonly sourceFile: TFile;
  readonly propertyKey: string;
}

/** A canvas file card or a link inside a canvas text card. */
export interface CanvasNoteReference {
  readonly kind: 'canvas';
  readonly sourceFile: TFile;
  readonly subpath: string;
}

/** One reference to a note from anywhere in the vault. */
export type NoteReference = BodyNoteReference | PropertyNoteReference | CanvasNoteReference;
