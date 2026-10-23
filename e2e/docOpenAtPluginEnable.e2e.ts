// S14 — A doc ALREADY OPEN when the plugin is enabled (fresh enable, plugin update reload,
// hot-reload). No active-leaf-change ever reaches the plugin for that doc, so the plugin
// must sync with the already-active leaf on layout ready (FocusTracker.syncWithActiveLeaf)
// — otherwise A's session never opens and switching away records nothing (regression).
// Open A before enable, dwell, switch to B → A's session is recorded.
import { expect, test } from '@playwright/test';
import { DOC_ID_A, FILE_A, FILE_B } from './constants';
import { HIGH_IDLE_SECONDS } from './harnessFixture';
import { ObsidianHarness } from './obsidianHarness';
import { parseDurationMs, pollForSessionLine, sleep, vhFilePath } from './vhAssert';

const DWELL_MS = 1500;
const POLL = { timeoutMs: 15_000 } as const;

test.describe('S14 doc already open when the plugin is enabled', () => {
  let harness: ObsidianHarness | undefined;

  test.beforeEach(async () => {
    harness = await ObsidianHarness.launch({
      idleTimeoutSeconds: HIGH_IDLE_SECONDS,
      minFocusSecondsToRecord: 0,
      openFileBeforeEnable: FILE_A,
    });
  });
  test.afterEach(async () => {
    if (harness) await harness.close();
    harness = undefined;
  });

  const getHarness = (): ObsidianHarness => {
    if (!harness) throw new Error('harness accessed outside a test (beforeEach did not run)');
    return harness;
  };

  test('A, open before enable, records one session after switching A→B', async () => {
    const h = getHarness();
    await sleep(DWELL_MS);
    await h.openFile(FILE_B);

    const result = await pollForSessionLine(vhFilePath(h.vaultDir, DOC_ID_A), POLL);

    // AC14.1 — exactly one closed session line for A.
    expect(result.lines).toHaveLength(1);
    // AC14.2 — the session covers the dwell (half of it: tolerates enable/sync latency).
    expect(parseDurationMs(result.firstLine)).toBeGreaterThanOrEqual(DWELL_MS / 2);
  });
});
