// A freshly synced vault stamps every file with the download time, so the heatmap's
// recency colors are uniform. The header must then explain why (banner) — and stay
// quiet on a vault whose modified times are spread out.
import { expect, test, type Page } from '@playwright/test';
import { CMD_OPEN_VAULT_HEATMAP, VIEW_TYPE_HEATMAP } from './constants';
import { HIGH_IDLE_SECONDS } from './harnessFixture';
import { ObsidianHarness, type SeedFile } from './obsidianHarness';

const SEEDED_NOTE_COUNT = 24;
// The committed seed vault's A.md, B.md, C.canvas — copied per launch, so stamped "now".
const DEV_VAULT_FILE_COUNT = 3;
const TOTAL_FILE_COUNT = SEEDED_NOTE_COUNT + DEV_VAULT_FILE_COUNT;
const DAY_MS = 24 * 60 * 60 * 1000;
const SYNC_TIME_MS = Date.parse('2026-10-15T10:00:00.000Z');
const SPREAD_START_MS = Date.parse('2026-09-01T10:00:00.000Z');
const VIEWPORT = { width: 1200, height: 800 } as const;
const BANNER = '.vault-heatmap-view #header .hdr-cluster-banner';
// Rendered even while the info popover is closed; filled from the same stats update
// that carries the banner finding, so it proves the finding has bubbled up.
const FILE_COUNT_STAT = '.vault-heatmap-view .stats .stat strong';

function seedNotes(mtimeOf: (index: number) => number): SeedFile[] {
  return Array.from({ length: SEEDED_NOTE_COUNT }, (_, i) => ({
    path: `notes/note-${i}.md`,
    content: `note ${i}\n`,
    mtimeMs: mtimeOf(i),
  }));
}

async function launchAndOpenHeatmap(seedFiles: readonly SeedFile[]): Promise<ObsidianHarness> {
  const h = await ObsidianHarness.launch({ idleTimeoutSeconds: HIGH_IDLE_SECONDS, minFocusSecondsToRecord: 0, seedFiles });
  await h.trustVaultAuthor(); // its modal would cover the heatmap
  await h.page.evaluate(() => {
    window.app.workspace.leftSplit.collapse();
    window.app.workspace.rightSplit.collapse();
  });
  await h.page.setViewportSize(VIEWPORT); // the headless window boots too small to lay out
  await h.runCommand(CMD_OPEN_VAULT_HEATMAP);
  await h.waitForActiveViewType(VIEW_TYPE_HEATMAP);
  await expect(fileCountStat(h.page)).toHaveText(String(TOTAL_FILE_COUNT));
  return h;
}

function fileCountStat(page: Page) {
  return page.locator(FILE_COUNT_STAT).first();
}

test.describe('heatmap clustered-timestamps banner', () => {
  let h: ObsidianHarness | undefined;

  test.afterEach(async () => {
    if (h) await h.close();
    h = undefined;
  });

  test('should explain the uniform colors WHEN most notes share one modified time', async () => {
    // GIVEN a freshly synced vault: every seeded note has the same modified time.
    h = await launchAndOpenHeatmap(seedNotes(() => SYNC_TIME_MS));

    // THEN the header banner names the share and the likely cause.
    await expect(h.page.locator(BANNER)).toHaveText(
      `${SEEDED_NOTE_COUNT} of ${TOTAL_FILE_COUNT} notes have the same modified time, probably from a sync. ` +
        "Recency colors don't mean anything here.",
    );
  });

  test('should show no banner WHEN modified times are spread out', async () => {
    // GIVEN a vault whose notes were modified a day apart each.
    h = await launchAndOpenHeatmap(seedNotes((i) => SPREAD_START_MS + i * DAY_MS));

    // THEN (the stats — and with them the finding — have bubbled up) no banner shows.
    await expect(h.page.locator(BANNER)).toHaveCount(0);
  });
});
