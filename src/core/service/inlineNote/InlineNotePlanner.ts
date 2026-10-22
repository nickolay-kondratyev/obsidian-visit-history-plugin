import { TFile } from 'obsidian';
import { NoteFileUtil } from '../../util/file/note/NoteFileUtil';
import { NoteReferenceCollector } from './NoteReferenceCollector';
import { InlineEligibility } from './InlineEligibility';
import { InlineRefusal, InlineRefusals } from './InlineRefusal';
import { PlainNoteCheck } from './PlainNoteCheck';
import { InlinedNote, InlinedNoteParser } from './InlinedNoteParser';
import { NoteTitle } from './NoteTitle';
import { InlineLinkSite, MarkdownSectionPlacer } from './MarkdownSectionPlacer';

/** Everything needed to inline note2 into note1, checked up front. */
export interface InlinePlan {
  /** The receiving note (holds the ONE link). */
  readonly note1: TFile;
  /** The inlined note (trashed afterwards). */
  readonly note2: TFile;
  readonly linkSite: InlineLinkSite;
  readonly inlined: InlinedNote;
  readonly note1Title: string;
}

export type InlinePlanResult =
  | { readonly kind: 'ready'; readonly plan: InlinePlan }
  | { readonly kind: 'refused'; readonly refusal: InlineRefusal };

/**
 * Read-only check of every inline-note rule BEFORE anything is changed:
 * plain-note types, the exactly-one-link rule, and a dry-run placement into
 * note1's current text (so "too deep" is refused before the confirm dialog).
 */
export class InlineNotePlanner {
  constructor(
    private readonly referenceCollector: NoteReferenceCollector,
    private readonly noteFileUtil: NoteFileUtil,
  ) {
  }

  async plan(note2: TFile): Promise<InlinePlanResult> {
    const note2Content = await this.noteFileUtil.cachedRead(note2);
    if (!PlainNoteCheck.isPlainMarkdownNote(note2, note2Content)) {
      return InlineNotePlanner.refused(InlineRefusals.unsupportedInlinedNote(note2.path));
    }
    const verdict = InlineEligibility.evaluate(note2, await this.referenceCollector.collectReferencesTo(note2));
    if (verdict.kind === 'refused') {
      return verdict;
    }
    const { reference } = verdict;
    const note1 = reference.sourceFile;
    const note1Content = await this.noteFileUtil.cachedRead(note1);
    if (!PlainNoteCheck.isPlainMarkdownNote(note1, note1Content)) {
      return InlineNotePlanner.refused(InlineRefusals.unsupportedReceivingNote(note2.basename, note1.path));
    }

    const plan: InlinePlan = {
      note1,
      note2,
      linkSite: {
        startOffset: reference.startOffset,
        endOffset: reference.endOffset,
        original: reference.original,
        isEmbed: reference.isEmbed,
      },
      inlined: InlinedNoteParser.parse(note2Content, note2.basename),
      note1Title: NoteTitle.resolve(note1Content, note1.basename),
    };
    const dryRun = MarkdownSectionPlacer.place(note1Content, plan.note1Title, plan.linkSite, plan.inlined);
    switch (dryRun.kind) {
      case 'too-deep':
        return InlineNotePlanner.refused(InlineRefusals.tooDeep(note2.basename, note1.path));
      case 'link-moved':
        // metadataCache offsets lag a just-edited note — retry shortly.
        return InlineNotePlanner.refused(InlineRefusals.noteChanged(note1.path));
      case 'placed':
        return { kind: 'ready', plan };
    }
  }

  // ── private ─────────────────────────────────────────────────────────────

  private static refused(refusal: InlineRefusal): InlinePlanResult {
    return { kind: 'refused', refusal };
  }
}
