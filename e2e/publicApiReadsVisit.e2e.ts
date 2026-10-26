// Public cross-plugin API (src/api/VisitHistoryApi.ts, API.md): another plugin discovers it
// the documented way — `app.plugins.getPlugin('visit-history').api` — and reads a visit
// recorded in this session: once A's session closes, getVisitStatsV1('A.md') reports it,
// and getFileColorV1 returns a `#rrggbb` fill for the same tracked note.
import { expect, test } from '@playwright/test';
import { DOC_ID_A, FILE_A, FILE_B, PLUGIN_ID } from './constants';
import { HIGH_IDLE_SECONDS, useHarness } from './harnessFixture';
import { pollForSessionLine, sleep, vhFilePath } from './vhAssert';

const DWELL_MS = 1000;
// Switching to another tracked doc closes A's session without the unfocus grace;
// generous margin for the async append.
const SESSION_LINE_TIMEOUT_MS = 15_000;
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/;

/** What the spec reads through the public API (plain JSON — crosses the page boundary). */
interface ApiReadResult {
  stats: { lastVisitMs: number | null; totalFocusMs: number } | undefined;
  color: { fill: string; hasData: boolean } | undefined;
}

test.describe('public API reads a recorded visit', () => {
  const getHarness = useHarness(HIGH_IDLE_SECONDS);

  test('should report a visit via getVisitStatsV1 WHEN the session for the note has closed', async () => {
    const h = getHarness();
    const visitStartedAtMs = Date.now();

    // GIVEN A was visited and its session closed (switching to B closes it)
    await h.openFile(FILE_A);
    await sleep(DWELL_MS);
    await h.openFile(FILE_B);
    await pollForSessionLine(vhFilePath(h.vaultDir, DOC_ID_A), { timeoutMs: SESSION_LINE_TIMEOUT_MS });

    // WHEN another plugin reads A through the discovered public API
    const result = await h.page.evaluate(async ({ pluginId, path }): Promise<ApiReadResult> => {
      // Boundary: the harness types plugins as unknown — this is the shape API.md documents.
      const plugin = window.app.plugins.getPlugin(pluginId) as {
        api?: {
          getVisitStatsV1(p: string): Promise<ApiReadResult['stats']>;
          getFileColorV1(p: string): Promise<ApiReadResult['color']>;
        };
      } | null;
      if (!plugin?.api) throw new Error(`no public api on plugin id=[${pluginId}]`);
      return { stats: await plugin.api.getVisitStatsV1(path), color: await plugin.api.getFileColorV1(path) };
    }, { pluginId: PLUGIN_ID, path: FILE_A });

    // THEN the visit is reported (last visit = this session's start) and the color is hex
    expect(result.stats?.lastVisitMs).toBeGreaterThanOrEqual(visitStartedAtMs);
    expect(result.color?.fill).toMatch(HEX_COLOR_RE);
  });
});
