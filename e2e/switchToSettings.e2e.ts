// S3 — Switching to Settings (BEHAVIOR-CAPTURING; human decision: capture CURRENT behavior).
//
// Empirically confirmed against Obsidian 1.12.7 (Milestone 2 probe): opening the Settings
// modal does NOT change the active leaf (stays `markdown`) and does NOT blur the OS window,
// so it does NOT end the focused document's session on its own. This spec encodes that
// truth: Settings alone records nothing for A; the session closes only on the subsequent
// switch to B. The "does Settings end a session?" product question is raised for the owner
// (#QUESTION_FOR_HUMAN in the plan) and ticketed — we do NOT assert a close the product
// does not perform.
import { expect, test } from '@playwright/test';
import { DOC_ID_A, FILE_A, FILE_B } from './constants';
import { HIGH_IDLE_SECONDS, useHarness } from './harnessFixture';
import { parseDurationMs, pollForSessionLine, sessionLines, sleep, vhFilePath } from './vhAssert';

test.describe('S3 switch to Settings (current behavior)', () => {
  const getHarness = useHarness(HIGH_IDLE_SECONDS);

  test('Settings-open alone does not end the session; the later doc switch does', async () => {
    const h = getHarness();
    const aFile = vhFilePath(h.vaultDir, DOC_ID_A);

    await h.openFile(FILE_A);
    await sleep(1000);
    await h.openSettings();

    // AC3 (captured behavior) — Settings does not close A's session.
    await sleep(2000);
    expect(sessionLines(aFile)).toHaveLength(0);

    // Closing Settings + switching to a different tracked doc DOES close A.
    await h.closeSettings();
    await h.openFile(FILE_B);

    const result = await pollForSessionLine(aFile, { timeoutMs: 15_000 });
    expect(result.lines).toHaveLength(1);
    const durationMs = parseDurationMs(result.firstLine);
    expect(durationMs).toBeGreaterThanOrEqual(0);
    expect(durationMs).toBeLessThan(60_000);
  });
});
