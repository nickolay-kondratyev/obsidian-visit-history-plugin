import { TFile } from 'obsidian';
import { NoteReference } from '../core/service/inlineNote/NoteReference';
import { NoteReferenceCollector } from '../core/service/inlineNote/NoteReferenceCollector';

/** NoteReferenceCollector fake answering with a fixed reference list. */
export class FixedReferenceCollector implements NoteReferenceCollector {
  references: NoteReference[] = [];

  async collectReferencesTo(_target: TFile): Promise<NoteReference[]> {
    return this.references;
  }

  /** A body reference to `original` at its first occurrence in `content`. */
  static bodyReferenceIn(sourceFile: TFile, content: string, original: string): NoteReference {
    const startOffset = content.indexOf(original);
    if (startOffset < 0) {
      throw new Error(`link not found in content original=[${original}]`);
    }
    return {
      kind: 'body', sourceFile, isEmbed: original.startsWith('!'), subpath: '',
      original, startOffset, endOffset: startOffset + original.length,
    };
  }
}
