// S6 — Sub-floor idle timeout via a DEV config overrides file.
// data.json requests a high idle (180 s), but a dev overrides file sets a SUB-FLOOR
// idle of 1 s — impossible through data.json (the plugin clamps it to the min-5 floor).
// Opening A and sending NO input must close the session in ~1 s, well under the 5 s
// floor, proving the override (not the persisted setting) drives the idle path.
import { expect, test } from '@playwright/test';
import { DOC_ID_A, FILE_A } from './constants';
import { useHarness } from './harnessFixture';
import { pollForSessionLine, vhFilePath } from './vhAssert';

const SETTINGS_IDLE_SECONDS = 180; // high: without the override the session would NOT close in time.
const OVERRIDE_IDLE_SECONDS = 1; // sub-floor (< the plugin's MIN_IDLE_TIMEOUT_SECONDS of 5).

test.describe('S6 sub-floor idle via dev overrides', () => {
  const getHarness = useHarness(SETTINGS_IDLE_SECONDS, { idleTimeoutSeconds: OVERRIDE_IDLE_SECONDS });

  test('override drives the idle close below the enforced floor', async () => {
    const h = getHarness();
    const aFile = vhFilePath(h.vaultDir, DOC_ID_A);
    await h.openFile(FILE_A);

    // AC6.1 — the session closes and gets its single line via the 1 s idle path.
    const result = await pollForSessionLine(aFile, { timeoutMs: 10_000 });
    expect(result.lines).toHaveLength(1);

    // AC6.2 — it closed well under the 5 s floor: only the sub-floor override
    //         (not the 180 s setting, not the clamped floor) could do that.
    expect(result.elapsedMs).toBeLessThan(4_000);
  });
});
