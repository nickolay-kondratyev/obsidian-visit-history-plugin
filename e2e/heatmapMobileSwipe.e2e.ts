// Heatmap on MOBILE: a horizontal swipe that starts on the canvas pans the treemap and must
// NOT also open Obsidian's side drawer (the canvas opts out via `data-ignore-swipe`, see
// TreemapViz); a swipe over the heatmap toolbar still opens the drawer. Obsidian installs its
// drawer-swipe handler only in the mobile UI, so the spec switches to it with
// `app.emulateMobile` and drives REAL touch input over CDP (see heatmapTouchTap.e2e.ts).
import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { PLUGIN_ID, VIEW_TYPE_HEATMAP } from './constants';
import { HIGH_IDLE_SECONDS } from './harnessFixture';
import { ObsidianHarness } from './obsidianHarness';

const ROOT_FOLDER = 'mobile-swipe';
const NOTES = ['Big', 'Small one', 'Small two'].map((n) => `${ROOT_FOLDER}/${n}.md`);
const NOTE_BYTES = 4_000;
const VIEWPORT = { width: 1000, height: 800 } as const;
const VIZ = '.vault-heatmap-view #viz';
const TOOLBAR = '.vault-heatmap-view #header';
/** Swipe start x: away from the screen edge, inside both the canvas and the toolbar. */
const SWIPE_START_X = 300;
/** Long enough for Obsidian to read the swipe as a drawer gesture (verified without the opt-out). */
const SWIPE_DISTANCE_PX = 500;
const SWIPE_MOVE_STEPS = 10;

/** One real horizontal touch swipe to the right, starting at `SWIPE_START_X` on `y`. */
async function swipeRight(cdp: CDPSession, y: number): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: SWIPE_START_X, y }] });
  for (let step = 1; step <= SWIPE_MOVE_STEPS; step++) {
    const x = SWIPE_START_X + (SWIPE_DISTANCE_PX * step) / SWIPE_MOVE_STEPS;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** Vertical middle of the first visible element matching `selector`. */
async function middleY(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    const el = Array.from(document.querySelectorAll<HTMLElement>(sel)).find((e) => e.offsetWidth > 0);
    if (!el) throw new Error(`no visible element selector=[${sel}]`);
    const r = el.getBoundingClientRect();
    return r.top + r.height / 2;
  }, selector);
}

/** The treemap's current zoom/pan transform (changes when the canvas pans). */
async function treemapTransform(page: Page): Promise<string | null> {
  return page.evaluate((sel) => {
    const g = Array.from(document.querySelectorAll<HTMLElement>(`${sel} svg > g`)).find(
      (e) => e.getBoundingClientRect().width > 0,
    );
    return g?.getAttribute('transform') ?? null;
  }, VIZ);
}

async function leftDrawerCollapsed(page: Page): Promise<boolean> {
  return page.evaluate(() => window.app.workspace.leftSplit.collapsed);
}

test.describe('heatmap mobile swipe', () => {
  let h: ObsidianHarness | undefined;
  let cdp: CDPSession | undefined;

  // GIVEN Obsidian's mobile UI with both drawers closed, the heatmap open on a small folder,
  // and touch emulation enabled (so CDP touch input becomes real touch events).
  test.beforeEach(async () => {
    h = await ObsidianHarness.launch({
      idleTimeoutSeconds: HIGH_IDLE_SECONDS,
      minFocusSecondsToRecord: 0,
      seedFiles: NOTES.map((path) => ({ path, content: 'x'.repeat(NOTE_BYTES) })),
    });
    await h.trustVaultAuthor(); // its modal would intercept the touches
    await h.emulateMobile();
    await h.page.setViewportSize(VIEWPORT);
    await h.page.evaluate(
      async ([viewType, folderPath, pluginId]) => {
        if (!window.app.plugins.plugins[pluginId]) throw new Error('plugin not loaded');
        window.app.workspace.leftSplit.collapse();
        window.app.workspace.rightSplit.collapse();
        await window.app.workspace.getLeaf(true).setViewState({ type: viewType, active: true, state: { folderPath } });
      },
      [VIEW_TYPE_HEATMAP, ROOT_FOLDER, PLUGIN_ID] as const,
    );
    await h.waitForActiveViewType(VIEW_TYPE_HEATMAP);
    await h.page.waitForFunction(
      (sel) => Array.from(document.querySelectorAll<HTMLElement>(sel)).some((e) => e.offsetWidth > 0),
      VIZ,
    );
    cdp = await h.page.context().newCDPSession(h.page);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
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

  test('should pan without opening the side drawer when a swipe starts on the canvas', async () => {
    const before = await treemapTransform(page());

    // WHEN a horizontal swipe starts on the canvas
    await swipeRight(session(), await middleY(page(), VIZ));

    // THEN it panned (the swipe was delivered) — and the left drawer stayed closed
    await expect.poll(() => treemapTransform(page())).not.toBe(before);
    expect(await leftDrawerCollapsed(page())).toBe(true);
  });

  // Control: proves the drawer gesture is live in this setup, so the canvas test cannot pass
  // vacuously — and that the opt-out is scoped to the canvas, not the whole view.
  test('should open the side drawer when a swipe starts on the heatmap toolbar', async () => {
    // WHEN the same swipe starts on the toolbar above the canvas
    await swipeRight(session(), await middleY(page(), TOOLBAR));

    // THEN the left drawer opens
    await expect.poll(() => leftDrawerCollapsed(page())).toBe(false);
  });
});
