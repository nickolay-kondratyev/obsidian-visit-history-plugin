// S16 — Same-doc refocus within the unfocus grace continues ONE session.
// Opening the heatmap (a NEW tab, untracked view) unfocuses A and starts the fixed
// 10 s grace; re-activating A's SAME leaf well within the grace must cancel the pending
// close — the session continues and the heatmap gap counts as focus time (owner
// decision). Switching to B then closes it: A gets exactly ONE line spanning the whole
// stretch. Grace EXPIRY (no refocus) is S11 (switchToHeatmap.e2e.ts).
import { expect, test } from '@playwright/test';
import { CMD_OPEN_VAULT_HEATMAP, DOC_ID_A, FILE_A, FILE_B, UNFOCUS_GRACE_MS, VIEW_TYPE_HEATMAP } from './constants';
import { HIGH_IDLE_SECONDS, useHarness } from './harnessFixture';
import { parseDurationMs, pollForSessionLine, sessionLines, sleep, vhFilePath } from './vhAssert';

const DWELL_MS = 1000;
// Time spent on the heatmap — well within the grace, so the refocus must cancel the close.
const HEATMAP_GAP_MS = 2000; // must stay well below UNFOCUS_GRACE_MS
// Lower bound for a session covering dwell + heatmap gap + dwell; the margin absorbs
// timing jitter yet stays far above any single split piece (~DWELL_MS each).
const MIN_CONTINUED_SESSION_MS = DWELL_MS + HEATMAP_GAP_MS + DWELL_MS / 2;
const POLL = { timeoutMs: 15_000 } as const;
// Bounded margin after the line landed: a split session's second piece would land with
// it (both close on the B switch), so a second line here is a bug.
const NO_SECOND_LINE_WINDOW_MS = 2000;

test.describe('S16 same-doc refocus within the unfocus grace', () => {
  const getHarness = useHarness(HIGH_IDLE_SECONDS);

  test('heatmap visit + refocus of A within grace keeps one continuous session', async () => {
    const h = getHarness();
    const aFile = vhFilePath(h.vaultDir, DOC_ID_A);

    await h.openFile(FILE_A);
    await sleep(DWELL_MS);
    await h.runCommand(CMD_OPEN_VAULT_HEATMAP);
    await h.waitForActiveViewType(VIEW_TYPE_HEATMAP);
    await sleep(HEATMAP_GAP_MS);
    await h.activateLeafOf(FILE_A); // A's own leaf — the heatmap opened in a NEW tab
    await sleep(DWELL_MS);
    await h.openFile(FILE_B); // B replaces A in A's leaf → A's session closes

    // AC16.1 — one session spanning dwell + heatmap gap + dwell (not split at the heatmap).
    const result = await pollForSessionLine(aFile, POLL);
    expect(parseDurationMs(result.firstLine)).toBeGreaterThanOrEqual(MIN_CONTINUED_SESSION_MS);

    // AC16.2 — exactly one line for A.
    await sleep(NO_SECOND_LINE_WINDOW_MS);
    expect(sessionLines(aFile)).toHaveLength(1);
  });
});
