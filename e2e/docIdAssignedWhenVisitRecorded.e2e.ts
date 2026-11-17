// S13 — A note WITHOUT a doc id gets one only when a visit is RECORDED, never on focus.
// The seed vault's notes all carry seeded ids; a real vault mostly does not. Focusing an
// id-less note must leave the file untouched (an external editor, e.g. an AI agent, may be
// writing it). Once the visit is recorded (session closed AND past the min-focus gate) a
// fresh `docid_<24 base36>_e` lands in its frontmatter and the visit is recorded under THAT
// id. A visit dropped by the min-focus gate never writes an id (PluginFactory wiring of
// tracker → min-focus filter → recorder has no unit test).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { FILE_A, FRONTMATTER_DOC_ID_LINE_RE } from './constants';
import { ObsidianHarness } from './obsidianHarness';
import { pollForSessionLine, pollUntil, sessionLines, sleep, vhFilePath } from './vhAssert';

const ID_LESS_NOTE = 'No id yet.md';
const ID_LESS_CONTENT = '# No id yet\n\nA note never focused before.\n';
// Long enough that the OLD on-focus id write (landing within milliseconds) would show.
const DWELL_MS = 2000;
const POLL = { timeoutMs: 15_000 } as const;
// Bounded margin after the line landed: nothing re-focuses the note, so a second line
// (e.g. a session split by the id write) would be a bug.
const NO_SECOND_LINE_WINDOW_MS = 2000;
// Min focus well above DWELL_MS, so the quick visit is dropped by the gate.
const MIN_FOCUS_ABOVE_DWELL_SECONDS = 5;
// Bounded wait after the dropped close: a (buggy) record-time id write would land well within it.
const NO_ID_WRITE_WINDOW_MS = 3000;

test.describe('S13 doc id assigned only when a visit is recorded', () => {
  let harness: ObsidianHarness | undefined;

  test.afterEach(async () => {
    if (harness) await harness.close();
    harness = undefined;
  });

  test('leaves the note untouched while focused, assigns the id once the visit is recorded', async () => {
    const h = await ObsidianHarness.launch({
      idleTimeoutSeconds: 180,
      minFocusSecondsToRecord: 0,
      seedFiles: [{ path: ID_LESS_NOTE, content: ID_LESS_CONTENT }],
    });
    harness = h;
    const notePath = join(h.vaultDir, ID_LESS_NOTE);

    await h.openFile(ID_LESS_NOTE);
    await sleep(DWELL_MS);

    // AC13.1 — focusing did not modify the note.
    expect(readFileSync(notePath, 'utf8')).toBe(ID_LESS_CONTENT);

    // Leaving it for another doc closes (and, past min focus 0, records) the session.
    await h.openFile(FILE_A);

    // AC13.2 — recording the visit wrote a generated doc id into the frontmatter.
    await pollUntil(
      () => FRONTMATTER_DOC_ID_LINE_RE.test(readFileSync(notePath, 'utf8')),
      `a generated doc id line in ${notePath}`,
      POLL,
    );
    const docId = readFileSync(notePath, 'utf8').match(FRONTMATTER_DOC_ID_LINE_RE)?.[1];
    if (docId === undefined) throw new Error(`doc id vanished from ${notePath}`);

    // AC13.3 — the visit is recorded under THAT id: exactly one session line.
    const noteVhFile = vhFilePath(h.vaultDir, docId);
    await pollForSessionLine(noteVhFile, POLL);
    await sleep(NO_SECOND_LINE_WINDOW_MS);
    expect(sessionLines(noteVhFile)).toHaveLength(1);
  });

  test('a quick in-and-out below the min focus time leaves the note without an id', async () => {
    const h = await ObsidianHarness.launch({
      idleTimeoutSeconds: 180,
      minFocusSecondsToRecord: MIN_FOCUS_ABOVE_DWELL_SECONDS,
      seedFiles: [{ path: ID_LESS_NOTE, content: ID_LESS_CONTENT }],
    });
    harness = h;
    const notePath = join(h.vaultDir, ID_LESS_NOTE);

    await h.openFile(ID_LESS_NOTE);
    await sleep(DWELL_MS);
    await h.openFile(FILE_A); // a different-doc focus finalizes the sub-threshold close at once
    await sleep(NO_ID_WRITE_WINDOW_MS);

    // AC13.4 — the dropped visit left the note byte-for-byte untouched (no id).
    expect(readFileSync(notePath, 'utf8')).toBe(ID_LESS_CONTENT);
  });
});
