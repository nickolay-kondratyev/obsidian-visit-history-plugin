// S13 — First focus of a note WITHOUT a doc id.
// The seed vault's notes all carry seeded ids; a real vault mostly does not. Focusing an
// id-less note must write a fresh `docid_<24 base36>_e` into its frontmatter AND record
// the visit under THAT id — the doc-id listener and the V3 duration listener agree on
// the id end-to-end (PluginFactory wiring has no unit test).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { FILE_A, FRONTMATTER_DOC_ID_LINE_RE } from './constants';
import { ObsidianHarness } from './obsidianHarness';
import { pollForSessionLine, pollUntil, sessionLines, sleep, vhFilePath } from './vhAssert';

const ID_LESS_NOTE = 'No id yet.md';
const ID_LESS_CONTENT = '# No id yet\n\nA note never focused before.\n';
const DWELL_MS = 1000;
const POLL = { timeoutMs: 15_000 } as const;
// Bounded margin after the line landed: nothing re-focuses the note, so a second line
// (e.g. a session split by the id write) would be a bug.
const NO_SECOND_LINE_WINDOW_MS = 2000;

test.describe('S13 first focus of an id-less note', () => {
  let harness: ObsidianHarness | undefined;

  test.afterEach(async () => {
    if (harness) await harness.close();
    harness = undefined;
  });

  test('assigns a doc id on focus and records exactly one session under it', async () => {
    const h = await ObsidianHarness.launch({
      idleTimeoutSeconds: 180,
      minFocusSecondsToRecord: 0,
      seedFiles: [{ path: ID_LESS_NOTE, content: ID_LESS_CONTENT }],
    });
    harness = h;
    const notePath = join(h.vaultDir, ID_LESS_NOTE);

    await h.openFile(ID_LESS_NOTE);
    await sleep(DWELL_MS);
    await h.openFile(FILE_A);

    // AC13.1 — the note's frontmatter now holds a generated doc id.
    await pollUntil(
      () => FRONTMATTER_DOC_ID_LINE_RE.test(readFileSync(notePath, 'utf8')),
      `a generated doc id line in ${notePath}`,
      POLL,
    );
    const docId = readFileSync(notePath, 'utf8').match(FRONTMATTER_DOC_ID_LINE_RE)?.[1];
    if (docId === undefined) throw new Error(`doc id vanished from ${notePath}`);

    // AC13.2 — the visit is recorded under THAT id: exactly one session line.
    const noteVhFile = vhFilePath(h.vaultDir, docId);
    await pollForSessionLine(noteVhFile, POLL);
    await sleep(NO_SECOND_LINE_WINDOW_MS);
    expect(sessionLines(noteVhFile)).toHaveLength(1);
  });
});
