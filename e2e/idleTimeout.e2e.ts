// S5 — Unfocus on idle (fast idle).
// idleTimeoutSeconds=5 (the enforced floor). Open A, send NO input. At 5 s of inactivity
// the session closes with its duration ending at the LAST activity (idle tail not counted),
// with NO 10 s grace. The close therefore lands well before the 10 s grace could apply.
import { expect, test } from '@playwright/test';
import { DOC_ID_A, FILE_A } from './constants';
import { useHarness } from './harnessFixture';
import { parseDurationMs, pollForSessionLine, vhFilePath } from './vhAssert';

const IDLE_SECONDS = 5; // the plugin-enforced floor; the idle path must fire fast.

test.describe('S5 unfocus on idle', () => {
  const getHarness = useHarness(IDLE_SECONDS);

  test('idle closes the session at last activity, below the idle window', async () => {
    const h = getHarness();
    const aFile = vhFilePath(h.vaultDir, DOC_ID_A);
    await h.openFile(FILE_A);

    // AC5.1 — within the idle budget (5 s idle + append + margin) A gets one line.
    const result = await pollForSessionLine(aFile, { timeoutMs: 12_000 });
    expect(result.lines).toHaveLength(1);

    // AC5.2 — duration ends at last activity: strictly below the 5 s idle window
    //         (proves the idle tail is NOT counted, not merely "a line exists").
    const durationMs = parseDurationMs(result.firstLine);
    expect(durationMs).toBeGreaterThanOrEqual(0);
    expect(durationMs).toBeLessThan(5_000);

    // AC5.3 — the line appeared via the idle path, not the 10 s grace path.
    expect(result.elapsedMs).toBeLessThan(9_000);
  });
});
