import { TFile } from 'obsidian';
import { BodyNoteReference, NoteReference } from './NoteReference';
import { InlineRefusal, InlineRefusals, ReferencingFile } from './InlineRefusal';

export type EligibilityVerdict =
  | { readonly kind: 'eligible'; readonly reference: BodyNoteReference }
  | { readonly kind: 'refused'; readonly refusal: InlineRefusal };

/**
 * The "exactly one link" rule of inline note: a note can be inlined only
 * when the WHOLE vault holds exactly one reference to it (body links,
 * embeds, property links and canvas references all count; self-links are
 * ignored), and that one reference is a whole-note link in a note's body.
 *
 * WHY so strict: visit history assumes one focused note at a time per user,
 * so the inlined note's history can go to exactly one receiving note — and
 * any other reference would break once the note is trashed.
 */
export class InlineEligibility {
  static evaluate(target: TFile, references: readonly NoteReference[]): EligibilityVerdict {
    const foreign = references.filter(reference => reference.sourceFile.path !== target.path);
    const [only] = foreign;
    if (only === undefined) {
      return InlineEligibility.refused(InlineRefusals.noLinks(target.basename));
    }
    if (foreign.length > 1) {
      return InlineEligibility.refused(InlineRefusals.multipleLinks(target.basename, InlineEligibility.countBySource(foreign)));
    }
    switch (only.kind) {
      case 'property':
        return InlineEligibility.refused(InlineRefusals.propertyLink(target.basename, only.sourceFile.path, only.propertyKey));
      case 'canvas':
        return InlineEligibility.refused(InlineRefusals.canvasLink(target.basename, only.sourceFile.path));
      case 'body':
        return only.subpath === ''
          ? { kind: 'eligible', reference: only }
          : InlineEligibility.refused(InlineRefusals.partialLink(target.basename, only.sourceFile.path, only.subpath));
    }
  }

  // ── private ─────────────────────────────────────────────────────────────

  private static refused(refusal: InlineRefusal): EligibilityVerdict {
    return { kind: 'refused', refusal };
  }

  /** Link count per referencing file, in first-seen order. */
  private static countBySource(references: readonly NoteReference[]): ReferencingFile[] {
    const countByPath = new Map<string, number>();
    for (const reference of references) {
      countByPath.set(reference.sourceFile.path, (countByPath.get(reference.sourceFile.path) ?? 0) + 1);
    }
    return [...countByPath].map(([path, linkCount]) => ({ path, linkCount }));
  }
}
