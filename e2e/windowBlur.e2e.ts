// S12 — Obsidian loses focus to another app (window blur).
// A window blur closes the hosting doc's session IMMEDIATELY (no unfocus grace); a
// refocus starts a NEW session for the still-current doc.
//
// The blur/focus are SYNTHETIC DOM events (see ObsidianHarness.blurWindow): headless
// Obsidian has no real OS focus switch. This proves the plugin's wiring inside real
// Obsidian, not that the OS delivers the signal.
import { expect, test } from '@playwright/test';
import { DOC_ID_A, FILE_A, FILE_B, UNFOCUS_GRACE_MS } from './constants';
import { HIGH_IDLE_SECONDS, useHarness } from './harnessFixture';
import { parseDurationMs, pollForSessionLine, pollUntil, sessionLines, sleep, vhFilePath } from './vhAssert';

const DWELL_MS = 1000;
// Well under the unfocus grace: the close must come from the blur itself.
const IMMEDIATE_CLOSE_TIMEOUT_MS = UNFOCUS_GRACE_MS / 2;
const SECOND_SESSION_TIMEOUT_MS = 15_000;
const MAX_SANE_DURATION_MS = 60_000;

test.describe('S12 Obsidian window blur (app deactivation)', () => {
  const getHarness = useHarness(HIGH_IDLE_SECONDS);

  test('window blur closes A at once; refocus starts a new session for A', async () => {
    const h = getHarness();
    const aFile = vhFilePath(h.vaultDir, DOC_ID_A);

    await h.openFile(FILE_A);
    await sleep(DWELL_MS);
    await h.blurWindow();

    const first = await pollForSessionLine(aFile, { timeoutMs: IMMEDIATE_CLOSE_TIMEOUT_MS });
    const firstDurationMs = parseDurationMs(first.firstLine);
    expect(firstDurationMs).toBeGreaterThanOrEqual(0);
    expect(firstDurationMs).toBeLessThan(MAX_SANE_DURATION_MS);

    await h.focusWindow();
    await sleep(DWELL_MS);
    await h.openFile(FILE_B);

    await pollUntil(() => sessionLines(aFile).length >= 2, 'a second session line for A', {
      timeoutMs: SECOND_SESSION_TIMEOUT_MS,
    });
    expect(sessionLines(aFile)).toHaveLength(2);
  });
});
