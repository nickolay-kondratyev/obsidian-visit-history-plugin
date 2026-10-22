import { describe, expect, it } from 'vitest';
import type { CachedMetadata, TFile } from 'obsidian';
import { EmbedFacts, EmbedInlineIconRule, EmbedLinkIndex } from './EmbedInlineIconRule';
import { makeTFile } from '../../testSupport/fileFactory';

const NOTE1 = 'note1.md';
const NOTE2 = makeTFile({ path: 'folder/note2.md' });

/** GIVEN-builder: a vault link index with only the given files and resolved links. */
class FakeLinkIndex implements EmbedLinkIndex {
  resolvedLinks: Record<string, Record<string, number>> = {};
  private readonly files = new Map<string, TFile>();
  private readonly frontmatterByPath = new Map<string, Record<string, unknown>>();

  withFile(file: TFile, frontmatter?: Record<string, unknown>): this {
    this.files.set(file.basename, file);
    if (frontmatter !== undefined) {
      this.frontmatterByPath.set(file.path, frontmatter);
    }
    return this;
  }

  withLinks(sourcePath: string, targetPath: string, count: number): this {
    this.resolvedLinks[sourcePath] = { ...this.resolvedLinks[sourcePath], [targetPath]: count };
    return this;
  }

  getFirstLinkpathDest(linkpath: string): TFile | null {
    return this.files.get(linkpath) ?? null;
  }

  getFileCache(file: TFile): CachedMetadata | null {
    const frontmatter = this.frontmatterByPath.get(file.path);
    return frontmatter === undefined ? {} : { frontmatter };
  }
}

function embedOf(src: string, overrides: Partial<EmbedFacts> = {}): EmbedFacts {
  return { src, sourcePath: NOTE1, isNested: false, isInCanvas: false, ...overrides };
}

/** note2 exists and is linked exactly once, from note1. */
function onlyLinkedFromNote1(): FakeLinkIndex {
  return new FakeLinkIndex().withFile(NOTE2).withLinks(NOTE1, NOTE2.path, 1);
}

describe('EmbedInlineIconRule', () => {
  describe('inlineTargetOf', () => {
    it('should return the embedded note when the embed is its only link', () => {
      // GIVEN note2 linked only by this embed in note1
      const rule = new EmbedInlineIconRule(onlyLinkedFromNote1());
      // WHEN the whole-note embed is checked
      // THEN the icon targets note2
      expect(rule.inlineTargetOf(embedOf('note2'))).toBe(NOTE2);
    });

    it('should return null when the link index has no link to the note', () => {
      const rule = new EmbedInlineIconRule(new FakeLinkIndex().withFile(NOTE2));
      expect(rule.inlineTargetOf(embedOf('note2'))).toBeNull();
    });

    it('should return null when the same note links it twice', () => {
      const rule = new EmbedInlineIconRule(new FakeLinkIndex().withFile(NOTE2).withLinks(NOTE1, NOTE2.path, 2));
      expect(rule.inlineTargetOf(embedOf('note2'))).toBeNull();
    });

    it('should return null when another note links it too', () => {
      const rule = new EmbedInlineIconRule(onlyLinkedFromNote1().withLinks('other.md', NOTE2.path, 1));
      expect(rule.inlineTargetOf(embedOf('note2'))).toBeNull();
    });

    it('should ignore self-links inside the embedded note', () => {
      // GIVEN note2 also linking itself
      const rule = new EmbedInlineIconRule(onlyLinkedFromNote1().withLinks(NOTE2.path, NOTE2.path, 3));
      // THEN the embed still counts as the only link
      expect(rule.inlineTargetOf(embedOf('note2'))).toBe(NOTE2);
    });

    it('should not count links to other notes', () => {
      const rule = new EmbedInlineIconRule(onlyLinkedFromNote1().withLinks('other.md', 'unrelated.md', 5));
      expect(rule.inlineTargetOf(embedOf('note2'))).toBe(NOTE2);
    });

    it('should return null for a heading embed', () => {
      expect(new EmbedInlineIconRule(onlyLinkedFromNote1()).inlineTargetOf(embedOf('note2#Heading'))).toBeNull();
    });

    it('should return null for a block embed', () => {
      expect(new EmbedInlineIconRule(onlyLinkedFromNote1()).inlineTargetOf(embedOf('note2#^abc123'))).toBeNull();
    });

    it('should return null for an unresolved embed', () => {
      expect(new EmbedInlineIconRule(onlyLinkedFromNote1()).inlineTargetOf(embedOf('missing'))).toBeNull();
    });

    it('should return null for an image embed', () => {
      const image = makeTFile({ path: 'pic.png' });
      const rule = new EmbedInlineIconRule(new FakeLinkIndex().withFile(image).withLinks(NOTE1, image.path, 1));
      expect(rule.inlineTargetOf(embedOf('pic'))).toBeNull();
    });

    it('should return null for a canvas embed', () => {
      const canvas = makeTFile({ path: 'board.canvas' });
      const rule = new EmbedInlineIconRule(new FakeLinkIndex().withFile(canvas).withLinks(NOTE1, canvas.path, 1));
      expect(rule.inlineTargetOf(embedOf('board'))).toBeNull();
    });

    it('should return null for an .excalidraw.md drawing', () => {
      // basename of 'Drawing.excalidraw.md' is 'Drawing.excalidraw'
      const drawing = makeTFile({ path: 'Drawing.excalidraw.md' });
      const rule = new EmbedInlineIconRule(new FakeLinkIndex().withFile(drawing).withLinks(NOTE1, drawing.path, 1));
      expect(rule.inlineTargetOf(embedOf('Drawing.excalidraw'))).toBeNull();
    });

    it('should return null for a markdown note marked as an Excalidraw drawing', () => {
      const drawing = makeTFile({ path: 'Drawing.md' });
      const index = new FakeLinkIndex().withFile(drawing, { 'excalidraw-plugin': 'parsed' }).withLinks(NOTE1, drawing.path, 1);
      expect(new EmbedInlineIconRule(index).inlineTargetOf(embedOf('Drawing'))).toBeNull();
    });

    it('should return the note when its frontmatter has unrelated keys', () => {
      const index = new FakeLinkIndex().withFile(NOTE2, { tags: ['x'] }).withLinks(NOTE1, NOTE2.path, 1);
      expect(new EmbedInlineIconRule(index).inlineTargetOf(embedOf('note2'))).toBe(NOTE2);
    });

    it('should return null for an embed nested inside another embed', () => {
      expect(new EmbedInlineIconRule(onlyLinkedFromNote1()).inlineTargetOf(embedOf('note2', { isNested: true }))).toBeNull();
    });

    it('should return null for an embed inside a canvas card', () => {
      expect(new EmbedInlineIconRule(onlyLinkedFromNote1()).inlineTargetOf(embedOf('note2', { isInCanvas: true }))).toBeNull();
    });
  });
});
