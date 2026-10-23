// Heatmap chrome must stay usable on narrow / mobile layouts (seen on an Android tablet):
// a long folder breadcrumb must not push the header's right-hand buttons out of view, and
// Obsidian's mobile input styling must not squeeze the config panel's slider tracks away.
import { expect, test, type Page } from '@playwright/test';
import { PLUGIN_ID, VIEW_TYPE_HEATMAP } from './constants';
import { HIGH_IDLE_SECONDS } from './harnessFixture';
import { ObsidianHarness } from './obsidianHarness';

// Long enough that the breadcrumb alone outgrows the header at any realistic pane width.
const DEEP_FOLDER =
  'projects-with-a-rather-long-name/2026-planning-and-retrospectives/quarterly-business-reviews/' +
  'engineering-team-backend-platform/very-deeply-nested-subfolder-for-layout';
const DEEP_NOTE = `${DEEP_FOLDER}/Deep note.md`;
const VIEWPORT_HEIGHT = 800;
// Sidebars are collapsed, so the heatmap pane spans the whole viewport width.
const PANE_WIDTHS = [
  { name: 'a phone or tablet split pane', width: 420 },
  { name: 'a tablet in portrait', width: 800 },
] as const;
const TABLET_PORTRAIT_WIDTH = 800;
// Guards against a vacuous pass: the harness window's default layout leaves the pane ~0px.
const MIN_MEANINGFUL_HEADER_WIDTH_PX = 300;
// Below this a range input is not draggable on touch — the bug squeezed it to 0px.
const MIN_USABLE_SLIDER_WIDTH_PX = 40;
const CONFIG_BUTTON_TITLE = 'Configure heatmap';

/** Right edges of the visible heatmap header and of one of its buttons (by title). */
async function headerAndButtonRight(page: Page, buttonTitle: string): Promise<{ header: number; button: number }> {
  return page.evaluate(
    ([title, minHeaderWidth]) => {
      const header = Array.from(document.querySelectorAll<HTMLElement>('.vault-heatmap-view #header')).find(
        (e) => e.offsetWidth > 0,
      );
      if (!header) throw new Error('no visible heatmap header');
      if (header.offsetWidth < minHeaderWidth) throw new Error(`header too narrow to test width=[${header.offsetWidth}]`);
      const button = header.querySelector(`button[title="${title}"]`);
      if (!button) throw new Error(`no header button title=[${title}]`);
      return { header: header.getBoundingClientRect().right, button: button.getBoundingClientRect().right };
    },
    [buttonTitle, MIN_MEANINGFUL_HEADER_WIDTH_PX] as const,
  );
}

/** Narrowest range input in the open config panel. */
async function narrowestConfigSliderWidth(page: Page): Promise<number> {
  return page.evaluate(() => {
    const ranges = Array.from(
      document.querySelectorAll<HTMLElement>('.vault-heatmap-view #config.open input[type="range"]'),
    );
    if (ranges.length === 0) throw new Error('no sliders in an open config panel');
    return Math.min(...ranges.map((r) => r.getBoundingClientRect().width));
  });
}

/** Collapses both sidebars and sizes the window, so the heatmap pane is `width` wide. */
async function setPaneWidth(page: Page, width: number): Promise<void> {
  await page.evaluate(() => {
    window.app.workspace.leftSplit.collapse();
    window.app.workspace.rightSplit.collapse();
  });
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
}

test.describe('heatmap mobile layout', () => {
  let h: ObsidianHarness | undefined;

  // GIVEN the heatmap opened on a deeply nested folder (long breadcrumb).
  test.beforeEach(async () => {
    h = await ObsidianHarness.launch({
      idleTimeoutSeconds: HIGH_IDLE_SECONDS,
      minFocusSecondsToRecord: 0,
      seedFiles: [{ path: DEEP_NOTE, content: 'deep note\n' }],
    });
    await h.trustVaultAuthor(); // its modal would intercept clicks on the heatmap
    await h.page.evaluate(
      async ([viewType, folderPath, pluginId]) => {
        if (!window.app.plugins.plugins[pluginId]) throw new Error('plugin not loaded');
        await window.app.workspace.getLeaf(true).setViewState({ type: viewType, active: true, state: { folderPath } });
      },
      [VIEW_TYPE_HEATMAP, DEEP_FOLDER, PLUGIN_ID] as const,
    );
    await h.waitForActiveViewType(VIEW_TYPE_HEATMAP);
    await h.page.locator(`.vault-heatmap-view #header button[title="${CONFIG_BUTTON_TITLE}"]`).waitFor();
  });

  test.afterEach(async () => {
    if (h) await h.close();
    h = undefined;
  });

  function page(): Page {
    if (!h) throw new Error('harness accessed outside a test (beforeEach did not run)');
    return h.page;
  }

  for (const pane of PANE_WIDTHS) {
    test(`should keep the config button inside the header on ${pane.name} with a long breadcrumb`, async () => {
      await setPaneWidth(page(), pane.width);

      const rights = await headerAndButtonRight(page(), CONFIG_BUTTON_TITLE);

      expect(rights.button).toBeLessThanOrEqual(rights.header);
    });
  }

  test('should keep config sliders usable under mobile styling', async () => {
    await setPaneWidth(page(), TABLET_PORTRAIT_WIDTH);
    // WHY the class, not app.emulateMobile(): `body.is-mobile` is exactly what Obsidian's
    // mobile stylesheet keys on (`.is-mobile input[type="text"] { width: 100% }` squeezed
    // the slider track to 0px), and toggling it avoids a workspace rebuild mid-test.
    await page().evaluate(() => document.body.classList.add('is-mobile'));
    await page().locator(`.vault-heatmap-view #header button[title="${CONFIG_BUTTON_TITLE}"]`).click();

    expect(await narrowestConfigSliderWidth(page())).toBeGreaterThanOrEqual(MIN_USABLE_SLIDER_WIDTH_PX);
  });
});
