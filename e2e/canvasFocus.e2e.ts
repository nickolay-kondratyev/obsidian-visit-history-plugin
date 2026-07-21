// S4 — Focus in a canvas.
// Open C.canvas, dwell, switch to A.md. The switch to a different tracked doc finalizes
// C's pending close immediately (no 10 s grace wait). Proves the canvas doc-id path:
// C's id comes from metadata.frontmatter.id (CanvasDocIdStore).
import { expect, test } from '@playwright/test';
import { DOC_ID_C, FILE_A, FILE_C } from './constants';
import { ObsidianHarness } from './obsidianHarness';
import { existsSync } from 'node:fs';
import { parseDurationMs, pollForSessionLine, sleep, vhFilePath } from './vhAssert';

const HIGH_IDLE_SECONDS = 180;

test.describe('S4 focus in a canvas', () => {
  let h: ObsidianHarness;

  test.beforeEach(async () => {
    h = await ObsidianHarness.launch({ idleTimeoutSeconds: HIGH_IDLE_SECONDS });
  });
  test.afterEach(async () => {
    await h.close();
  });

  test('canvas records one bounded session under its metadata.frontmatter.id', async () => {
    await h.openFile(FILE_C);
    await sleep(1000);
    await h.openFile(FILE_A);

    // AC4.3 — the file lives under the seeded canvas doc-id path.
    const cFile = vhFilePath(h.vaultDir, DOC_ID_C);
    const result = await pollForSessionLine(cFile, { timeoutMs: 15_000 });
    expect(existsSync(cFile)).toBe(true);

    // AC4.1 — exactly one closed session line.
    expect(result.lines).toHaveLength(1);

    // AC4.2 — bounded duration.
    const durationMs = parseDurationMs(result.firstLine);
    expect(durationMs).toBeGreaterThanOrEqual(0);
    expect(durationMs).toBeLessThan(60_000);
  });
});
