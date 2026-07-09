import { describe, expect, it } from 'vitest';
import { FrontmatterDocIdStore } from './FrontmatterDocIdStore';
import { DocIdGenerator } from './DocIdGenerator';
import { FakeNoteFileUtil } from '../../../testSupport/FakeNoteFileUtil';
import { FakeFrontmatterUtil } from '../../../testSupport/FakeFrontmatterUtil';

class FixedDocIdGenerator implements DocIdGenerator {
  constructor(private readonly id: string) {
  }

  generate(): string {
    return this.id;
  }
}

const GENERATED_ID = 'docid_AAAAAAAAAAAAAAAAAAAAA_E';

interface Setup {
  store: FrontmatterDocIdStore;
  noteFileUtil: FakeNoteFileUtil;
  frontmatterUtil: FakeFrontmatterUtil;
}

function setup(): Setup {
  const noteFileUtil = new FakeNoteFileUtil();
  const frontmatterUtil = new FakeFrontmatterUtil();
  const store = new FrontmatterDocIdStore(frontmatterUtil, noteFileUtil, new FixedDocIdGenerator(GENERATED_ID));
  return { store, noteFileUtil, frontmatterUtil };
}

describe('FrontmatterDocIdStore', () => {
  describe('ensureId', () => {
    it('should return the existing frontmatter id without any write', async () => {
      // GIVEN a note that already has an id in frontmatter
      const { store, noteFileUtil, frontmatterUtil } = setup();
      const file = noteFileUtil.seedNote('notes/a.md', '---\nid: existing-id-123\n---\nbody');
      // WHEN
      const id = await store.ensureId(file);
      // THEN the existing id is returned and processFrontMatter was never called
      expect({ id, writes: frontmatterUtil.processFrontMatterCallCount })
        .toEqual({ id: 'existing-id-123', writes: 0 });
    });

    it('should return an existing id that does NOT follow the docid_ format', async () => {
      // GIVEN a note with a foreign-format id
      const { store, noteFileUtil } = setup();
      const file = noteFileUtil.seedNote('notes/a.md', '---\nid: some-legacy-uuid\n---\n');
      // WHEN / THEN
      expect(await store.ensureId(file)).toBe('some-legacy-uuid');
    });

    it('should strip YAML quotes around an existing id', async () => {
      // GIVEN a quoted id value
      const { store, noteFileUtil } = setup();
      const file = noteFileUtil.seedNote('notes/a.md', '---\nid: "quoted-id"\n---\n');
      // WHEN / THEN
      expect(await store.ensureId(file)).toBe('quoted-id');
    });

    it('should generate and persist an id when the note has no frontmatter', async () => {
      // GIVEN a plain note without frontmatter
      const { store, noteFileUtil, frontmatterUtil } = setup();
      const file = noteFileUtil.seedNote('notes/a.md', '# Just a heading');
      // WHEN
      const id = await store.ensureId(file);
      // THEN the generated id is returned and written to frontmatter
      expect({ id, persisted: frontmatterUtil.frontmatterByPath.get('notes/a.md') })
        .toEqual({ id: GENERATED_ID, persisted: { id: GENERATED_ID } });
    });

    it('should generate an id when frontmatter exists but has no id key', async () => {
      // GIVEN frontmatter with other keys
      const { store, noteFileUtil, frontmatterUtil } = setup();
      frontmatterUtil.seedFrontmatter('notes/a.md', { tags: ['x'] });
      const file = noteFileUtil.seedNote('notes/a.md', '---\ntags:\n  - x\n---\n');
      // WHEN
      const id = await store.ensureId(file);
      // THEN existing keys are preserved and id is added
      expect({ id, persisted: frontmatterUtil.frontmatterByPath.get('notes/a.md') })
        .toEqual({ id: GENERATED_ID, persisted: { tags: ['x'], id: GENERATED_ID } });
    });

    it('should treat an empty id value as missing and generate a new id', async () => {
      // GIVEN frontmatter with an empty id
      const { store, noteFileUtil } = setup();
      const file = noteFileUtil.seedNote('notes/a.md', '---\nid:\n---\n');
      // WHEN / THEN
      expect(await store.ensureId(file)).toBe(GENERATED_ID);
    });

    it('should NOT overwrite an id the raw-text fast path missed but the parsed frontmatter has', async () => {
      // GIVEN raw content without a detectable id line, but parsed frontmatter carrying one
      const { store, noteFileUtil, frontmatterUtil } = setup();
      frontmatterUtil.seedFrontmatter('notes/a.md', { id: 'parsed-only-id' });
      const file = noteFileUtil.seedNote('notes/a.md', 'body without frontmatter block');
      // WHEN
      const id = await store.ensureId(file);
      // THEN the parsed id wins and is not replaced
      expect({ id, persisted: frontmatterUtil.frontmatterByPath.get('notes/a.md') })
        .toEqual({ id: 'parsed-only-id', persisted: { id: 'parsed-only-id' } });
    });

    it('should NOT overwrite an object-valued id (unusable but occupied slot)', async () => {
      // GIVEN frontmatter whose id slot holds an object
      const { store, noteFileUtil, frontmatterUtil } = setup();
      frontmatterUtil.seedFrontmatter('notes/a.md', { id: { weird: true } });
      const file = noteFileUtil.seedNote('notes/a.md', 'body');
      // WHEN
      const id = await store.ensureId(file);
      // THEN no usable id, and the object is left untouched
      expect({ id, persisted: frontmatterUtil.frontmatterByPath.get('notes/a.md') })
        .toEqual({ id: null, persisted: { id: { weird: true } } });
    });

    it('should NOT match an indented (nested) id key as the document id', async () => {
      // GIVEN frontmatter where `id` only exists nested under another key
      const { store, noteFileUtil } = setup();
      const file = noteFileUtil.seedNote('notes/a.md', '---\nmeta:\n  id: nested-id\n---\n');
      // WHEN / THEN a new top-level id is generated
      expect(await store.ensureId(file)).toBe(GENERATED_ID);
    });
  });
});
