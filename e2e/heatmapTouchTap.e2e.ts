// Heatmap on touch: a tap on a file tile opens a details card (instead of opening the file),
// and the card's Open button opens it. Driven with REAL touch input over CDP
// (Input.dispatchTouchEvent) — Playwright's `hasTouch` cannot be set after connectOverCDP,
// and mouse events would not exercise the touch path. Tap rules themselves are unit-tested
// in TileTapRules; this proves the wiring in real Obsidian. Also writes a screenshot of the
// card to the git-ignored .out/ for human review (not asserted).
import { expect, test, type CDPSession, type Locator, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { PLUGIN_ID, VIEW_TYPE_HEATMAP } from './constants';
import { HIGH_IDLE_SECONDS } from './harnessFixture';
import { ObsidianHarness } from './obsidianHarness';

const ROOT_FOLDER = 'touch-tap';
/** Short name + large content → a big tile that always shows its full label (the tap target). */
const TARGET_NAME = 'Tap me';
const TARGET_NOTE = `${ROOT_FOLDER}/${TARGET_NAME}.md`;
const TARGET_BYTES = 40_000;
const OTHER_NOTES = ['Other one', 'Other two'].map((n) => `${ROOT_FOLDER}/${n}.md`);
const OTHER_BYTES = 4_000;
const VIEWPORT = { width: 1000, height: 800 } as const;
// run-e2e.sh cd's to the repo root before invoking Playwright, so cwd IS the repo root.
const SCREENSHOT_DIR = join(process.cwd(), '.out');
const SCREENSHOT_CARD = join(SCREENSHOT_DIR, 'heatmap-touch-card.png');
const CARD = '.vault-heatmap-view .vt-file-card';

/** One real touch tap (touchStart + touchEnd at the same point) at the element's centre. */
async function touchTap(cdp: CDPSession, target: Locator): Promise<void> {
  const box = await target.boundingBox();
  if (!box) throw new Error('tap target has no bounding box');
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** Path shown by the active leaf (`undefined` for non-file views like the heatmap). */
async function activeFilePath(page: Page): Promise<string | undefined> {
  return page.evaluate(() => window.app.workspace.activeLeaf?.view.file?.path);
}

async function activeViewType(page: Page): Promise<string | undefined> {
  return page.evaluate(() => window.app.workspace.activeLeaf?.view.getViewType());
}

test.describe('heatmap touch tap', () => {
  let h: ObsidianHarness | undefined;
  let cdp: CDPSession | undefined;

  // GIVEN the heatmap opened on a small folder, in a desktop-sized pane, with touch
  // emulation enabled on the page (so CDP touch input becomes real touch/pointer events).
  test.beforeEach(async () => {
    h = await ObsidianHarness.launch({
      idleTimeoutSeconds: HIGH_IDLE_SECONDS,
      minFocusSecondsToRecord: 0,
      seedFiles: [
        { path: TARGET_NOTE, content: 'x'.repeat(TARGET_BYTES) },
        ...OTHER_NOTES.map((path) => ({ path, content: 'x'.repeat(OTHER_BYTES) })),
      ],
    });
    await h.trustVaultAuthor(); // its modal would intercept the taps
    await h.page.evaluate(() => {
      window.app.workspace.leftSplit.collapse();
      window.app.workspace.rightSplit.collapse();
    });
    await h.page.setViewportSize(VIEWPORT);
    await h.page.evaluate(
      async ([viewType, folderPath, pluginId]) => {
        if (!window.app.plugins.plugins[pluginId]) throw new Error('plugin not loaded');
        await window.app.workspace.getLeaf(true).setViewState({ type: viewType, active: true, state: { folderPath } });
      },
      [VIEW_TYPE_HEATMAP, ROOT_FOLDER, PLUGIN_ID] as const,
    );
    await h.waitForActiveViewType(VIEW_TYPE_HEATMAP);
    cdp = await h.page.context().newCDPSession(h.page);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  test.afterEach(async () => {
    if (h) await h.close();
    h = undefined;
    cdp = undefined;
  });

  function page(): Page {
    if (!h) throw new Error('harness accessed outside a test (beforeEach did not run)');
    return h.page;
  }

  function session(): CDPSession {
    if (!cdp) throw new Error('CDP session accessed outside a test (beforeEach did not run)');
    return cdp;
  }

  test('should show the details card on a file tap, and open the file from its Open button', async () => {
    const targetLabel = page().locator('.vault-heatmap-view .leaf-node__label', { hasText: TARGET_NAME }).first();
    await expect(targetLabel).toBeVisible();

    // WHEN the file tile is tapped
    await touchTap(session(), targetLabel);

    // THEN the card shows the file — and the tap did NOT also open it (heatmap still active)
    await expect(page().locator(CARD)).toContainText(TARGET_NAME);
    expect(await activeViewType(page())).toBe(VIEW_TYPE_HEATMAP);
    await page().screenshot({ path: SCREENSHOT_CARD });

    // WHEN Open is tapped
    await touchTap(session(), page().locator(`${CARD} button.vt-file-card__open`));

    // THEN that file is the active file
    await expect
      .poll(() => activeFilePath(page()))
      .toBe(TARGET_NOTE);
  });
});
