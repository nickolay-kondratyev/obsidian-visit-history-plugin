// S9 — Inline note (visit history aware), key journey.
//
// note1 links note2 exactly once; note2 has seeded V3 history. With note2 open, the
// `inline-note` command → confirm dialog → "Inline note" must leave on disk:
//   - note2's content inside note1 (and the link gone),
//   - note2 moved to the trash (vault set to the local `.trash/` for determinism),
//   - note2's history MOVED (not copied) under note1's merged-in dir — the seeded line
//     first, followed by the session closed when note2 was released before the move.
// The vault also holds an empty note, which must not read as "still indexing".
// Placement/heading/frontmatter rules are covered by unit tests, not here.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { DEVICE_NAME, PLUGIN_ID, USER_NAME, VH_TOP_DIR } from './constants';
import { ObsidianHarness } from './obsidianHarness';
import { pollUntil, vhFilePath } from './vhAssert';

const NOTE1_ID = 'docid_dddddddddddddddddddddddd_e';
const NOTE2_ID = 'docid_eeeeeeeeeeeeeeeeeeeeeeee_e';
const NOTE1 = 'Inline target.md';
const NOTE2 = 'Inline source.md';
const NOTE2_BODY = 'Inline source body text.';
const SEEDED_SESSION = '2026-01-02T03:04:05.678Z D:4200\n';
const POLL = { timeoutMs: 15_000 } as const;

/** Keep in sync with VhV3Paths.mergedInDocDir. */
function mergedInFilePath(vaultDir: string): string {
  return join(
    vaultDir, VH_TOP_DIR, 'user', USER_NAME, 'v3', 'merged_in_focus_duration_per_device',
    DEVICE_NAME, NOTE1_ID, `${NOTE2_ID}.vh_v3`,
  );
}

test.describe('S9 inline note (visit history aware)', () => {
  let harness: ObsidianHarness | undefined;

  test.afterEach(async () => {
    if (harness) await harness.close();
    harness = undefined;
  });

  test('moves note2 content into note1, trashes note2, and moves its history under note1', async () => {
    const h = await ObsidianHarness.launch({
      idleTimeoutSeconds: 180,
      minFocusSecondsToRecord: 0,
      seedFiles: [
        { path: '.obsidian/app.json', content: JSON.stringify({ trashOption: 'local' }) },
        { path: NOTE1, content: `---\nid: ${NOTE1_ID}\n---\n## Topic\nSee [[Inline source]].\n` },
        { path: NOTE2, content: `---\nid: ${NOTE2_ID}\n---\n${NOTE2_BODY}\n` },
        // An empty note must still get a metadataCache entry, or the still-indexing
        // refusal (any unindexed .md) would block inlining forever.
        { path: 'Empty note.md', content: '' },
        {
          path: `${VH_TOP_DIR}/user/${USER_NAME}/v3/focus_duration_per_device/${DEVICE_NAME}/${NOTE2_ID}.vh_v3`,
          content: SEEDED_SESSION,
        },
      ],
    });
    harness = h;
    await h.waitForResolvedLink(NOTE1, NOTE2);
    await h.waitForMarkdownIndexed();

    await h.openFile(NOTE2);
    await h.runCommand(`${PLUGIN_ID}:inline-note`);
    await h.page.getByRole('button', { name: 'Inline note', exact: true }).click();

    const note2Path = join(h.vaultDir, NOTE2);
    await pollUntil(() => !existsSync(note2Path), `note2 gone from ${note2Path}`, POLL);
    expect(existsSync(join(h.vaultDir, '.trash', NOTE2))).toBe(true);

    const note1Content = readFileSync(join(h.vaultDir, NOTE1), 'utf8');
    expect(note1Content).toContain(NOTE2_BODY);
    expect(note1Content).not.toContain('[[Inline source]]');

    const merged = mergedInFilePath(h.vaultDir);
    await pollUntil(() => existsSync(merged), `merged-in history at ${merged}`, POLL);
    expect(readFileSync(merged, 'utf8').startsWith(SEEDED_SESSION)).toBe(true);
    expect(existsSync(vhFilePath(h.vaultDir, NOTE2_ID))).toBe(false);
  });
});
