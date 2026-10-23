// S18 — A doc in a POPOUT window: its session lives and dies with the popout's focus.
// B opened in a popout gets its own session (the plugin registers the popout window on
// `window-open` and keys the session to the popout's Document). Blurring the MAIN window
// must NOT close B's session; blurring the POPOUT closes it immediately (no grace).
//
// Blur is SYNTHETIC (see ObsidianHarness.blurWindow): headless Obsidian has no real OS
// focus switch. Headless popouts ARE real Electron windows (verified on 1.12.7).
import { expect, test } from '@playwright/test';
import { DOC_ID_B, FILE_A, FILE_B, UNFOCUS_GRACE_MS } from './constants';
import { HIGH_IDLE_SECONDS, useHarness } from './harnessFixture';
import { assertNoSessionLineWithin, parseDurationMs, pollForSessionLine, sleep, vhFilePath } from './vhAssert';

const DWELL_MS = 1000;
// Generous margin over the observed ~1 s write budget: a main-blur close would land in it.
const NO_CLOSE_WINDOW_MS = 2000;
// Well under the unfocus grace: the close must come from the popout blur itself.
const IMMEDIATE_CLOSE_TIMEOUT_MS = UNFOCUS_GRACE_MS / 2;

test.describe('S18 doc in a popout window', () => {
  const getHarness = useHarness(HIGH_IDLE_SECONDS);

  test('main-window blur keeps the popout doc session; popout blur closes it at once', async () => {
    const h = getHarness();
    const bFile = vhFilePath(h.vaultDir, DOC_ID_B);

    await h.openFile(FILE_A);
    await h.openFileInPopout(FILE_B);
    await sleep(DWELL_MS);

    // AC18.1 — blurring the window that does NOT host B leaves B's session open.
    await h.blurWindowHosting(FILE_A);
    await assertNoSessionLineWithin(bFile, { timeoutMs: NO_CLOSE_WINDOW_MS });

    // AC18.2 — blurring B's own (popout) window closes it immediately, the whole
    //          dwell + main-blur window counted.
    await h.blurWindowHosting(FILE_B);
    const result = await pollForSessionLine(bFile, { timeoutMs: IMMEDIATE_CLOSE_TIMEOUT_MS });
    expect(result.lines).toHaveLength(1);
    expect(parseDurationMs(result.firstLine)).toBeGreaterThanOrEqual(DWELL_MS + NO_CLOSE_WINDOW_MS);
  });
});
