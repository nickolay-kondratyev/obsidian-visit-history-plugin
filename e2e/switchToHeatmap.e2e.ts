// S6 — Opening the vault heatmap from a focused note.
// The heatmap opens in a NEW tab → the active leaf becomes an untracked view → A is
// unfocused. The close resolves after the fixed unfocus grace and is stamped at the
// ORIGINAL unfocus moment, so A gets exactly one line whose duration excludes the grace.
import { expect, test } from '@playwright/test';
import { CMD_OPEN_VAULT_HEATMAP, DOC_ID_A, FILE_A, UNFOCUS_GRACE_MS } from './constants';
import { HIGH_IDLE_SECONDS, useHarness } from './harnessFixture';
import { parseDurationMs, pollForSessionLine, sessionLines, sleep, vhFilePath } from './vhAssert';

const DWELL_MS = 1000;
// Grace + generous margin for the async append.
const POLL_TIMEOUT_MS = UNFOCUS_GRACE_MS + 10_000;
// Bounded margin after the line landed: a re-opened/still-running session would append
// again only on a later close, which nothing triggers — so a second line here is a bug.
const NO_SECOND_LINE_WINDOW_MS = 2000;

test.describe('S6 switch to the vault heatmap', () => {
  const getHarness = useHarness(HIGH_IDLE_SECONDS);

  test('opening the heatmap closes A with exactly one bounded session', async () => {
    const h = getHarness();
    const aFile = vhFilePath(h.vaultDir, DOC_ID_A);

    await h.openFile(FILE_A);
    await sleep(DWELL_MS);
    await h.runCommand(CMD_OPEN_VAULT_HEATMAP);

    const result = await pollForSessionLine(aFile, { timeoutMs: POLL_TIMEOUT_MS });
    const durationMs = parseDurationMs(result.firstLine);
    // Stamped at the unfocus (heatmap open), never at grace expiry.
    expect(durationMs).toBeGreaterThanOrEqual(DWELL_MS / 2);
    expect(durationMs).toBeLessThan(UNFOCUS_GRACE_MS);

    await sleep(NO_SECOND_LINE_WINDOW_MS);
    expect(sessionLines(aFile)).toHaveLength(1);
  });
});
