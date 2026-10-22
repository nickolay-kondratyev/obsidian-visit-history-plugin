// S3 — Opening Settings ends the focused doc's session (owner decision,
// ticket nid_5psjwpcu4tnmjxy1kdjni7u97_E).
//
// Settings is a modal: it does NOT change the active leaf nor blur the OS window
// (Obsidian 1.12.7). The plugin detects it via an undocumented DOM contract
// (WindowActivityMonitor.SETTINGS_MODAL_SELECTOR) and treats it like a window blur:
// open → A's session closes immediately (no unfocus grace); close → a NEW session
// starts for the still-focused A. This spec is the guard for that DOM contract on
// Obsidian bumps — if Obsidian renames the classes, the first poll times out.
import { expect, test } from '@playwright/test';
import { DOC_ID_A, FILE_A, FILE_B, UNFOCUS_GRACE_MS } from './constants';
import { HIGH_IDLE_SECONDS, useHarness } from './harnessFixture';
import { parseDurationMs, pollForSessionLine, pollUntil, sessionLines, sleep, vhFilePath } from './vhAssert';

const DWELL_MS = 1000;
// Well under the unfocus grace: the close must come from Settings-open itself.
const IMMEDIATE_CLOSE_TIMEOUT_MS = UNFOCUS_GRACE_MS / 2;
const SECOND_SESSION_TIMEOUT_MS = 15_000;
const MAX_SANE_DURATION_MS = 60_000;

test.describe('S3 switch to Settings', () => {
  const getHarness = useHarness(HIGH_IDLE_SECONDS);

  test('Settings-open closes A at once; Settings-close starts a new session for A', async () => {
    const h = getHarness();
    const aFile = vhFilePath(h.vaultDir, DOC_ID_A);

    await h.openFile(FILE_A);
    await sleep(DWELL_MS);
    await h.openSettings();

    const first = await pollForSessionLine(aFile, { timeoutMs: IMMEDIATE_CLOSE_TIMEOUT_MS });
    const firstDurationMs = parseDurationMs(first.firstLine);
    expect(firstDurationMs).toBeGreaterThanOrEqual(0);
    expect(firstDurationMs).toBeLessThan(MAX_SANE_DURATION_MS);

    // Closing Settings re-opens a session for A; switching to B then closes it.
    await h.closeSettings();
    await sleep(DWELL_MS);
    await h.openFile(FILE_B);

    await pollUntil(() => sessionLines(aFile).length >= 2, 'a second session line for A', {
      timeoutMs: SECOND_SESSION_TIMEOUT_MS,
    });
    expect(sessionLines(aFile)).toHaveLength(2);
  });
});
