// S2 — Closing Obsidian / unload flush.
// A hard process-kill races the async append and may lose the last session (documented
// limitation — NOT asserted). This drives the same graceful onunload → dispose() flush
// deterministically via disablePlugin (runs onunload while the process stays alive).
import { expect, test } from '@playwright/test';
import { DOC_ID_A, FILE_A } from './constants';
import { HIGH_IDLE_SECONDS, useHarness } from './harnessFixture';
import { parseDurationMs, pollForSessionLine, sleep, vhFilePath } from './vhAssert';

test.describe('S2 close / unload flush', () => {
  const getHarness = useHarness(HIGH_IDLE_SECONDS);

  test('open session is flushed on graceful plugin disable', async () => {
    const h = getHarness();
    await h.openFile(FILE_A);
    await sleep(1000);
    await h.disablePlugin(); // onunload → factory.dispose() → best-effort flush

    const aFile = vhFilePath(h.vaultDir, DOC_ID_A);
    const result = await pollForSessionLine(aFile, { timeoutMs: 15_000 });

    // AC2.1 — the still-open session is flushed to exactly one line.
    expect(result.lines).toHaveLength(1);

    // AC2.2 — bounded duration.
    const durationMs = parseDurationMs(result.firstLine);
    expect(durationMs).toBeGreaterThanOrEqual(0);
    expect(durationMs).toBeLessThan(60_000);
  });
});
