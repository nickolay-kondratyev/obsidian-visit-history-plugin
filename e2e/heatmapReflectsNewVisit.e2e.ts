// An OPEN heatmap must reflect a visit recorded while it stays open: with the "visited"
// color field, a never-visited note's tile is dimmed; after the note is visited in another
// tab and its session closes (after the unfocus grace), the still-open heatmap re-renders
// and the tile shows as visited — no reopen needed. Bug: the heatmap only re-rendered on
// vault create/delete/rename, and VH writes are invisible to the Vault API.
import { expect, test, type Locator } from '@playwright/test';
import { CMD_OPEN_VAULT_HEATMAP, DOC_ID_A, FILE_A, UNFOCUS_GRACE_MS, VIEW_TYPE_HEATMAP } from './constants';
import { HIGH_IDLE_SECONDS, useHarness } from './harnessFixture';
import { pollForSessionLine, sleep, vhFilePath } from './vhAssert';

const VIEWPORT = { width: 1200, height: 800 } as const;
const DWELL_MS = 1000;
// Mirrors leafOpacity in src/view/utils.ts (heatmap color mode): a tile whose color-field
// timestamp is missing is dimmed; one that has it is not.
const NO_TIMESTAMP_OPACITY = '0.55';
const HAS_TIMESTAMP_OPACITY = '0.88';
// Grace + generous margin for the async append.
const SESSION_LINE_TIMEOUT_MS = UNFOCUS_GRACE_MS + 10_000;
// Session line landed → heatmap re-read + render; generous for a slow CI box.
const RERENDER_TIMEOUT_MS = 10_000;

test.describe('heatmap reflects a new visit while open', () => {
  const getHarness = useHarness(HIGH_IDLE_SECONDS);

  test('should show a never-visited note as visited WHEN it is visited while the heatmap stays open', async () => {
    const h = getHarness();
    await h.trustVaultAuthor(); // its modal would cover the heatmap
    await h.page.evaluate(() => {
      window.app.workspace.leftSplit.collapse();
      window.app.workspace.rightSplit.collapse();
    });
    await h.page.setViewportSize(VIEWPORT); // the headless window boots too small to lay out

    // GIVEN the heatmap is open, colored by "visited", and A has never been visited
    await h.runCommand(CMD_OPEN_VAULT_HEATMAP);
    await h.waitForActiveViewType(VIEW_TYPE_HEATMAP);
    await h.page.locator('.vault-heatmap-view #header button[title="Change timestamp field"]').click();
    await h.page.locator('.vault-heatmap-view .hdr-pop.open .cfg-radio', { hasText: 'visited' }).click();
    const tileA: Locator = h.page.locator(`.vault-heatmap-view svg[data-path="${FILE_A}"] > rect`);
    await expect(tileA).toHaveAttribute('fill-opacity', NO_TIMESTAMP_OPACITY);

    // WHEN A is visited in a new tab, then the heatmap tab is re-activated
    await h.page.evaluate(async (p) => {
      const file = window.app.vault.getAbstractFileByPath(p);
      if (!file) throw new Error(`file not found in vault: ${p}`);
      const leaf = window.app.workspace.getLeaf(true); // true = a new tab
      await leaf.openFile(file);
      window.app.workspace.setActiveLeaf(leaf, { focus: true });
    }, FILE_A);
    await sleep(DWELL_MS);
    await h.page.evaluate((type) => {
      const leaf = window.app.workspace.getLeavesOfType(type)[0];
      if (!leaf) throw new Error(`no leaf of type=[${type}]`);
      window.app.workspace.setActiveLeaf(leaf, { focus: true });
    }, VIEW_TYPE_HEATMAP);
    await pollForSessionLine(vhFilePath(h.vaultDir, DOC_ID_A), { timeoutMs: SESSION_LINE_TIMEOUT_MS });

    // THEN the still-open heatmap shows A as visited
    await expect(tileA).toHaveAttribute('fill-opacity', HAS_TIMESTAMP_OPACITY, { timeout: RERENDER_TIMEOUT_MS });
  });
});
