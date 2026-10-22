import { describe, expect, it } from 'vitest';
import { TFile } from 'obsidian';
import { InlineEligibility } from './InlineEligibility';
import { BodyNoteReference, NoteReference } from './NoteReference';
import { makeTFile } from '../../../testSupport/fileFactory';

const NOTE1 = makeTFile({ path: 'note1.md' });
const NOTE2 = makeTFile({ path: 'note2.md' });
const OTHER = makeTFile({ path: 'other.md' });
const CANVAS = makeTFile({ path: 'board.canvas' });

function bodyLink(sourceFile: TFile, subpath = ''): BodyNoteReference {
  return { kind: 'body', sourceFile, isEmbed: false, subpath, original: '[[note2]]', startOffset: 0, endOffset: 9 };
}

function refusalKind(references: NoteReference[]): string {
  const verdict = InlineEligibility.evaluate(NOTE2, references);
  return verdict.kind === 'refused' ? verdict.refusal.kind : 'eligible';
}

describe('InlineEligibility', () => {
  describe('evaluate', () => {
    it('should accept exactly one whole-note body link', () => {
      // GIVEN one body link from note1
      const reference = bodyLink(NOTE1);
      // WHEN evaluated
      // THEN that link is the one to inline at
      expect(InlineEligibility.evaluate(NOTE2, [reference])).toEqual({ kind: 'eligible', reference });
    });

    it('should accept one embed', () => {
      expect(refusalKind([{ ...bodyLink(NOTE1), isEmbed: true }])).toBe('eligible');
    });

    it('should refuse when nothing links to the note', () => {
      expect(refusalKind([])).toBe('no-links');
    });

    it('should ignore self-links inside the inlined note', () => {
      // GIVEN note2 linking itself plus one link from note1
      // WHEN evaluated
      // THEN only note1's link counts
      expect(refusalKind([bodyLink(NOTE2, '#Part'), bodyLink(NOTE1)])).toBe('eligible');
    });

    it('should refuse when only self-links exist', () => {
      expect(refusalKind([bodyLink(NOTE2)])).toBe('no-links');
    });

    it('should refuse two links from the same file', () => {
      expect(refusalKind([bodyLink(NOTE1), bodyLink(NOTE1)])).toBe('multiple-links');
    });

    it('should refuse when a canvas references the note besides the body link', () => {
      expect(refusalKind([bodyLink(NOTE1), { kind: 'canvas', sourceFile: CANVAS, subpath: '' }])).toBe('multiple-links');
    });

    it('should list each referencing file with its link count', () => {
      // GIVEN two links from note1 and one from other
      const verdict = InlineEligibility.evaluate(NOTE2, [bodyLink(NOTE1), bodyLink(OTHER), bodyLink(NOTE1)]);
      // WHEN refused
      // THEN the message lists per-file counts
      expect(verdict.kind === 'refused' && verdict.refusal.referencingFiles).toEqual([
        { path: 'note1.md', linkCount: 2 },
        { path: 'other.md', linkCount: 1 },
      ]);
    });

    it('should explain the one-focused-note assumption when refusing multiple links', () => {
      const verdict = InlineEligibility.evaluate(NOTE2, [bodyLink(NOTE1), bodyLink(OTHER)]);
      expect(verdict.kind === 'refused' && verdict.refusal.reason).toContain('one note or canvas at a time');
    });

    it('should refuse a single partial link', () => {
      expect(refusalKind([bodyLink(NOTE1, '#Heading')])).toBe('partial-link');
    });

    it('should refuse a single block link', () => {
      expect(refusalKind([bodyLink(NOTE1, '#^block')])).toBe('partial-link');
    });

    it('should refuse a single property link', () => {
      expect(refusalKind([{ kind: 'property', sourceFile: NOTE1, propertyKey: 'related' }])).toBe('property-link');
    });

    it('should refuse a single canvas reference', () => {
      expect(refusalKind([{ kind: 'canvas', sourceFile: CANVAS, subpath: '' }])).toBe('canvas-link');
    });
  });
});
