// S1 — Switching focus between documents.
// Open A, dwell, switch to B. Focusing a DIFFERENT tracked doc finalizes A's pending
// close immediately (no 10 s grace wait), so A's session lands within the append budget.
import { expect, test } from '@playwright/test';
import { DOC_ID_A, DOC_ID_B, FILE_A, FILE_B } from './constants';
import { HIGH_IDLE_SECONDS, useHarness } from './harnessFixture';
import { parseDurationMs, pollForSessionLine, sessionLines, sleep, vhFilePath } from './vhAssert';

test.describe('S1 focus switch between documents', () => {
  const getHarness = useHarness(HIGH_IDLE_SECONDS);

  test('A records exactly one bounded session after switching A→B', async () => {
    const h = getHarness();
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
    // This is a bounded ABSENCE check, not a race: nothing ever switches focus away from
    // B in this test, so B's session cannot close — there is no append to wait for. The 1 s
    // bound is only a generous margin over the observed ~1 s write budget (comfortably longer
    // than the append that DID land for A above), so a spurious/early B close would surface.
    const bFile = vhFilePath(h.vaultDir, DOC_ID_B);
    await sleep(1000);
    expect(sessionLines(bFile)).toHaveLength(0);
  });
});
