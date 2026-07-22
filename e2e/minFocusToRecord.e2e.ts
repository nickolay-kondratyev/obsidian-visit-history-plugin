// S7 — Minimum focus time before a visit is recorded.
// minFocusSecondsToRecord=3, idle high (never fires). A sub-threshold dwell must leave
// NO trace at all (no .vh_v3 line); an at/above-threshold dwell records normally. The
// positive control on the SAME file proves the absence was the filter, not a broken path.
import { expect, test } from '@playwright/test';
import { DOC_ID_A, DOC_ID_B, FILE_A, FILE_B } from './constants';
import { HIGH_IDLE_SECONDS, useHarness } from './harnessFixture';
import {
  assertNoSessionLineWithin,
  parseDurationMs,
  pollForSessionLine,
  sleep,
  vhFilePath,
} from './vhAssert';

const MIN_FOCUS_SECONDS = 3;
// Dwell comfortably above the 3 s threshold so the recorded duration is unambiguously >= 3000.
const ABOVE_THRESHOLD_MS = 4000;
// A quick in-and-out dwell, well below the 3 s threshold — must be dropped.
const BELOW_THRESHOLD_MS = 1000;

test.describe('S7 minimum focus time before a visit is recorded', () => {
  // Third arg = minFocusSecondsToRecord (default 0 in every other spec).
  const getHarness = useHarness(HIGH_IDLE_SECONDS, undefined, MIN_FOCUS_SECONDS);

  test('drops a sub-threshold visit entirely, records an at-threshold one', async () => {
    const h = getHarness();
    const aFile = vhFilePath(h.vaultDir, DOC_ID_A);
    const bFile = vhFilePath(h.vaultDir, DOC_ID_B);

    // Quick in-and-out on A (~1 s < 3 s), then dwell on B past the threshold.
    await h.openFile(FILE_A);
    await sleep(BELOW_THRESHOLD_MS);
    await h.openFile(FILE_B); // finalizes A's sub-threshold close immediately
    await sleep(ABOVE_THRESHOLD_MS);
    await h.openFile(FILE_A); // finalizes B's above-threshold close; reopens A

    // AC7.1 — B recorded exactly one line, duration at/above the 3 s minimum.
    const bResult = await pollForSessionLine(bFile, { timeoutMs: 15_000 });
    expect(bResult.lines).toHaveLength(1);
    expect(parseDurationMs(bResult.firstLine)).toBeGreaterThanOrEqual(MIN_FOCUS_SECONDS * 1000);

    // AC7.2 — A's sub-threshold visit left NO trace: its close finalized on the A→B focus
    // (before B's line, asserted above). A is now reopened with an OPEN session, so no line
    // should ever appear for it across a bounded window — no trace at all.
    await assertNoSessionLineWithin(aFile, { timeoutMs: 1500 });

    // AC7.3 (positive control) — A CAN record: dwell past the threshold, then switch away.
    // Proves the earlier absence was the min-focus filter, not a broken recording path for A.
    await sleep(ABOVE_THRESHOLD_MS);
    await h.openFile(FILE_B); // finalizes A's now-above-threshold close
    const aResult = await pollForSessionLine(aFile, { timeoutMs: 15_000 });
    expect(aResult.lines).toHaveLength(1);
    expect(parseDurationMs(aResult.firstLine)).toBeGreaterThanOrEqual(MIN_FOCUS_SECONDS * 1000);
  });
});
