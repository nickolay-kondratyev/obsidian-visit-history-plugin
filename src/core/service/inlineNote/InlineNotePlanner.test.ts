import { describe, expect, it } from 'vitest';
import { InlineNotePlanner, InlinePlanResult } from './InlineNotePlanner';
import { FakeNoteFileUtil } from '../../../testSupport/FakeNoteFileUtil';
import { FixedReferenceCollector } from '../../../testSupport/FixedReferenceCollector';

function setup(note1Path: string, note1Content: string, note2Path = 'note2.md', note2Content = 'body') {
  const notes = new FakeNoteFileUtil();
  const collector = new FixedReferenceCollector();
  const note1 = notes.seedNote(note1Path, note1Content);
  const note2 = notes.seedNote(note2Path, note2Content);
  collector.references = [FixedReferenceCollector.bodyReferenceIn(note1, note1Content, '[[note2]]')];
  return { planner: new InlineNotePlanner(collector, notes), note1, note2, collector };
}

function kindOf(result: InlinePlanResult): string {
  return result.kind === 'refused' ? result.refusal.kind : result.kind;
}

describe('InlineNotePlanner', () => {
  describe('plan', () => {
    it('should be ready for one whole-note link between plain notes', async () => {
      const { planner, note2 } = setup('note1.md', '## A\nSee [[note2]].');
      expect(kindOf(await planner.plan(note2))).toBe('ready');
    });

    it('should plan the receiving note as the source of the one link', async () => {
      const { planner, note1, note2 } = setup('note1.md', '## A\nSee [[note2]].');
      const result = await planner.plan(note2);
      expect(result.kind === 'ready' && result.plan.note1).toBe(note1);
    });

    it('should refuse inlining an Excalidraw drawing', async () => {
      const { planner, note2 } = setup('note1.md', 'See [[note2]].', 'note2.excalidraw.md');
      expect(kindOf(await planner.plan(note2))).toBe('unsupported-inlined-note');
    });

    it('should refuse when the receiving note is an Excalidraw drawing', async () => {
      const { planner, note2 } = setup('note1.md', '---\nexcalidraw-plugin: parsed\n---\n[[note2]]');
      expect(kindOf(await planner.plan(note2))).toBe('unsupported-receiving-note');
    });

    it('should pass eligibility refusals through', async () => {
      const { planner, note2, collector } = setup('note1.md', 'See [[note2]].');
      collector.references = [];
      expect(kindOf(await planner.plan(note2))).toBe('no-links');
    });

    it('should refuse while Obsidian is still indexing the vault', async () => {
      const { planner, note2, collector } = setup('note1.md', 'See [[note2]].');
      collector.indexIncomplete = true;
      expect(kindOf(await planner.plan(note2))).toBe('still-indexing');
    });

    it('should refuse up front when headings would get too deep', async () => {
      const { planner, note2 } = setup('note1.md', '###### Deep\nSee [[note2]].');
      expect(kindOf(await planner.plan(note2))).toBe('too-deep');
    });

    it('should refuse when the link sits in a heading line', async () => {
      const { planner, note2 } = setup('note1.md', '## A\n### See [[note2]]\ntext');
      expect(kindOf(await planner.plan(note2))).toBe('link-in-heading');
    });

    it('should refuse when the cached link offsets no longer match the note', async () => {
      // GIVEN a reference pointing at stale offsets
      const { planner, note1, note2, collector } = setup('note1.md', 'Edited text, see [[note2]].');
      collector.references = [{ ...FixedReferenceCollector.bodyReferenceIn(note1, 'See [[note2]].', '[[note2]]') }];
      // WHEN planned
      // THEN it refuses instead of guessing
      expect(kindOf(await planner.plan(note2))).toBe('note-changed');
    });
  });
});
