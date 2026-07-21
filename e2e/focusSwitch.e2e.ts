// S1 — Switching focus between documents.
// Open A, dwell, switch to B. Focusing a DIFFERENT tracked doc finalizes A's pending
// close immediately (no 10 s grace wait), so A's session lands within the append budget.
import { expect, test } from '@playwright/test';
import { DOC_ID_A, DOC_ID_B, FILE_A, FILE_B } from './constants';
import { ObsidianHarness } from './obsidianHarness';
import { parseDurationMs, pollForSessionLine, sessionLines, sleep, vhFilePath } from './vhAssert';

const HIGH_IDLE_SECONDS = 180; // idle timer must not fire during the brief dwell.

test.describe('S1 focus switch between documents', () => {
  let h: ObsidianHarness;

  test.beforeEach(async () => {
    h = await ObsidianHarness.launch({ idleTimeoutSeconds: HIGH_IDLE_SECONDS });
  });
  test.afterEach(async () => {
    await h.close();
  });

  test('A records exactly one bounded session after switching A→B', async () => {
    await h.openFile(FILE_A);
    await sleep(1000); // brief dwell so the session has a measurable duration
    await h.openFile(FILE_B);

    const aFile = vhFilePath(h.vaultDir, DOC_ID_A);
    const result = await pollForSessionLine(aFile, { timeoutMs: 15_000 });

    // AC1.1 — exactly one closed session line for A.
    expect(result.lines).toHaveLength(1);

    // AC1.2 — duration is a sane bounded integer.
    const durationMs = parseDurationMs(result.firstLine);
    expect(durationMs).toBeGreaterThanOrEqual(0);
    expect(durationMs).toBeLessThan(60_000);

    // AC1.3 — B's session is still open (per-doc isolation): no closed line yet.
    const bFile = vhFilePath(h.vaultDir, DOC_ID_B);
    await sleep(1000);
    expect(sessionLines(bFile)).toHaveLength(0);
  });
});
