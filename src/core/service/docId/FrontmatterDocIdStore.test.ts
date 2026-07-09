import { describe, expect, it } from 'vitest';
import { FrontmatterDocIdStore } from './FrontmatterDocIdStore';
import { DocIdGenerator } from './DocIdGenerator';
import { FakeNoteFileUtil } from '../../../testSupport/FakeNoteFileUtil';

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
}

function setup(): Setup {
  const noteFileUtil = new FakeNoteFileUtil();
  const store = new FrontmatterDocIdStore(noteFileUtil, new FixedDocIdGenerator(GENERATED_ID));
  return { store, noteFileUtil };
}

describe('FrontmatterDocIdStore', () => {
  describe('getId', () => {
    it('should return the existing frontmatter id without any write', async () => {
      // GIVEN a note that already has an id in frontmatter
      const { store, noteFileUtil } = setup();
      const file = noteFileUtil.seedNote('notes/a.md', '---\nid: existing-id-123\n---\nbody');
      // WHEN
      const id = await store.getId(file);
      // THEN the id is returned and process() was never called
      expect({ id, writes: noteFileUtil.processCallCount })
        .toEqual({ id: 'existing-id-123', writes: 0 });
    });

    it('should return null (and NOT generate an id) when the note has none', async () => {
      // GIVEN a note without an id
      const { store, noteFileUtil } = setup();
      const file = noteFileUtil.seedNote('notes/a.md', '---\ntitle: t\n---\nbody');
      // WHEN
      const id = await store.getId(file);
      // THEN null, read-only (no write happened)
      expect({ id, writes: noteFileUtil.processCallCount }).toEqual({ id: null, writes: 0 });
    });
  });

  describe('ensureId', () => {
    it('should return the existing frontmatter id without any write', async () => {
      // GIVEN a note that already has an id in frontmatter
      const { store, noteFileUtil } = setup();
      const file = noteFileUtil.seedNote('notes/a.md', '---\nid: existing-id-123\n---\nbody');
      // WHEN
      const id = await store.ensureId(file);
      // THEN the existing id is returned and process() was never called
      expect({ id, writes: noteFileUtil.processCallCount })
        .toEqual({ id: 'existing-id-123', writes: 0 });
    });

    it('should return an existing id that does NOT follow the docid_ format', async () => {
      // GIVEN a note with a foreign-format id
      const { store, noteFileUtil } = setup();
      const file = noteFileUtil.seedNote('notes/a.md', '---\nid: some-legacy-uuid\n---\n');
      // WHEN / THEN
      expect(await store.ensureId(file)).toBe('some-legacy-uuid');
    });

    it('should return an existing id declared with a quoted key without any write', async () => {
      // GIVEN a note whose id key is quoted YAML
      const { store, noteFileUtil } = setup();
      const file = noteFileUtil.seedNote('notes/a.md', '---\n"id": quoted-key-id\n---\n');
      // WHEN
      const id = await store.ensureId(file);
      // THEN
      expect({ id, writes: noteFileUtil.processCallCount })
        .toEqual({ id: 'quoted-key-id', writes: 0 });
    });

    it('should detect an existing id in CRLF (Windows) frontmatter without any write', async () => {
      // GIVEN a note with CRLF line endings
      const { store, noteFileUtil } = setup();
      const file = noteFileUtil.seedNote('notes/a.md', '---\r\nid: crlf-id\r\n---\r\nbody');
      // WHEN
      const id = await store.ensureId(file);
      // THEN
      expect({ id, writes: noteFileUtil.processCallCount })
        .toEqual({ id: 'crlf-id', writes: 0 });
    });

    it('should strip a trailing YAML comment from an existing id value', async () => {
      // GIVEN an id line carrying a YAML comment
      const { store, noteFileUtil } = setup();
      const file = noteFileUtil.seedNote('notes/a.md', '---\nid: abc # assigned manually\n---\n');
      // WHEN
      const id = await store.ensureId(file);
      // THEN the comment is not part of the id and no write happens
      expect({ id, writes: noteFileUtil.processCallCount })
        .toEqual({ id: 'abc', writes: 0 });
    });

    it('should strip a trailing YAML comment after a quoted id value', async () => {
      // GIVEN a quoted id followed by a comment
      const { store, noteFileUtil } = setup();
      const file = noteFileUtil.seedNote('notes/a.md', '---\nid: "abc" # assigned manually\n---\n');
      // WHEN / THEN
      expect(await store.ensureId(file)).toBe('abc');
    });

    it('should keep a # without preceding whitespace as part of the id', async () => {
      // GIVEN an id containing '#' with no space before it (YAML: not a comment)
      const { store, noteFileUtil } = setup();
      const file = noteFileUtil.seedNote('notes/a.md', '---\nid: a#b\n---\n');
      // WHEN / THEN
      expect(await store.ensureId(file)).toBe('a#b');
    });

    it('should strip YAML quotes around an existing id', async () => {
      // GIVEN a quoted id value
      const { store, noteFileUtil } = setup();
      const file = noteFileUtil.seedNote('notes/a.md', '---\nid: "quoted-id"\n---\n');
      // WHEN / THEN
      expect(await store.ensureId(file)).toBe('quoted-id');
    });

    it('should create a frontmatter block with the id when the note has none', async () => {
      // GIVEN a plain note without frontmatter
      const { store, noteFileUtil } = setup();
      const file = noteFileUtil.seedNote('notes/a.md', '# Just a heading');
      // WHEN
      const id = await store.ensureId(file);
      // THEN a new block is prepended and the body is untouched
      expect({ id, content: noteFileUtil.getContent('notes/a.md') })
        .toEqual({ id: GENERATED_ID, content: `---\nid: ${GENERATED_ID}\n---\n# Just a heading` });
    });

    it('should preserve existing frontmatter formatting byte-for-byte when adding an id (quoted keys stay quoted)', async () => {
      // GIVEN frontmatter with a quoted key and no id
      const { store, noteFileUtil } = setup();
      const file = noteFileUtil.seedNote(
        'notes/a.md',
        '---\n"someother field 3": v3\n---\nbody',
      );
      // WHEN
      await store.ensureId(file);
      // THEN only the id line is added; every pre-existing byte is untouched
      expect(noteFileUtil.getContent('notes/a.md'))
        .toBe(`---\nid: ${GENERATED_ID}\n"someother field 3": v3\n---\nbody`);
    });

    it('should insert the id as the first entry when frontmatter exists but has no id key', async () => {
      // GIVEN frontmatter with other keys
      const { store, noteFileUtil } = setup();
      const file = noteFileUtil.seedNote('notes/a.md', '---\ntags:\n  - x\n---\nbody');
      // WHEN
      const id = await store.ensureId(file);
      // THEN existing keys are preserved verbatim and id is added on top
      expect({ id, content: noteFileUtil.getContent('notes/a.md') })
        .toEqual({ id: GENERATED_ID, content: `---\nid: ${GENERATED_ID}\ntags:\n  - x\n---\nbody` });
    });

    it('should insert the id with CRLF line endings when the note uses CRLF', async () => {
      // GIVEN a CRLF note without an id
      const { store, noteFileUtil } = setup();
      const file = noteFileUtil.seedNote('notes/a.md', '---\r\ntags: x\r\n---\r\nbody');
      // WHEN
      await store.ensureId(file);
      // THEN the inserted line matches the file's EOL style
      expect(noteFileUtil.getContent('notes/a.md'))
        .toBe(`---\r\nid: ${GENERATED_ID}\r\ntags: x\r\n---\r\nbody`);
    });

    it('should fill an empty id value in place', async () => {
      // GIVEN frontmatter with an empty id
      const { store, noteFileUtil } = setup();
      const file = noteFileUtil.seedNote('notes/a.md', '---\ntags: x\nid:\n---\n');
      // WHEN
      const id = await store.ensureId(file);
      // THEN the empty id line is filled without duplicating the key
      expect({ id, content: noteFileUtil.getContent('notes/a.md') })
        .toEqual({ id: GENERATED_ID, content: `---\ntags: x\nid: ${GENERATED_ID}\n---\n` });
    });

    it('should populate a degenerate empty frontmatter block', async () => {
      // GIVEN '---' immediately followed by the closing '---'
      const { store, noteFileUtil } = setup();
      const file = noteFileUtil.seedNote('notes/a.md', '---\n---\nbody');
      // WHEN
      await store.ensureId(file);
      // THEN
      expect(noteFileUtil.getContent('notes/a.md')).toBe(`---\nid: ${GENERATED_ID}\n---\nbody`);
    });

    it('should prepend a new block when a leading --- is a thematic break (no closing delimiter)', async () => {
      // GIVEN a note starting with '---' that never closes (not frontmatter)
      const { store, noteFileUtil } = setup();
      const file = noteFileUtil.seedNote('notes/a.md', '---\nnot frontmatter');
      // WHEN
      await store.ensureId(file);
      // THEN a real block is prepended; the break stays in the body untouched
      expect(noteFileUtil.getContent('notes/a.md'))
        .toBe(`---\nid: ${GENERATED_ID}\n---\n---\nnot frontmatter`);
    });

    it('should ignore an id-looking line in the body when there is no frontmatter', async () => {
      // GIVEN a body line that merely looks like an id entry
      const { store, noteFileUtil } = setup();
      const file = noteFileUtil.seedNote('notes/a.md', 'id: fake-body-id\ntext');
      // WHEN
      const id = await store.ensureId(file);
      // THEN a new block is created; the body line is not treated as an id
      expect({ id, content: noteFileUtil.getContent('notes/a.md') })
        .toEqual({ id: GENERATED_ID, content: `---\nid: ${GENERATED_ID}\n---\nid: fake-body-id\ntext` });
    });

    it('should NOT overwrite an id slot holding a nested mapping (unusable but occupied)', async () => {
      // GIVEN frontmatter whose id key opens a nested mapping
      const { store, noteFileUtil } = setup();
      const content = '---\nid:\n  weird: true\n---\nbody';
      const file = noteFileUtil.seedNote('notes/a.md', content);
      // WHEN
      const id = await store.ensureId(file);
      // THEN no usable id, and the mapping is left byte-identical
      expect({ id, content: noteFileUtil.getContent('notes/a.md') })
        .toEqual({ id: null, content });
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
